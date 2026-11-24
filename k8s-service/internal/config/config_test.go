package config

import (
	"context"
	"testing"

	"github.com/sethvargo/go-envconfig"
)

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

func TestBotPortIsolation(t *testing.T) {
	required := map[string]string{
		"S3_ENDPOINT":          "https://s3.example",
		"S3_BUCKET":            "bucket",
		"S3_ACCESS_KEY_ID":     "id",
		"S3_SECRET_ACCESS_KEY": "secret",
	}
	for _, test := range []struct {
		value string
		set   bool
		want  bool
	}{
		{set: false, want: false},
		{value: "false", set: true, want: false},
		{value: "true", set: true, want: true},
	} {
		env := map[string]string{}
		for k, v := range required {
			env[k] = v
		}
		if test.set {
			env["BOT_PORT_ISOLATION"] = test.value
		}
		var cfg Config
		if err := envconfig.ProcessWith(context.Background(), &envconfig.Config{
			Target:   &cfg,
			Lookuper: envconfig.MapLookuper(env),
		}); err != nil {
			t.Fatalf("ProcessWith(%q): %v", test.value, err)
		}
		if cfg.BotPortIsolation != test.want {
			t.Errorf("BOT_PORT_ISOLATION=%q (set %v) gives %v, want %v", test.value, test.set, cfg.BotPortIsolation, test.want)
		}
	}
}
