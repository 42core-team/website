.DEFAULT_GOAL := dev

.PHONY: dev stop cluster clean github-app

dev: ## Set up the cluster and .env.tilt if needed, then start Tilt
	@bash local-setup/dev-setup.sh

stop:
	k3d cluster stop core-dev

github-app: ## Create a development GitHub App and write its credentials to .env.tilt
	@node local-setup/github-app-setup.mjs

cluster: ## Create the k3d cluster without starting Tilt
	k3d cluster create --config local-setup/k3d-config.yaml

clean: ## Delete the k3d cluster
	k3d cluster delete core-dev
	@rm -f kubeconfig.yaml
