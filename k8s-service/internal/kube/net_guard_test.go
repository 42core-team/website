package kube

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	corev1 "k8s.io/api/core/v1"
)

// The ID reader below yields 123456 and 654065 (v%span + minBotID).
const (
	fixedBotID0 = "123456"
	fixedBotID1 = "654065"
)

// buildFixedGame builds a two-bot game with fixed team UUIDs and bot IDs.
func buildFixedGame(t *testing.T, portIsolation bool) (*Game, *gameResources) {
	t.Helper()
	oldReader := idReader
	t.Cleanup(func() { idReader = oldReader })
	idReader = bytes.NewReader([]byte{0x00, 0x01, 0xe2, 0x3f, 0x00, 0x09, 0xfa, 0xf0})

	name := "alpha"
	game := &Game{
		ID:    uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		Image: "ghcr.io/42core-team/game-server:dev",
		Bots: []Bot{
			{
				ID:        uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
				Image:     "ghcr.io/42core-team/my-core-bot:dev",
				RepoURL:   "https://github.com/core-org/team-a",
				RepoToken: testToken,
				Name:      &name,
			},
			{
				ID:      uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
				Image:   "ghcr.io/42core-team/my-core-bot:dev",
				RepoURL: "https://github.com/core-org/team-b",
			},
		},
	}
	res, err := buildGameResources(game, testNamespace, "https://s3.example/upload", "http://rabbit/publish", "game_results", portIsolation)
	if err != nil {
		t.Fatalf("buildGameResources: %v", err)
	}
	if *game.Bots[0].RndID != fixedBotID0 || *game.Bots[1].RndID != fixedBotID1 {
		t.Fatalf("unexpected bot IDs %s and %s", *game.Bots[0].RndID, *game.Bots[1].RndID)
	}
	return game, res
}

func findContainer(t *testing.T, containers []corev1.Container, name string) *corev1.Container {
	t.Helper()
	for i := range containers {
		if containers[i].Name == name {
			return &containers[i]
		}
	}
	t.Fatalf("container %s not found", name)
	return nil
}

func netGuardCommand(t *testing.T, res *gameResources) []string {
	t.Helper()
	return findContainer(t, res.job.Spec.Template.Spec.InitContainers, "net-guard").Command
}

func TestPortIsolationGivesEachBotItsOwnUID(t *testing.T) {
	game, res := buildFixedGame(t, true)
	spec := res.job.Spec.Template.Spec

	seen := map[int64]bool{}
	for i, bot := range game.Bots {
		want := botBaseUID + int64(i)
		if seen[want] {
			t.Fatalf("uid %d used twice", want)
		}
		seen[want] = true

		botSC := findContainer(t, spec.Containers, "bot-"+bot.ID.String()).SecurityContext
		if botSC.RunAsUser == nil || *botSC.RunAsUser != want {
			t.Errorf("bot %d runs as %v, want %d", i, botSC.RunAsUser, want)
		}
		cloneSC := findContainer(t, spec.InitContainers, "clone-repo-"+bot.ID.String()).SecurityContext
		if cloneSC.RunAsUser == nil || *cloneSC.RunAsUser != want {
			t.Errorf("clone container %d runs as %v, want %d", i, cloneSC.RunAsUser, want)
		}
		if cloneSC.RunAsGroup == nil || *cloneSC.RunAsGroup != want {
			t.Errorf("clone container %d runs with group %v, want %d", i, cloneSC.RunAsGroup, want)
		}
	}
}

