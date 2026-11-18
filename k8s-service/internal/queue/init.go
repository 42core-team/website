package queue

import (
	"context"
	"sync"
	"time"

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

func (q *Queue) DeclareQueues(gameQueueName, gameResultsQueueName string) error {
	newQueue, err := q.ch.QueueDeclare(
		gameQueueName,
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
		gameResultsQueueName,
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
			// The message body carries repository tokens, so it must not be logged.
			game, err := parseGameMessage(d.Body)
			if err != nil {
				logger.Errorln("Failed to parse game message, dropping it", zap.Error(err))
				rejectMessage(logger, d)
				continue
			}
			logger.Infoln("Received game message", "gameID", game.ID.String())

			err = kubeClient.CreateGameJob(context.Background(), &game)
			count := deliveryCount(d.Headers)
			switch decideAction(err, count) {
			case actionAck:
				if err := d.Ack(false); err != nil {
					logger.Errorln("There was an error during Acknowledgement", zap.Error(err), zap.Uint64("deliveryTag", d.DeliveryTag))
				}
			case actionReject:
				// Retrying can never succeed or has been tried often enough; an
				// unacked message would block the queue (prefetch 1).
				logger.Errorln("Failed to create game job, dropping message", "gameID", game.ID.String(), "deliveryCount", count, zap.Error(err))
				rejectMessage(logger, d)
			case actionRequeue:
				logger.Errorln("Failed to create game job, requeueing message", "gameID", game.ID.String(), "deliveryCount", count, zap.Error(err))
				// Wait so a failing Kubernetes API or S3 is not hammered in a tight loop.
				time.Sleep(requeueDelay)
				if err := d.Nack(false, true); err != nil {
					logger.Errorln("There was an error during Nack", zap.Error(err), zap.Uint64("deliveryTag", d.DeliveryTag))
				}
			}
		}
		logger.Errorln("Game queue consumer stopped: deliveries channel closed, no new games will be processed")
	}()
	return nil
}

// rejectMessage nacks a delivery without requeueing it.
func rejectMessage(logger *zap.SugaredLogger, d amqp.Delivery) {
	if err := d.Nack(false, false); err != nil {
		logger.Errorln("There was an error during Nack", zap.Error(err), zap.Uint64("deliveryTag", d.DeliveryTag))
	}
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
