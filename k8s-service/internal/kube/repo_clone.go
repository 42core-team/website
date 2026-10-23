package kube

import (
	"encoding/base64"
	"errors"
	"regexp"
	"strconv"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	githubURLPrefix = "https://github.com/"
	// repoCloneUser is the user name sent with the token. GitHub ignores it for
	// token authentication, so it does not need to be the organization name.
	repoCloneUser = "x-access-token"
	// cloneTargetDir is where the bot repository is cloned to; the bot
	// container mounts the same volume at the same path.
	cloneTargetDir = "/shared-data"
)

var (
	githubOwnerPattern = regexp.MustCompile(`^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$`)
	githubRepoPattern  = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
)

// cloneRepoScript is the static script run by the clone init container. All
// per-bot values are passed in through the environment and only ever expanded
// inside double quotes, so no data is ever parsed as shell code. Git reads its
// credentials from GIT_CONFIG_* environment variables.
const cloneRepoScript = `set -eu
printf 'Bot ID: %s\n' "$BOT_ID"
printf 'Bot Name: %s\n' "$BOT_NAME"
echo '--- Cloning repository (verbose, progress) ---'
git clone --single-branch --depth 1 --verbose --progress -- "$REPO_URL" /shared-data
cd /shared-data
echo '--- Repo content ---'
ls -F
echo '--- Repository size ---'
du -sh /shared-data
echo '--- Last commit ---'
git --no-pager log -1 --decorate=short --pretty=fuller
echo '--- Diffstat ---'
git --no-pager show --stat -1
echo '--- changing permissions ---'
find /shared-data -mindepth 1 ! -type l -exec chmod 770 {} +
`

// validateRepoURL accepts only credential-free https://github.com/<owner>/<repo>
// URLs.
func validateRepoURL(repoURL string) error {
	rest, ok := strings.CutPrefix(repoURL, githubURLPrefix)
	if !ok {
		return errors.New("repository URL must start with " + githubURLPrefix)
	}
	parts := strings.Split(rest, "/")
	if len(parts) != 2 {
		return errors.New("repository URL must have the form " + githubURLPrefix + "<owner>/<repo>")
	}
	owner, repo := parts[0], parts[1]
	if len(owner) > 39 || !githubOwnerPattern.MatchString(owner) {
		return errors.New("repository URL has an invalid owner")
	}
	if !githubRepoPattern.MatchString(repo) || repo == "." || repo == ".." {
		return errors.New("repository URL has an invalid repository name")
	}
	return nil
}

func repoCredentialsSecretName(game *Game) string {
	return "game-repo-credentials-" + game.ID.String()
}

// repoCredentialsSecretKey is the key in the credentials Secret that holds the
// HTTP header a bot's clone container authenticates with.
func repoCredentialsSecretKey(bot Bot) string {
	return "auth-header-" + bot.ID.String()
}

// newRepoCredentialsSecret returns the Secret holding the clone credentials of
// every bot that has a token, or nil when no bot has one.
func newRepoCredentialsSecret(game *Game, namespace string) *corev1.Secret {
	data := make(map[string][]byte)
	for _, bot := range game.Bots {
		if bot.RepoToken == "" {
			continue
		}
		basicAuth := base64.StdEncoding.EncodeToString([]byte(repoCloneUser + ":" + bot.RepoToken))
		data[repoCredentialsSecretKey(bot)] = []byte("Authorization: Basic " + basicAuth)
	}
	if len(data) == 0 {
		return nil
	}
	immutable := true
	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      repoCredentialsSecretName(game),
			Namespace: namespace,
		},
		Type:      corev1.SecretTypeOpaque,
		Immutable: &immutable,
		Data:      data,
	}
}

// gitConfigEntry is a git config setting passed to git through the
// GIT_CONFIG_KEY_<n>/GIT_CONFIG_VALUE_<n> environment variables.
type gitConfigEntry struct {
	key   string
	value corev1.EnvVar
}

// newCloneRepoInitContainer returns the init container that clones a bot's
// repository into its shared volume. It runs as the bot user, so the cloned
// files are already owned by the bot and no root privileges are needed. When
// credentialsSecretName is set and the bot has a token, the token is read from
// that Secret and only exposed to this container.
func newCloneRepoInitContainer(name, volumeName string, bot Bot, credentialsSecretName string, runAsUser int64) corev1.Container {
	botName := ""
	if bot.Name != nil {
		botName = *bot.Name
	}

	gitConfig := []gitConfigEntry{
		// /shared-data is the volume mount point and owned by root, not by the
		// user running git.
		{key: "safe.directory", value: corev1.EnvVar{Value: cloneTargetDir}},
	}
	if credentialsSecretName != "" && bot.RepoToken != "" {
		gitConfig = append(gitConfig, gitConfigEntry{
			key: "http." + githubURLPrefix + ".extraHeader",
			value: corev1.EnvVar{ValueFrom: &corev1.EnvVarSource{
				SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{Name: credentialsSecretName},
					Key:                  repoCredentialsSecretKey(bot),
				},
			}},
		})
	}

	env := []corev1.EnvVar{
		{Name: "BOT_ID", Value: bot.ID.String()},
		{Name: "BOT_NAME", Value: botName},
		{Name: "REPO_URL", Value: bot.RepoURL},
		{Name: "GIT_TERMINAL_PROMPT", Value: "0"},
		{Name: "GIT_ALLOW_PROTOCOL", Value: "https"},
		{Name: "GIT_CONFIG_NOSYSTEM", Value: "1"},
		{Name: "GIT_CONFIG_COUNT", Value: strconv.Itoa(len(gitConfig))},
	}
	for i, entry := range gitConfig {
		index := strconv.Itoa(i)
		env = append(env, corev1.EnvVar{Name: "GIT_CONFIG_KEY_" + index, Value: entry.key})
		value := entry.value
		value.Name = "GIT_CONFIG_VALUE_" + index
		env = append(env, value)
	}

	runAsNonRoot := true
	allowPrivilegeEscalation := false
	return corev1.Container{
		Name:    name,
		Image:   "alpine/git",
		Command: []string{"sh", "-c", cloneRepoScript},
		Env:     env,
		VolumeMounts: []corev1.VolumeMount{
			{
				Name:      volumeName,
				MountPath: cloneTargetDir,
			},
		},
		SecurityContext: &corev1.SecurityContext{
			RunAsUser:                &runAsUser,
			RunAsGroup:               &runAsUser,
			RunAsNonRoot:             &runAsNonRoot,
			AllowPrivilegeEscalation: &allowPrivilegeEscalation,
			SeccompProfile: &corev1.SeccompProfile{
				Type: corev1.SeccompProfileTypeRuntimeDefault,
			},
			Capabilities: &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}},
		},
		Resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("100m"),
				corev1.ResourceMemory: resource.MustParse("128Mi"),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse("500m"),
				corev1.ResourceMemory: resource.MustParse("512Mi"),
			},
		},
	}
}
