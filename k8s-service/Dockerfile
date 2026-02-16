FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Generate API code from internal/api/doc.go
RUN go generate ./internal/api

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o k8s-service ./cmd/server/main.go

# Use a minimal alpine image for the final stage
FROM alpine:latest

# Add ca certificates and create non-root user
RUN apk add ca-certificates && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the binary from builder stage
COPY --from=builder /app/k8s-service /app/k8s-service

# Use non-root user
USER appuser

# Expose the application port
EXPOSE 9000

# Set the binary as the entrypoint
ENTRYPOINT ["/app/k8s-service"]