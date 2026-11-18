package queue

import (
	"errors"
	"time"

	"github.com/42core-team/website_relaunch/k8s-service/internal/kube"
	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	// maxDeliveryCount is the number of redeliveries after which a message
	// that keeps failing is dropped instead of requeued again.
	maxDeliveryCount int64 = 5
	// requeueDelay avoids hammering a failing Kubernetes API or S3 in a tight loop.
	requeueDelay = 5 * time.Second
	// deliveryCountHeader is set by RabbitMQ quorum queues on redeliveries.
	deliveryCountHeader = "x-delivery-count"
)

type deliveryAction int

const (
	actionAck deliveryAction = iota
	actionRequeue
	actionReject
)

// decideAction maps the result of creating the game job to what should happen
// with the delivery. deliveryCount is the number of previous redeliveries.
func decideAction(err error, deliveryCount int64) deliveryAction {
	switch {
	case err == nil:
		return actionAck
	case errors.Is(err, kube.ErrInvalidGame):
		// Retrying can never succeed.
		return actionReject
	case deliveryCount > maxDeliveryCount:
		return actionReject
	default:
		return actionRequeue
	}
}

// deliveryCount reads the x-delivery-count header, treating a missing or
// unexpected value as 0.
func deliveryCount(headers amqp.Table) int64 {
	switch v := headers[deliveryCountHeader].(type) {
	case int64:
		return v
	case int32:
		return int64(v)
	case int16:
		return int64(v)
	case int8:
		return int64(v)
	case int:
		return int64(v)
	case uint8:
		return int64(v)
	case uint16:
		return int64(v)
	case uint32:
		return int64(v)
	case uint64:
		return int64(v)
	default:
		return 0
	}
}
