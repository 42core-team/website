FROM node:26

ARG TARGETARCH

# Install basic development tools
RUN apt update && apt install -y less man-db sudo

# Ensure default `node` user has access to `sudo`
ARG USERNAME=node
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Set environment variables for non-interactive installations and Go paths
ENV DEBIAN_FRONTEND=noninteractive \
    GOLANG_VERSION=1.24.2 \
    PATH=$PATH:/usr/local/go/bin

# Update package list and install necessary dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    build-essential \
    openssh-client \
    gcc \
    pkg-config \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Install Go (platform-aware)
RUN ARCH=$(dpkg --print-architecture) && \
if [ "$ARCH" = "amd64" ]; then GO_ARCH="linux-amd64"; \
elif [ "$ARCH" = "arm64" ]; then GO_ARCH="linux-arm64"; \
else echo "Unsupported architecture: $ARCH" && exit 1; fi && \
curl -fsSL https://go.dev/dl/go${GOLANG_VERSION}.${GO_ARCH}.tar.gz | tar -C /usr/local -xzf -

# Install pnpm using npm (more reliable than shell script)
RUN npm install -g pnpm

# Install kind and kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${TARGETARCH}/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl && \
    # Install kind \
    curl -Lo /usr/local/bin/kind https://kind.sigs.k8s.io/dl/latest/kind-linux-${TARGETARCH} && \
    chmod +x /usr/local/bin/kind

ENV PATH="$PATH:$(go env GOPATH)/bin"
RUN mkdir -p /gobin
ENV GOBIN=/gobin
ENV PATH=$PATH:/gobin

# Create .kube directory
RUN mkdir -p /home/node/.kube

# Make sure the node user owns the .kube directory
RUN chown -R node:node /home/node/.kube
