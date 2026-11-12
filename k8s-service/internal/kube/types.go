package kube

import "github.com/google/uuid"

type GameMessage struct {
	Pattern string `json:"pattern"`
	Data    Game   `json:"data"`
}

type Game struct {
	ID           uuid.UUID `json:"id"`
	Bots         []Bot     `json:"bots"`
	Image        string    `json:"image"`
	GameConfig   string    `json:"gameConfig"`
	ServerConfig string    `json:"serverConfig"`
}

type Bot struct {
	ID    uuid.UUID `json:"id"`
	RndID *string   `json:"rndID"`
	// RepoURL is a plain https://github.com/<org>/<repo> URL without credentials.
	RepoURL string `json:"repoURL"`
	// RepoToken is the GitHub token used to clone RepoURL. It is handed to the
	// clone init container through a Kubernetes Secret and must not be logged.
	RepoToken string  `json:"repoToken,omitempty"`
	Image     string  `json:"image"`
	Name      *string `json:"name"`
}