func TestPortIsolationSetsTeamPorts(t *testing.T) {
	_, res := buildFixedGame(t, true)
	game := findContainer(t, res.job.Spec.Template.Spec.Containers, "game")

	teamPorts := gameContainerEnv(t, res, "TEAM_PORTS")
	if want := fixedBotID0 + "=4501," + fixedBotID1 + "=4502"; teamPorts != want {
		t.Fatalf("TEAM_PORTS = %q, want %q", teamPorts, want)
	}

	var keys []string
	for _, pair := range strings.Split(teamPorts, ",") {
		key, _, ok := strings.Cut(pair, "=")
		if !ok {
			t.Fatalf("TEAM_PORTS pair %q has no '='", pair)
		}
		keys = append(keys, key)
	}
	if strings.Join(keys, " ") != strings.Join(game.Args, " ") {
		t.Errorf("TEAM_PORTS keys %v differ from the game server args %v", keys, game.Args)
	}

	var mapping map[string]string
	if err := json.Unmarshal([]byte(gameContainerEnv(t, res, "BOT_ID_MAPPING")), &mapping); err != nil {
		t.Fatalf("BOT_ID_MAPPING: %v", err)
	}
	for _, key := range keys {
		if _, ok := mapping[key]; !ok {
			t.Errorf("TEAM_PORTS key %s is not in BOT_ID_MAPPING", key)
		}
	}
}

func TestPortIsolationNetGuardScript(t *testing.T) {
	_, res := buildFixedGame(t, true)

	want := `set -eux
# Bot 0: uid 2000, game server port 4501
iptables -I OUTPUT 1 -m owner --uid-owner 2000 ! -o lo -j DROP
iptables -t nat -I OUTPUT 1 -o lo -p tcp --dport 4444 -m owner --uid-owner 2000 -j REDIRECT --to-ports 4501
iptables -I OUTPUT 2 -o lo -p tcp --dport 4502 -m owner --uid-owner 2000 -j DROP
iptables -I OUTPUT 3 -p tcp --sport 4444 -m owner --uid-owner 2000 -j DROP
iptables -I OUTPUT 4 -p tcp --sport 4501 -m owner --uid-owner 2000 -j DROP
iptables -I OUTPUT 5 -p tcp --sport 4502 -m owner --uid-owner 2000 -j DROP
ip6tables -I OUTPUT 1 -m owner --uid-owner 2000 ! -o lo -j DROP
ip6tables -I OUTPUT 2 -o lo -p tcp --dport 4444 -m owner --uid-owner 2000 -j DROP
ip6tables -I OUTPUT 3 -o lo -p tcp --dport 4502 -m owner --uid-owner 2000 -j DROP
ip6tables -I OUTPUT 4 -p tcp --sport 4444 -m owner --uid-owner 2000 -j DROP
ip6tables -I OUTPUT 5 -p tcp --sport 4501 -m owner --uid-owner 2000 -j DROP
ip6tables -I OUTPUT 6 -p tcp --sport 4502 -m owner --uid-owner 2000 -j DROP
# Bot 1: uid 2001, game server port 4502
iptables -I OUTPUT 6 -m owner --uid-owner 2001 ! -o lo -j DROP
iptables -t nat -I OUTPUT 2 -o lo -p tcp --dport 4444 -m owner --uid-owner 2001 -j REDIRECT --to-ports 4502
iptables -I OUTPUT 7 -o lo -p tcp --dport 4501 -m owner --uid-owner 2001 -j DROP
iptables -I OUTPUT 8 -p tcp --sport 4444 -m owner --uid-owner 2001 -j DROP
iptables -I OUTPUT 9 -p tcp --sport 4501 -m owner --uid-owner 2001 -j DROP
iptables -I OUTPUT 10 -p tcp --sport 4502 -m owner --uid-owner 2001 -j DROP
ip6tables -I OUTPUT 7 -m owner --uid-owner 2001 ! -o lo -j DROP
ip6tables -I OUTPUT 8 -o lo -p tcp --dport 4444 -m owner --uid-owner 2001 -j DROP
ip6tables -I OUTPUT 9 -o lo -p tcp --dport 4501 -m owner --uid-owner 2001 -j DROP
ip6tables -I OUTPUT 10 -p tcp --sport 4444 -m owner --uid-owner 2001 -j DROP
ip6tables -I OUTPUT 11 -p tcp --sport 4501 -m owner --uid-owner 2001 -j DROP
ip6tables -I OUTPUT 12 -p tcp --sport 4502 -m owner --uid-owner 2001 -j DROP
`
	cmd := netGuardCommand(t, res)
	if len(cmd) != 3 || cmd[0] != "sh" || cmd[1] != "-c" {
		t.Fatalf("unexpected net-guard command %q", cmd)
	}
	if cmd[2] != want {
		t.Errorf("net-guard script:\n%s\nwant:\n%s", cmd[2], want)
	}
}

