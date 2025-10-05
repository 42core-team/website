package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/42core-team/website_relaunch/k8s-service/internal/config"
	"github.com/42core-team/website_relaunch/k8s-service/internal/kube"
	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

func failOnError(err error, msg string) {
	if err != nil {
		log.Panicf("%s: %s", msg, err)
	}
}

func main() {
	cfg := config.ReadConfig()

	conn, err := amqp.Dial(cfg.RabbitMQ)
	failOnError(err, "Failed to connect to RabbitMQ")
	defer conn.Close()

	ch, err := conn.Channel()
	failOnError(err, "Failed to open a channel")
	defer ch.Close()

	q, err := ch.QueueDeclare(
		"game_queue",
		true,
		false,
		false,
		false,
		amqp.Table{
			amqp.QueueTypeArg: amqp.QueueTypeQuorum,
		})
	failOnError(err, "Failed to declare a queue")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	body, err := json.Marshal(getDummyGame())
	failOnError(err, "Failed to marshal JSON")

	err = ch.PublishWithContext(ctx,
		"",     // exchange
		q.Name, // routing key
		false,  // mandatory
		false,
		amqp.Publishing{
			DeliveryMode: amqp.Persistent,
			ContentType:  "application/json",
			Body:         []byte(body),
		})
	failOnError(err, "Failed to publish a message")
	log.Printf(" [x] Sent %s", body)
}

func getDummyGame() kube.GameMessage {
	return kube.GameMessage{
		Pattern: "new_game",
		Data: kube.Game{
			ID:    uuid.New(),
			Image: "ghcr.io/42core-team/game-server:dev-046db55be141a0833096fb9d1d973d4f3dc6b375",
			Bots: []kube.Bot{
				{
					ID:      uuid.New(),
					Image:   "ghcr.io/42core-team/my-core-bot:dev-5c962b75174a38451f5003f9228ce1fa565786f2",
					RepoURL: "https://github.com/42core-team/my-core-bot.git",
					Name:    stringPtr("My Core Bot"),
				},
				{
					ID:      uuid.New(),
					Image:   "ghcr.io/42core-team/my-core-bot:dev-5c962b75174a38451f5003f9228ce1fa565786f2",
					RepoURL: "https://github.com/42core-team/my-core-bot.git",
					Name:    stringPtr("Gridmaster"),
				},
			},
		},
	}
}
