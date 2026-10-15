# RabbitMQ Message Format

This document describes the message formats used for communication with the game system via RabbitMQ.

## Starting a Game

To start a game, send a message to the configured game request queue (by default
`game_queue`) with the following JSON format:

### Message Structure

```json
{
  "pattern": "new_game",
  "data": {
    "ID": "550e8400-e29b-41d4-a716-446655440000",
    "Image": "ghcr.io/42core-team/game-server:dev",
    "Bots": [
      {
        "ID": "550e8400-e29b-41d4-a716-446655440001",
        "Image": "ghcr.io/42core-team/my-core-bot:dev",
        "RepoURL": "https://github.com/42core-team/my-core-bot.git",
        "Name": "My Core Bot"
      },
      {
        "ID": "550e8400-e29b-41d4-a716-446655440002",
        "Image": "ghcr.io/42core-team/my-core-bot:dev",
        "RepoURL": "https://github.com/42core-team/my-core-bot.git",
        "Name": "Gridmaster"
      }
    ]
  }
}
```

### Field Descriptions

- `pattern`: Always set to `"start"` for game initiation messages
- `data.ID`: Unique identifier for the game (UUID format)
- `data.Image`: Docker image for the game server
- `data.Bots`: Array of bot configurations
  - `ID`: Unique identifier for each bot (UUID format)
  - `Image`: Docker image for the bot
  - `RepoURL`: Git repository URL for the bot's source code
  - `Name`: Display name for the bot/player

## Game Results

Game results will be published to the configured game result queue (by default
`game_results`) in the following format:

```json
{
  "pattern": "game_server",
  "data": {
    "team_results": [
      {
        "id": 2,
        "name": "YOUR TEAM NAME HERE",
        "place": 1
      },
      {
        "id": 1,
        "name": "Gridmaster",
        "place": 0
      }
    ],
    "game_end_reason": 0,
    "version": "1.0.0",
    "game_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Result Field Descriptions

- `pattern`: Always `"game_result"` for game completion messages
- `data.team_results`: Array of team results ordered by performance
  - `id`: Team identifier
  - `name`: Team name
  - `place`: Final placement (0-based, where 0 is the winner)
- `data.game_end_reason`: Reason code for game termination
- `data.version`: API version
- `data.game_id`: UUID of the completed game

Look here for the game_end_reasons:
https://github.com/42core-team/even_COREnier/blob/31f3628798926ea97b99aa1939182c723f382f42/inc/game/ReplayEncoder.h#L18

## Queue Names

Set `RABBITMQ_QUEUE_PREFIX` to an empty string for production and local development,
or to `dev_` for development on a shared broker. The prefix applies to all four
queues used by the API, GitHub service, and K8s service:

| Purpose | Production | Development |
| --- | --- | --- |
| Game requests | `game_queue` | `dev_game_queue` |
| Game results | `game_results` | `dev_game_results` |
| GitHub requests | `github_service` | `dev_github_service` |
| GitHub results | `github-service-results` | `dev_github-service-results` |

The K8s service passes the resolved game result queue to each game-server job as
`RABBITMQ_RESULTS_QUEUE`. The game-server image must publish to that routing key
through the RabbitMQ default exchange. Deploy a game-server image that supports
this variable before enabling the development prefix.

## Notes

- All UUIDs should be in standard UUID format
- Docker images should be fully qualified with registry, repository, and tag
- Repository URLs should be accessible Git repositories
- The system expects exactly the structure shown above for proper message processing
