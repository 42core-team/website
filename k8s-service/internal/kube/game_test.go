package kube

import (
	"testing"

	"github.com/42core-team/website_relaunch/k8s-service/internal/config"
)

func TestGameContainerResultQueue(t *testing.T) {
	for _, test := range []struct {
		prefix string
		want   string
	}{
		{"", "game_results"},
		{"dev_", "dev_game_results"},
	} {
		client := &Client{cfg: &config.Config{RabbitMQQueuePrefix: test.prefix}}
		env := client.gameContainerEnv("game-id", "presigned-url", "{}")
		found := false
		for _, item := range env {
			if item.Name == "RABBITMQ_RESULTS_QUEUE" {
				found = true
				if item.Value != test.want {
					t.Errorf("prefix %q: result queue = %q, want %q", test.prefix, item.Value, test.want)
				}
			}
		}
		if !found {
			t.Errorf("prefix %q: game container has no RABBITMQ_RESULTS_QUEUE", test.prefix)
		}
	}
}
