# GitHub App: local setup

Events can create team repositories through the CORE GitHub App instead of an organization token ([#798](https://github.com/42core-team/website/issues/798)). To work on this locally, register your own development App, add it to `.env.tilt`, and install it on a test organization you own.

The App is optional. Without it, the event form only offers the organization token.

Local URLs used below (see the [README](../README.md#start-the-development-environment)):

- Frontend: `http://localhost:3000`
- API: `http://localhost:4000`

## 1. Register a development App

Open [GitHub → Settings → Developer settings → GitHub Apps → New GitHub App](https://github.com/settings/apps/new) and fill in:

- **GitHub App name**: anything unique, such as `core-dev-<your-name>`. GitHub derives the App's **slug** from it: the name in `https://github.com/apps/<slug>`. The App's settings page shows the slug in its public link. You need it for `GITHUB_APP_SLUG`.
- **Homepage URL**: `http://localhost:3000`
- **Callback URL**: leave empty.
- **Request user authorization (OAuth) during installation**: leave **unchecked**. When it is checked, GitHub sends the user to the callback URL and ignores the Setup URL, so the event is never connected.
- **Setup URL**: `http://localhost:3000/github/setup`
- **Redirect on update**: checked, so reconnecting an existing installation also comes back to the Setup URL.
- **Webhook**: see [step 2](#2-webhooks). To skip webhooks, uncheck **Active**.
- **Permissions**. The API refuses an installation that lacks any of these:
  - Repository → **Administration**: Read and write
  - Repository → **Contents**: Read and write
  - Repository → **Metadata**: Read-only (GitHub selects it automatically)
  - Organization → **Members**: Read-only (Read and write also works). Used to check that the person connecting an organization owns it.
- **Where can this GitHub App be installed?**: **Any account**. An App limited to "Only on this account" can only be installed on your personal account, so GitHub shows no organization to pick.

Create the App, note the **App ID** at the top of its settings page, then under **Private keys** click **Generate a private key**. GitHub downloads a `.pem` file.

## 2. Webhooks

GitHub cannot deliver webhooks to `localhost`. Choose one:

- **No webhooks** (simplest): uncheck **Active** under Webhook and leave `GITHUB_APP_WEBHOOK_SECRET` empty. Connecting works, but changes made on GitHub are not picked up: the dashboard keeps showing an uninstalled or suspended App as connected and keeps the old name of a renamed organization. Repository operations then fail with GitHub's error until the event is reconnected.
- **Forward with [smee.io](https://smee.io)** or another tunnel:
  1. Create a channel on smee.io and use its URL as the **Webhook URL**.
  2. Set a **Webhook secret**, for example the output of `openssl rand -hex 32`, and put the same value in `GITHUB_APP_WEBHOOK_SECRET`.
  3. Under **Subscribe to events**, check **Installation target** (used for organization renames). Installation events (uninstalled, suspended, unsuspended) are always sent to Apps.
  4. Forward deliveries to the API while you work:

     ```bash
     npx smee-client --url https://smee.io/<channel> --target http://localhost:4000/github/webhook
     ```

  The endpoint answers `404` when `GITHUB_APP_WEBHOOK_SECRET` is empty and `401` when the signature does not match the secret.

## 3. Add the App to `.env.tilt`

The values go in the gitignored `.env.tilt` at the repository root (copy `.env.tilt.example` if it does not exist yet). The private key must be on a single line, so encode it with base64 (works on macOS and Linux):

```bash
base64 < your-app.private-key.pem | tr -d '\n'
```

```dotenv
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-app-slug
GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJTi...
GITHUB_APP_WEBHOOK_SECRET=the-webhook-secret
```

Tilt passes `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` to both the api and the github-service, which creates the repositories with the installation. `GITHUB_APP_SLUG` and `GITHUB_APP_WEBHOOK_SECRET` are only used by the api. `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` must be set together, otherwise both services fail to start.

Tilt watches `.env.tilt` and redeploys the api and github-service when it changes.

## 4. Try it

You need a GitHub organization you own; [create a free one](https://github.com/account/organizations/new) for testing. GitHub login must be set up as described in the [README](../README.md#oauth-setup).

1. Sign in at `http://localhost:3000` with the GitHub account that owns the test organization.
2. Create an event. With the App configured, the **GitHub Integration** section shows **Use the CORE GitHub App**, switched on by default. Leave it on.
3. On the event dashboard, click **Connect GitHub App** in the **GitHub Connection** card.
4. On GitHub, pick the test organization and install the App, on all repositories or a selection.
5. GitHub redirects to `/github/setup`, which connects the installation and returns to the dashboard. The card shows **Connected**.

To try linking an existing installation, create a second event. Its **GitHub Connection** card shows **Use \<org\>** for the test organization; click it to connect the event without going through GitHub. The card offers this for every organization you are an active owner of that already has the App installed. Personal accounts, suspended installations and installations missing permissions are not offered, and once teams have repositories only the event's own organization is. The list is cached for a minute per user, so a fresh installation can take that long to appear.

Things to know:

- The connect link carries a signed state that expires after 30 minutes and only works for the user who clicked the button. Start again from the dashboard if it expired.
- Installing the App from its public page (`https://github.com/apps/<slug>`) or from the organization's settings has no state, so `/github/setup` cannot connect anything. Open the event dashboard afterwards and click **Use \<org\>** to link the existing installation.
- The person connecting must be an owner of the organization. A member who is not an owner can only request the installation; GitHub then asks the owners to approve it, and an owner has to connect it from the dashboard afterwards.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| No toggle on the event form and no GitHub Connection card | The App is not configured: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_SLUG` is empty. Connecting returns "The CORE GitHub App is not configured on this server." |
| api or github-service does not start | `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are not both set, or the key is not a base64-encoded PEM RSA key. |
| GitHub shows no organization to install on | The App is private. Set "Where can this GitHub App be installed?" to **Any account**. |
| GitHub does not redirect back after installing | The Setup URL is missing, or "Request user authorization (OAuth) during installation" is checked. |
| "This GitHub connection link is invalid or has expired" | The state is older than 30 minutes, or a different user is signed in than the one who clicked the button. |
| "The installation on … lacks these permissions" | The installation does not have the permissions above. After changing the App's permissions, an organization owner must accept the new permissions under the organization's **Settings → GitHub Apps**. |
| "Only an owner of … can connect it to an event" | The signed-in user is not an owner of the organization. |
| No **Use \<org\>** button although the App is installed | You are not an active owner of the organization, the installation is suspended or lacks permissions, teams already have repositories in another organization, or the list is still cached (wait a minute and reload). |
| "Could not check for existing installations of the App" | GitHub could not be reached while checking ownership; click **Try again**. |
| Dashboard shows Connected after uninstalling | Webhooks are not delivered; see [step 2](#2-webhooks). |

## Deployed environments

Deployed environments use the `CORE_APP_*` GitHub environment variables and secrets instead of `.env.tilt`; see [GitHub App setup](../README.md#github-app-setup-optional) in the README.
