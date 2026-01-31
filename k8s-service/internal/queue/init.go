package queue

import (
	"context"
	"sync"

	"github.com/42core-team/website_relaunch/k8s-service/internal/kube"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

type Queue struct {
	conn      *amqp.Connection
	ch        *amqp.Channel
	gameQ     *amqp.Queue
	logger    *zap.SugaredLogger
	mu        sync.Mutex
	connected bool
}

// ConnectionStatus returns true if connected to RabbitMQ
func (q *Queue) ConnectionStatus() bool {
	if q.ch == nil {
		return false
	}
	return !q.ch.IsClosed()
}

func Init(url string, logger *zap.SugaredLogger) (*Queue, error) {
	queue := &Queue{
		logger:    logger,
		connected: false,
	}

	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}

	err = ch.Qos(
		1,
		0,
		false,
	)
	if err != nil {
		return nil, err
	}

	queue.conn = conn
	queue.ch = ch
	queue.connected = true

	return queue, nil
}

func (q *Queue) DeclareQueues() error {
	newQueue, err := q.ch.QueueDeclare(
		"game_queue",
		true,
		false,
		false,
		false,
		amqp.Table{
			amqp.QueueTypeArg: amqp.QueueTypeQuorum,
		})
	if err != nil {
		return err
	}
	q.gameQ = &newQueue

	_, err = q.ch.QueueDeclare(
		"game_results",
		true,
		false,
		false,
		false,
		amqp.Table{
			amqp.QueueTypeArg: amqp.QueueTypeQuorum,
		})
	if err != nil {
		return err
	}

	return nil
}

func (q *Queue) ConsumeGameQueue(logger *zap.SugaredLogger, kubeClient *kube.Client) error {
	msgs, err := q.ch.Consume(
		q.gameQ.Name,
		"",
		false,
		false,
		false,
		false,
		nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			logger.Info(string(d.Body))

			game, err := parseGameMessage(d.Body)
			if err != nil {
				logger.Errorln("Failed to parse game message", zap.Error(err))
				continue
			}

			err = kubeClient.CreateGameJob(context.Background(), &game)
			if err != nil {
				logger.Errorln("Failed to create game job", zap.Error(err))
				continue
			}

			err = d.Ack(false)
			if err != nil {
				logger.Errorln("There was an error during Acknowledgement", zap.Error(err), zap.Any("delivery", d))
			}
		}
	}()
	return nil
}

// CloseConnection cleanly closes the RabbitMQ connection
func (q *Queue) CloseConnection() error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.ch != nil {
		if err := q.ch.Close(); err != nil {
			return err
		}
	}

	if q.conn != nil {
		if err := q.conn.Close(); err != nil {
			return err
		}
	}

	q.connected = false
	return nil
}
