package queue

import (
	"errors"
	"fmt"
	"testing"

	"github.com/42core-team/website_relaunch/k8s-service/internal/kube"
	amqp "github.com/rabbitmq/amqp091-go"
)

func TestDecideAction(t *testing.T) {
	transient := errors.New("kubernetes api unavailable")
	tests := []struct {
		name  string
		err   error
		count int64
		want  deliveryAction
	}{
		{"success", nil, 0, actionAck},
		{"success after redelivery", nil, 3, actionAck},
		{"invalid game", kube.ErrInvalidGame, 0, actionReject},
		{"wrapped invalid game", fmt.Errorf("game x: %w", kube.ErrInvalidGame), 0, actionReject},
		{"transient first delivery", transient, 0, actionRequeue},
		{"transient below limit", transient, maxDeliveryCount - 1, actionRequeue},
		{"transient at limit", transient, maxDeliveryCount, actionRequeue},
		{"transient over limit", transient, maxDeliveryCount + 1, actionReject},
		{"transient far over limit", transient, 100, actionReject},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := decideAction(tt.err, tt.count); got != tt.want {
				t.Fatalf("decideAction(%v, %d) = %v, want %v", tt.err, tt.count, got, tt.want)
			}
		})
	}
}

func TestDeliveryCount(t *testing.T) {
	tests := []struct {
		name    string
		headers amqp.Table
		want    int64
	}{
		{"nil table", nil, 0},
		{"missing header", amqp.Table{"other": int64(9)}, 0},
		{"int64", amqp.Table{deliveryCountHeader: int64(4)}, 4},
		{"int32", amqp.Table{deliveryCountHeader: int32(4)}, 4},
		{"int16", amqp.Table{deliveryCountHeader: int16(4)}, 4},
		{"int", amqp.Table{deliveryCountHeader: 4}, 4},
		{"uint8", amqp.Table{deliveryCountHeader: uint8(4)}, 4},
		{"unexpected type", amqp.Table{deliveryCountHeader: "4"}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := deliveryCount(tt.headers); got != tt.want {
				t.Fatalf("deliveryCount = %d, want %d", got, tt.want)
			}
		})
	}
}
