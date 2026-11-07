package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/42core-team/website_relaunch/k8s-service/internal/api"
	"github.com/42core-team/website_relaunch/k8s-service/internal/api/server"
	"github.com/42core-team/website_relaunch/k8s-service/internal/config"
	"github.com/42core-team/website_relaunch/k8s-service/internal/kube"
	"github.com/42core-team/website_relaunch/k8s-service/internal/queue"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"go.uber.org/zap"
)

// Must fit in terminationGracePeriodSeconds, together with the preStop sleep.
const shutdownTimeout = 15 * time.Second

func main() {
	logger := setupLogger()
	logger.Infoln("Starting k8s-service v2")
	cfg := config.ReadConfig()
	kubeClient, err := kube.GetKubeClient(cfg, logger)
	if err != nil {
		logger.Fatalln(err)
	}
	err = kubeClient.CreateDefaultNamespace()
	if err != nil {
		logger.Infoln(err)
	}

	// Initialize RabbitMQ connection with auto-reconnect capability
	q, err := queue.Init(cfg.RabbitMQ, logger)
	if err != nil {
		logger.Fatalln("Failed to connect to RabbitMQ:", err)
	}

	// Declare queues
	err = q.DeclareQueues()
	if err != nil {
		logger.Fatalln("Failed to declare RabbitMQ queues:", err)
	}

	// Start consuming messages
	err = q.ConsumeGameQueue(logger, kubeClient)
	if err != nil {
		logger.Fatalln("Failed to start consuming from queue:", err)
	}

	// Log connection status
	logger.Infof("RabbitMQ connection established: %v", q.ConnectionStatus())

	// Pass queue object to server for health checks
	apiServer := server.NewServer(kubeClient, q, logger)

	e := echo.New()
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	api.RegisterHandlers(e, api.NewStrictHandler(apiServer, nil))

	// Ensure clean shutdown of RabbitMQ connection
	defer func() {
		if err := q.CloseConnection(); err != nil {
			logger.Errorln("Error closing RabbitMQ connection:", err)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := serve(ctx, e, cfg.Addr); err != nil {
		logger.Fatalln("Server stopped with error:", err)
	}
}

// serve blocks until ctx is cancelled, then finishes in-flight requests.
func serve(ctx context.Context, e *echo.Echo, addr string) error {
	startConfig := echo.StartConfig{
		Address:         addr,
		GracefulTimeout: shutdownTimeout,
	}
	return startConfig.Start(ctx, e)
}

func setupLogger() *zap.SugaredLogger {
	logger, _ := zap.NewProduction()
	return logger.Sugar()
}