func TestWithoutPortIsolationJobIsUnchanged(t *testing.T) {
	game, res := buildFixedGame(t, false)
	spec := res.job.Spec.Template.Spec

	for _, bot := range game.Bots {
		botSC := findContainer(t, spec.Containers, "bot-"+bot.ID.String()).SecurityContext
		if botSC.RunAsUser == nil || *botSC.RunAsUser != 2000 {
			t.Errorf("bot %s runs as %v, want 2000", bot.ID, botSC.RunAsUser)
		}
		cloneSC := findContainer(t, spec.InitContainers, "clone-repo-"+bot.ID.String()).SecurityContext
		if cloneSC.RunAsUser == nil || *cloneSC.RunAsUser != 2000 || cloneSC.RunAsGroup == nil || *cloneSC.RunAsGroup != 2000 {
			t.Errorf("clone container of %s runs as %v:%v, want 2000:2000", bot.ID, cloneSC.RunAsUser, cloneSC.RunAsGroup)
		}
	}

	// The script as it was before port isolation existed.
	wantScript := "\n\t\t\t\tset -eux;\n\t\t\t\t# Block all non-loopback egress for bot UID\n\t\t\t\tiptables -I OUTPUT 1 -m owner --uid-owner 2000 ! -o lo -j DROP;\n\t\t\t\tip6tables -I OUTPUT 1 -m owner --uid-owner 2000 ! -o lo -j DROP;\n\t\t\t"
	cmd := netGuardCommand(t, res)
	if len(cmd) != 3 || cmd[0] != "sh" || cmd[1] != "-c" || cmd[2] != wantScript {
		t.Errorf("net-guard command = %q, want sh -c %q", cmd, wantScript)
	}

	var envNames []string
	for _, e := range findContainer(t, spec.Containers, "game").Env {
		envNames = append(envNames, e.Name)
	}
	wantEnv := "GAME_ID SEND_RESULTS RABBITMQ_URL RABBITMQ_RESULTS_QUEUE S3_PRESIGNED_URL UPLOAD_REPLAY BOT_ID_MAPPING PLAYER_" + fixedBotID0 + "_NAME"
	if got := strings.Join(envNames, " "); got != wantEnv {
		t.Errorf("game env = %s, want %s", got, wantEnv)
	}
}

// TestPortIsolationChangesOnlyUIDsScriptAndTeamPorts checks that the flag
// changes nothing but the bot uids, the net-guard script and TEAM_PORTS.
func TestPortIsolationChangesOnlyUIDsScriptAndTeamPorts(t *testing.T) {
	_, off := buildFixedGame(t, false)
	_, on := buildFixedGame(t, true)

	normalize := func(res *gameResources) string {
		job := res.job.DeepCopy()
		spec := &job.Spec.Template.Spec
		for i := range spec.InitContainers {
			c := &spec.InitContainers[i]
			if c.Name == "net-guard" {
				c.Command = nil
			} else {
				c.SecurityContext.RunAsUser = nil
				c.SecurityContext.RunAsGroup = nil
			}
		}
		for i := range spec.Containers {
			c := &spec.Containers[i]
			if c.Name == "game" {
				var env []corev1.EnvVar
				for _, e := range c.Env {
					if e.Name != "TEAM_PORTS" {
						env = append(env, e)
					}
				}
				c.Env = env
			} else {
				c.SecurityContext.RunAsUser = nil
			}
		}
		out, err := json.Marshal(struct {
			Job, ConfigMap, Secret any
		}{job, res.configMap, res.credentialsSecret})
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		return string(out)
	}

	if normalize(off) != normalize(on) {
		t.Errorf("port isolation changes more than uids, net-guard script and TEAM_PORTS:\noff: %s\non:  %s", normalize(off), normalize(on))
	}
}
