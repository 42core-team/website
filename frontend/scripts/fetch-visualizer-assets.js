const fs = require("node:fs");
const path = require("node:path");

const REPO = "42core-team/monorepo";
const REF = process.env.VISUALIZER_ASSETS_REF || "dev";
const SPARSE_PATH = "visualizer/public/assets/object-svgs/units";
const OUT_DIR = path.join(
  __dirname,
  "../public/generated/visualizer/object-svgs/units",
);

function headers(accept) {
  return {
    "Accept": accept,
    "User-Agent": "coregame-frontend",
    ...(process.env.GITHUB_TOKEN
      ? { "Authorization": `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

async function fetchOk(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} from ${url}`);
  }
  return res;
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
    .filter(entry => entry?.type === "dir" && typeof entry.name === "string")
    .map(entry => entry.name);
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
  return fs.existsSync(OUT_DIR)
    && fs.readdirSync(OUT_DIR, { withFileTypes: true }).some((entry) => {
      return entry.isDirectory()
        && fs.existsSync(path.join(OUT_DIR, entry.name, "1.svg"));
    });
}

(async () => {
  try {
    const assets = await listAssetDirs();
    fs.rmSync(OUT_DIR, { recursive: true, force: true });

    for (const assetName of assets) {
      const svg = await fetchSvg(assetName);
      const destDir = path.join(OUT_DIR, assetName);
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, "1.svg"), svg);
    }

    console.log(`Fetched ${assets.length} visualizer unit asset(s).`);
  }
  catch (err) {
    console.error("Failed to fetch visualizer unit assets:", err?.message || err);
    if (hasExistingAssets()) {
      console.log("Using existing generated visualizer unit assets.");
      return;
    }
    process.exit(1);
  }
})();
