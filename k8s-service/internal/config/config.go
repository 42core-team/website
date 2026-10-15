package config

import (
	"context"
	"log"

	"github.com/joho/godotenv"
	"github.com/sethvargo/go-envconfig"
)

type Config struct {
	Addr                string  `env:"ADDR, default=:9000"`
	KubePath            *string `env:"KUBE_PATH"`
	Namespace           string  `env:"NAMESPACE, default=coregame"`
	RabbitMQ            string  `env:"RABBITMQ, default=amqp://guest:guest@localhost:5672/"`
	RabbitMQHTTP        string  `env:"RABBITMQ_HTTP, default=http://guest:guest@host.docker.internal:15672"`
	RabbitMQQueuePrefix string  `env:"RABBITMQ_QUEUE_PREFIX"`
	S3Endpoint          string  `env:"S3_ENDPOINT, required"`
	S3Region            string  `env:"S3_REGION, default=eu"`
	S3Bucket            string  `env:"S3_BUCKET, required"`
	S3AccessKeyID       string  `env:"S3_ACCESS_KEY_ID, required"`
	S3SecretKey         string  `env:"S3_SECRET_ACCESS_KEY, required"`
}

func (c *Config) QueueName(name string) string {
	return c.RabbitMQQueuePrefix + name
}

func ReadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cfg := &Config{}
	if err := envconfig.Process(context.Background(), cfg); err != nil {
		panic(err)
	}
	return cfg
}
