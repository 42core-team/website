package kube

import (
	"bytes"
	"encoding/json"
	"strconv"
	"testing"
)

func gameContainerEnv(t *testing.T, res *gameResources, name string) string {
	t.Helper()
	for _, c := range res.job.Spec.Template.Spec.Containers {
		if c.Name != "game" {
			continue
		}
		for _, e := range c.Env {
			if e.Name == name {
				return e.Value
			}
		}
	}
	t.Fatalf("env %s not found on game container", name)
	return ""
}

func TestBuildGameResourcesBotIDsAreDistinctAndInRange(t *testing.T) {
	for i := 0; i < 2000; i++ {
		game := newTestGame("bot", "https://github.com/core-org/team-repo", testToken)
		res, err := buildGameResources(game, testNamespace, "", "", "")
		if err != nil {
			t.Fatalf("buildGameResources: %v", err)
		}

		seen := map[string]bool{}
		for _, bot := range game.Bots {
			if bot.RndID == nil {
				t.Fatal("bot has no RndID")
			}
			id := *bot.RndID
			n, err := strconv.ParseUint(id, 10, 32)
			if err != nil {
				t.Fatalf("ID %q is not a decimal uint32: %v", id, err)
			}
			if n < minBotID || n > maxBotID {
				t.Fatalf("ID %d outside [%d, %d]", n, minBotID, maxBotID)
			}
			if seen[id] {
				t.Fatalf("duplicate bot ID %s in one game", id)
			}
			seen[id] = true
		}

		var mapping map[string]string
		if err := json.Unmarshal([]byte(gameContainerEnv(t, res, "BOT_ID_MAPPING")), &mapping); err != nil {
			t.Fatalf("BOT_ID_MAPPING is not valid JSON: %v", err)
		}
		if len(mapping) != len(game.Bots) {
			t.Fatalf("BOT_ID_MAPPING has %d entries, want %d", len(mapping), len(game.Bots))
		}
		for _, bot := range game.Bots {
			if got := mapping[*bot.RndID]; got != bot.ID.String() {
				t.Fatalf("BOT_ID_MAPPING[%s] = %q, want %q", *bot.RndID, got, bot.ID.String())
			}
		}
	}
}

func TestGenerateBotIDRedrawsOnCollision(t *testing.T) {
	// Draws map to 4, 4 and 8 (v%span + minBotID), so the second draw collides.
	r := bytes.NewReader([]byte{0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 7})
	used := map[string]string{}

	first, err := generateBotID(r, used)
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	used[first] = "team-a"
	second, err := generateBotID(r, used)
	if err != nil {
		t.Fatalf("second: %v", err)
	}

	if first != "4" || second != "8" {
		t.Fatalf("got IDs %s and %s, want 4 and 8", first, second)
	}
}

func TestGenerateBotIDRejectsBiasedTail(t *testing.T) {
	// 0xFFFFFFFF lies in the rejected tail of the uint32 range and must be skipped.
	r := bytes.NewReader([]byte{0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0})

	id, err := generateBotID(r, map[string]string{})
	if err != nil {
		t.Fatalf("generateBotID: %v", err)
	}
	if id != strconv.Itoa(minBotID) {
		t.Fatalf("got %s, want %d", id, minBotID)
	}
}

func TestGenerateBotIDReturnsReaderError(t *testing.T) {
	if _, err := generateBotID(bytes.NewReader(nil), map[string]string{}); err == nil {
		t.Fatal("expected error from exhausted reader")
	}
}
