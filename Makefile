.DEFAULT_GOAL := dev

.PHONY: setup-hooks dev stop cluster clean

setup-hooks: ## Configure git to use the repo's .githooks directory
	@git config core.hooksPath .githooks
	@echo "Git hooks configured (.githooks/)."

dev: setup-hooks ## Set up the cluster and .env.tilt if needed, then start Tilt
	@bash local-setup/dev-setup.sh

stop:
	k3d cluster stop core-dev

cluster: ## Create the k3d cluster without starting Tilt
	k3d cluster create --config local-setup/k3d-config.yaml

clean: ## Delete the k3d cluster
	k3d cluster delete core-dev
	@rm -f kubeconfig.yaml
