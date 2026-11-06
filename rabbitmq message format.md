# RabbitMQ Message Format

This document describes the message formats used for communication with the game system via RabbitMQ.

## Starting a Game

To start a game, the API sends a message to the `game_queue` queue with the following JSON format (the k8s-service reads `data` and does not check `pattern`):

### Message Structure

```json
{
  "pattern": "new_match",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "image": "ghcr.io/42core-team/game-server:dev",
    "bots": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "image": "ghcr.io/42core-team/my-core-bot:dev",
        "repoURL": "https://github.com/my-event-org/my-team-repo",
        "repoToken": "<GitHub token with read access to repoURL>",
        "name": "My Core Bot"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "image": "ghcr.io/42core-team/my-core-bot:dev",
        "repoURL": "https://github.com/my-event-org/other-team-repo",
        "repoToken": "<GitHub token with read access to repoURL>",
        "name": "Gridmaster"
      }
    ],
    "gameConfig": "{...}",
    "serverConfig": "{...}"
  }
}
```

### Field Descriptions

- `pattern`: `"new_match"` for game initiation messages
- `data.id`: Unique identifier for the game (UUID format)
- `data.image`: Docker image for the game server
- `data.bots`: Array of bot configurations
  - `id`: Unique identifier for each bot (UUID format)
  - `image`: Docker image for the bot
  - `repoURL`: Git repository URL for the bot's source code. It must be a plain `https://github.com/<owner>/<repo>` URL and must **not** contain credentials; other URLs are rejected.
  - `repoToken`: Optional GitHub token used to clone `repoURL`. The k8s-service stores it in a per-game Kubernetes Secret owned by the game Job and exposes it only to the clone init container. Leave it out for public repositories.
  - `name`: Display name for the bot/player
- `data.gameConfig` / `data.serverConfig`: Game and server configuration JSON (as strings)

## Game Results

Game results will be published to the `game_results` queue in the following format:

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

- **Input Queue**: `game_queue` - Send game start messages here
- **Output Queue**: `game_results` - Listen for game completion results here

## Notes

- All UUIDs should be in standard UUID format
- Docker images should be fully qualified with registry, repository, and tag
- Repository URLs must be credential-free `https://github.com/<owner>/<repo>` URLs; credentials go in `repoToken`
- The system expects exactly the structure shown above for proper message processing
