#!/usr/bin/env node
// Creates a development CORE GitHub App through GitHub's App manifest flow and
// writes its credentials to .env.tilt. See docs/github-app.md.
//
// Usage: node local-setup/github-app-setup.mjs [--org <login>] [--name <app name>] [--webhook-url <url>]

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(REPO_ROOT, ".env.tilt");
const FRONTEND_URL = "http://localhost:3000";
const TIMEOUT_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (!["org", "name", "webhook-url"].includes(key) || argv[i + 1] === undefined)
      throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    args[key] = argv[i + 1];
  }
  return args;
}

async function ask(question, fallback) {
  if (!process.stdin.isTTY) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer || fallback;
  } finally {
    rl.close();
  }
}

/** The App as docs/github-app.md describes it. */
function manifest({ name, redirectUrl, webhookUrl }) {
  return {
    name,
    url: FRONTEND_URL,
    redirect_url: redirectUrl,
    setup_url: `${FRONTEND_URL}/github/setup`,
    setup_on_update: true,
    request_oauth_on_install: false,
    // Installable on organizations, not only on the owner's account.
    public: true,
    default_permissions: {
      administration: "write",
      contents: "write",
      metadata: "read",
      members: "read",
    },
    ...(webhookUrl
      ? {
          hook_attributes: { url: webhookUrl, active: true },
          default_events: ["installation_target"],
        }
      : {}),
  };
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function page(title, body) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family: system-ui, sans-serif; max-width: 36rem; margin: 4rem auto; line-height: 1.5">
${body}</body>`;
}

function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer"
        : "xdg-open";
  spawn(command, [url], { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}

/** The key a .env.tilt line assigns, read the way the Tiltfile's load_env does. */
function envKey(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return null;
  return trimmed.slice(0, trimmed.indexOf("=")).trim();
}

/**
 * Sets each key in .env.tilt, starting from .env.tilt.example when it does not
 * exist. The Tiltfile uses the last assignment of a key, so each key keeps only
 * one. The file is replaced atomically and only readable by its owner, since it
 * holds the private key.
 */
function writeEnv(values) {
  const source = existsSync(ENV_FILE) ? ENV_FILE : join(REPO_ROOT, ".env.tilt.example");
  const written = new Set();
  const lines = [];
  for (const line of readFileSync(source, "utf8").split("\n")) {
    const key = envKey(line);
    if (key === null || !Object.hasOwn(values, key)) lines.push(line);
    else if (!written.has(key)) {
      lines.push(`${key}=${values[key]}`);
      written.add(key);
    }
  }
  const missing = Object.keys(values).filter((key) => !written.has(key));
  let content = lines.join("\n");
  if (missing.length) {
    if (content && !content.endsWith("\n")) content += "\n";
    content += `\n# CORE GitHub App, created by local-setup/github-app-setup.mjs\n${missing
      .map((key) => `${key}=${values[key]}`)
      .join("\n")}\n`;
  }
  const temporary = `${ENV_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, content, { mode: 0o600 });
  renameSync(temporary, ENV_FILE);
}

async function convert(code) {
  const response = await fetch(
    `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
    {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok)
    throw new Error(
      `Converting the manifest code failed with ${response.status}: ${await response.text()}`,
    );
  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.name ?? (await ask(
    `    App name (must be unique on GitHub) [core-dev-${userInfo().username}]: `,
    `core-dev-${userInfo().username}`,
  ));
  const org = args.org ?? (await ask(
    "    Organization to own the App (empty for your personal account): ",
    "",
  ));
  const webhookUrl = args["webhook-url"] ?? (await ask(
    "    Webhook proxy URL, e.g. a smee.io channel (empty to skip webhooks): ",
    "",
  ));

  const state = randomBytes(16).toString("hex");
  const createUrl = org
    ? `https://github.com/organizations/${encodeURIComponent(org)}/settings/apps/new`
    : "https://github.com/settings/apps/new";

  const done = new Promise((resolve, reject) => {
    // Only the first valid callback is converted; GitHub's code is single-use.
    let converting = false;
    const server = createServer(async (req, res) => {
      const html = (status, body) => {
        res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
        res.end(body);
      };
      const { port } = server.address();
      // Also refuses pages on other hosts that resolve to 127.0.0.1.
      if (req.headers.host !== `127.0.0.1:${port}`)
        return html(400, page("Invalid request", "<p>Unexpected host.</p>"));
      let url;
      try {
        url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      } catch {
        return html(400, page("Invalid request", "<p>Malformed URL.</p>"));
      }
      if (url.pathname === "/") {
        const body = manifest({
          name,
          redirectUrl: `http://127.0.0.1:${port}/callback`,
          webhookUrl,
        });
        return html(200, page("Create the CORE GitHub App", `
<p>Sending you to GitHub to create <b>${escapeHtml(name)}</b>…</p>
<form id="f" method="post" action="${escapeHtml(`${createUrl}?state=${state}`)}">
  <input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(body))}">
  <button>Continue to GitHub</button>
</form>
<script>document.getElementById("f").submit()</script>`));
      }
      if (url.pathname !== "/callback") return html(404, page("Not found", "<p>Not found.</p>"));
      if (url.searchParams.get("state") !== state || !url.searchParams.get("code"))
        return html(400, page("Invalid request", "<p>The state does not match. Start again from the terminal.</p>"));
      if (converting)
        return html(409, page("Already received", "<p>The App is already being set up. Check the terminal.</p>"));
      converting = true;
      try {
        const app = await convert(url.searchParams.get("code"));
        writeEnv({
          GITHUB_APP_ID: app.id,
          GITHUB_APP_SLUG: app.slug,
          GITHUB_APP_PRIVATE_KEY: Buffer.from(app.pem).toString("base64"),
          GITHUB_APP_WEBHOOK_SECRET: webhookUrl ? app.webhook_secret ?? "" : "",
        });
        html(200, page("GitHub App created", `
<p><b>${escapeHtml(app.name)}</b> was created and its credentials were written to <code>.env.tilt</code>.</p>
<p>You can close this tab and return to the terminal.</p>`));
        server.close();
        resolve(app);
      } catch (error) {
        html(502, page("Could not finish", `<p>${escapeHtml(String(error.message))}</p>`));
        server.close();
        reject(error);
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const startUrl = `http://127.0.0.1:${server.address().port}/`;
      console.log("");
      console.log(`    Opening ${startUrl} in your browser.`);
      console.log("    Click 'Create GitHub App' on GitHub to finish.");
      openBrowser(startUrl);
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for GitHub. Run 'make github-app' to try again."));
    }, TIMEOUT_MS).unref();
  });

  const app = await done;
  console.log("");
  console.log(`    Created ${app.html_url}`);
  console.log("    Wrote GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY and");
  console.log("    GITHUB_APP_WEBHOOK_SECRET to .env.tilt.");
  if (webhookUrl) {
    console.log("    Forward webhooks to the API while you work:");
    console.log(`      npx smee-client --url ${webhookUrl} --target http://localhost:4000/github/webhook`);
  }
  console.log(`    Install it on a test organization from ${FRONTEND_URL}/admin/github-installations`);
  console.log("    or an event dashboard once Tilt is running.");
}

main().catch((error) => {
  console.error(`    ERROR: ${error.message}`);
  process.exit(1);
});
