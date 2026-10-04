package config

import "testing"

func TestQueueName(t *testing.T) {
	for _, test := range []struct {
		prefix string
		name   string
		want   string
	}{
		{"", "game_queue", "game_queue"},
		{"", "game_results", "game_results"},
		{"dev_", "game_queue", "dev_game_queue"},
		{"dev_", "game_results", "dev_game_results"},
	} {
		cfg := Config{RabbitMQQueuePrefix: test.prefix}
		if got := cfg.QueueName(test.name); got != test.want {
			t.Errorf("QueueName(%q) = %q, want %q", test.name, got, test.want)
		}
	}
}
