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
        "id": 418,
        "name": "YOUR TEAM NAME HERE",
        "place": 1,
        "death_reason": 1
      },
      {
        "id": 42,
        "name": "Gridmaster",
        "place": 0,
        "death_reason": 0
      }
    ],
    "version": "3.0.0",
    "game_id": "550e8400-e29b-41d4-a716-446655440000",
    "stats": { "actions_executed": 120, "damage_cores": 300 },
    "worldGeneratorSeed": "BDEHWZNBGH7Y8",
    "BOT_ID_MAPPING": {
      "418": "a3c1e6a2-5b7d-4f1e-9c2b-1d4e6f8a0b12",
      "42": "7f2d9e41-0c3b-4a8e-b6d5-3e1f2a4c6d80"
    }
  }
}
```

### Result Field Descriptions

- `pattern`: Always `"game_server"` for game completion messages
- `data.team_results`: One entry per team, in no particular order
  - `id`: Numeric team ID generated for this game, not the website team UUID
  - `name`: Team name
  - `place`: Final placement (0-based, where 0 is the winner)
  - `death_reason`: Why the team was eliminated, starting at 0: `NONE_SURVIVED`, `CORE_DESTROYED`, `DISCONNECTED`, `SPAMMED`, `DID_NOT_CONNECT`, `TIMEOUT_SENDING_DATA`, `TIMEOUT_CORE_HP`, `TIMEOUT_UNIT_HP`, `TIMEOUT_RANDOM`
- `data.version`: Replay format version
- `data.game_id`: UUID of the completed game, the website match ID
- `data.stats`: Counters for what happened during play; empty if no action ran
- `data.BOT_ID_MAPPING`: Maps each numeric `team_results` ID to the website team UUID

The website uses `game_id`, the numeric IDs, `death_reason` and `stats` to work out which side each team played on (`api/src/match/match-sides.ts`). Without them the side is stored as unknown.

The `death_reason` values are defined in `server/inc/game/ReplayEncoder.h` in the monorepo.

## Queue Names

- **Input Queue**: `game_queue` - Send game start messages here
- **Output Queue**: `game_results` - Listen for game completion results here

## Notes

- All UUIDs should be in standard UUID format
- Docker images should be fully qualified with registry, repository, and tag
- Repository URLs must be credential-free `https://github.com/<owner>/<repo>` URLs; credentials go in `repoToken`
- The system expects exactly the structure shown above for proper message processing
