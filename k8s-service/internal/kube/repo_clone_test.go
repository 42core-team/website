package kube

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	corev1 "k8s.io/api/core/v1"
)

const testToken = "test-repo-token-0123456789"

func newTestGame(name, repoURL, token string) *Game {
	return &Game{
		ID:    uuid.New(),
		Image: "ghcr.io/42core-team/game-server:dev",
		Bots: []Bot{
			{
				ID:        uuid.New(),
				Image:     "ghcr.io/42core-team/my-core-bot:dev",
				RepoURL:   repoURL,
				RepoToken: token,
				Name:      &name,
			},
			{
				ID:        uuid.New(),
				Image:     "ghcr.io/42core-team/my-core-bot:dev",
				RepoURL:   "https://github.com/core-org/other-repo",
				RepoToken: token,
			},
		},
	}
}

func TestBuildGameResourcesKeepsTokenOutOfPodSpec(t *testing.T) {
	maliciousName := `x'; touch /tmp/pwned; echo '$(id)`
	game := newTestGame(maliciousName, "https://github.com/core-org/team-repo", testToken)

	res, err := buildGameResources(game, "games", "https://s3.example/upload", "http://rabbit/publish")
	if err != nil {
		t.Fatalf("buildGameResources returned error: %v", err)
	}

	jobJSON, err := json.Marshal(res.job)
	if err != nil {
		t.Fatalf("failed to marshal job: %v", err)
	}
	encodedToken := base64.StdEncoding.EncodeToString([]byte(repoCloneUser + ":" + testToken))
	for _, forbidden := range []string{testToken, encodedToken} {
		if strings.Contains(string(jobJSON), forbidden) {
			t.Fatalf("job spec contains the repository token (%q)", forbidden)
		}
	}
	configMapJSON, _ := json.Marshal(res.configMap)
	if strings.Contains(string(configMapJSON), testToken) {
		t.Fatal("configmap contains the repository token")
	}

	if res.credentialsSecret == nil {
		t.Fatal("expected a credentials secret")
	}
	if res.credentialsSecret.Immutable == nil || !*res.credentialsSecret.Immutable {
		t.Error("credentials secret should be immutable")
	}
	for _, bot := range game.Bots {
		header := string(res.credentialsSecret.Data[repoCredentialsSecretKey(bot)])
		if header != "Authorization: Basic "+encodedToken {
			t.Errorf("unexpected auth header for bot %s: %q", bot.ID, header)
		}
	}

	podSpec := res.job.Spec.Template.Spec
	cloneContainers := 0
	for _, container := range podSpec.InitContainers {
		if !strings.HasPrefix(container.Name, "clone-repo-") {
			continue
		}
		cloneContainers++
		if len(container.Command) != 3 || container.Command[2] != cloneRepoScript {
			t.Errorf("clone container %s does not run the static clone script", container.Name)
		}
		for _, arg := range append(container.Command, container.Args...) {
			for _, bot := range game.Bots {
				if strings.Contains(arg, bot.ID.String()) || strings.Contains(arg, bot.RepoURL) {
					t.Errorf("clone container %s has bot data in its command line", container.Name)
				}
			}
			if strings.Contains(arg, maliciousName) {
				t.Errorf("clone container %s has the bot name in its command line", container.Name)
			}
		}
		if !hasSecretEnv(container.Env, res.credentialsSecret.Name) {
			t.Errorf("clone container %s does not read its credentials from the secret", container.Name)
		}
		sc := container.SecurityContext
		if sc == nil || sc.RunAsUser == nil || *sc.RunAsUser == 0 || sc.RunAsNonRoot == nil || !*sc.RunAsNonRoot {
			t.Errorf("clone container %s must run as a non-root user", container.Name)
		}
		if sc == nil || sc.Capabilities == nil || len(sc.Capabilities.Drop) != 1 || sc.Capabilities.Drop[0] != "ALL" {
			t.Errorf("clone container %s must drop all capabilities", container.Name)
		}
	}
	if cloneContainers != len(game.Bots) {
		t.Fatalf("expected %d clone containers, got %d", len(game.Bots), cloneContainers)
	}

	for _, container := range append(podSpec.Containers, podSpec.InitContainers...) {
		if strings.HasPrefix(container.Name, "clone-repo-") {
			continue
		}
		if hasSecretEnv(container.Env, res.credentialsSecret.Name) {
			t.Errorf("container %s must not receive the repository credentials", container.Name)
		}
	}
	for _, volume := range podSpec.Volumes {
		if volume.Secret != nil {
			t.Errorf("volume %s mounts a secret into the pod", volume.Name)
		}
	}
}

func TestBuildGameResourcesWithoutToken(t *testing.T) {
	game := newTestGame("My Core Bot", "https://github.com/42core-team/my-core-bot.git", "")

	res, err := buildGameResources(game, "games", "https://s3.example/upload", "http://rabbit/publish")
	if err != nil {
		t.Fatalf("buildGameResources returned error: %v", err)
	}
	if res.credentialsSecret != nil {
		t.Fatal("expected no credentials secret when no bot has a token")
	}
	for _, container := range res.job.Spec.Template.Spec.InitContainers {
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				t.Errorf("container %s references a secret without a token", container.Name)
			}
			if env.Value == "http."+githubURLPrefix+".extraHeader" {
				t.Errorf("container %s configures an auth header without a token", container.Name)
			}
		}
	}
}

func TestBuildGameResourcesRejectsInvalidRepoURL(t *testing.T) {
	game := newTestGame("bot", "https://user:secret@github.com/core-org/team-repo", testToken)
	if _, err := buildGameResources(game, "games", "", ""); err == nil {
		t.Fatal("expected an error for a repository URL with credentials")
	}
}

func TestValidateRepoURL(t *testing.T) {
	valid := []string{
		"https://github.com/core-org/team-repo",
		"https://github.com/42core-team/my-core-bot.git",
		"https://github.com/a/Event-Team_1.x-0b8c0f8e-4bb0-4a43-9d26-51e1fd6fd4c3",
	}
	for _, repoURL := range valid {
		if err := validateRepoURL(repoURL); err != nil {
			t.Errorf("expected %q to be valid, got %v", repoURL, err)
		}
	}

	invalid := []string{
		"",
		"http://github.com/core-org/team-repo",
		"https://gitlab.com/core-org/team-repo",
		"https://github.com.evil.example/core-org/team-repo",
		"https://org:token@github.com/core-org/team-repo",
		"https://github.com/core-org",
		"https://github.com/core-org/team-repo/extra",
		"https://github.com/-org/team-repo",
		"https://github.com/org-/team-repo",
		"https://github.com/my--org/team-repo",
		"https://github.com/" + strings.Repeat("a", 40) + "/team-repo",
		"https://github.com/core-org/..",
		"https://github.com/core-org/team repo",
		"https://github.com/core-org/team-repo';id;'",
		"https://github.com/core-org/team-repo?x=1",
		"ext::sh -c id",
		"--upload-pack=id",
	}
	for _, repoURL := range invalid {
		if err := validateRepoURL(repoURL); err == nil {
			t.Errorf("expected %q to be rejected", repoURL)
		}
	}
}

func hasSecretEnv(env []corev1.EnvVar, secretName string) bool {
	for _, e := range env {
		if e.ValueFrom != nil && e.ValueFrom.SecretKeyRef != nil && e.ValueFrom.SecretKeyRef.Name == secretName {
			return true
		}
	}
	return false
}
