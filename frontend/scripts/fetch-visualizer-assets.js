const fs = require("node:fs");
const path = require("node:path");

const REPO = "42core-team/monorepo";
const REF = process.env.VISUALIZER_ASSETS_REF || "dev";
const SPARSE_PATH = "visualizer/public/assets/object-svgs/units";
const OUT_DIR = path.join(
  __dirname,
  "../public/generated/visualizer/object-svgs/units",
);
const FETCH_TIMEOUT_MS =
  Number.parseInt(process.env.VISUALIZER_ASSETS_TIMEOUT_MS || "15000", 10) ||
  15000;
const ASSET_NAME_RE = /^[A-Za-z0-9_-]+$/;

function headers(accept) {
  return {
    Accept: accept,
    "User-Agent": "coregame-frontend",
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

async function fetchOk(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} from ${url}`);
    }
    return res;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Timed out after ${FETCH_TIMEOUT_MS}ms from ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function assertSafeAssetName(assetName) {
  if (!ASSET_NAME_RE.test(assetName)) {
    throw new Error(`Unsafe visualizer asset name from GitHub: ${assetName}`);
  }

  return assetName;
}

async function listAssetDirs() {
  const url = new URL(
    `https://api.github.com/repos/${REPO}/contents/${SPARSE_PATH}`,
  );
  url.searchParams.set("ref", REF);

  const res = await fetchOk(url, {
    headers: headers("application/vnd.github+json"),
  });
  const entries = await res.json();

  if (!Array.isArray(entries)) {
    throw new TypeError("GitHub contents response was not an array");
  }

  return entries
    .filter((entry) => entry?.type === "dir" && typeof entry.name === "string")
    .map((entry) => assertSafeAssetName(entry.name));
}

async function fetchSvg(assetName) {
  const url = new URL(
    `https://api.github.com/repos/${REPO}/contents/${SPARSE_PATH}/${assetName}/1.svg`,
  );
  url.searchParams.set("ref", REF);

  const res = await fetchOk(url, {
    headers: headers("application/vnd.github.raw"),
  });

  return await res.text();
}

function hasExistingAssets() {
  return (
    fs.existsSync(OUT_DIR) &&
    fs.readdirSync(OUT_DIR, { withFileTypes: true }).some((entry) => {
      return (
        entry.isDirectory() &&
        fs.existsSync(path.join(OUT_DIR, entry.name, "1.svg"))
      );
    })
  );
}

function writeAssets(assets, svgs) {
  const parentDir = path.dirname(OUT_DIR);
  fs.mkdirSync(parentDir, { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(parentDir, ".units-"));
  const backupDir = `${OUT_DIR}.backup-${process.pid}`;

  try {
    assets.forEach((assetName, index) => {
      const destDir = path.join(tmpDir, assetName);
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, "1.svg"), svgs[index]);
    });

    fs.rmSync(backupDir, { recursive: true, force: true });
    if (fs.existsSync(OUT_DIR)) fs.renameSync(OUT_DIR, backupDir);
    fs.renameSync(tmpDir, OUT_DIR);
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (!fs.existsSync(OUT_DIR) && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, OUT_DIR);
    }
    throw err;
  }
}

(async () => {
  try {
    const assets = await listAssetDirs();
    const svgs = [];

    for (const assetName of assets) {
      svgs.push(await fetchSvg(assetName));
    }

    writeAssets(assets, svgs);

    console.log(`Fetched ${assets.length} visualizer unit asset(s).`);
  } catch (err) {
    console.error(
      "Failed to fetch visualizer unit assets:",
      err?.message || err,
    );
    if (hasExistingAssets()) {
      console.log("Using existing generated visualizer unit assets.");
      return;
    }
    process.exit(1);
  }
})();
