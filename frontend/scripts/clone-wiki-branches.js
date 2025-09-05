const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoUrl = "https://github.com/42core-team/wiki.git";
const BRANCHES = ["season2-reloaded", "season2", "season1", "rush02"];
const BASE_DIR = path.join(__dirname, "../content/wiki");

if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

BRANCHES.forEach((branch) => {
  const targetDir = path.join(BASE_DIR, branch);
  if (fs.existsSync(targetDir)) {
    // If already cloned, fetch and checkout latest
    console.log(`Updating ${branch} in ${targetDir}...`);
    execSync("git fetch origin", { cwd: targetDir, stdio: "inherit" });
    execSync(`git checkout ${branch}`, { cwd: targetDir, stdio: "inherit" });
    execSync(`git pull origin ${branch}`, { cwd: targetDir, stdio: "inherit" });
  } else {
    // Clone the specific branch
    console.log(`Cloning ${branch} into ${targetDir}...`);
    execSync(
      `git clone --branch ${branch} --single-branch --depth 1 ${repoUrl} ${targetDir}`,
      { stdio: "inherit" },
    );
  }
});

// Fetch stable tags (no pre-release hyphen) from monorepo and copy only /wiki
function getStableTags() {
  const output = execSync(`git ls-remote --tags --refs ${MONOREPO_URL}`, {
    encoding: "utf-8",
  });
  return (
    output
      .split("\n")
      .map((line) => line.split("\t")[1])
      .filter(Boolean)
      .map((ref) => ref.replace("refs/tags/", ""))
      // Treat tags containing '-' as pre-releases and exclude them
      .filter((tag) => !tag.includes("-"))
  );
}

function copyDirContentsSync(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return false;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  if (fs.cpSync) {
    fs.cpSync(srcDir + "/", destDir, { recursive: true });
  } else {
    execSync(`cp -R "${srcDir}/." "${destDir}"`);
  }
  return true;
}

// ---- Select only newest micro per base vX.Y.Z ----
function isNumericTag(tag) {
  const norm = tag.startsWith("v") ? tag.slice(1) : tag;
  return /^\d+(?:\.\d+)*$/.test(norm);
}

function parseTagNumbers(tag) {
  const norm = tag.startsWith("v") ? tag.slice(1) : tag;
  return norm.split(".").map((n) => parseInt(n, 10) || 0);
}

function compareTagDesc(a, b) {
  const aNums = parseTagNumbers(a);
  const bNums = parseTagNumbers(b);
  const maxLen = Math.max(aNums.length, bNums.length);
  for (let i = 0; i < maxLen; i++) {
    const av = aNums[i] ?? 0;
    const bv = bNums[i] ?? 0;
    if (av !== bv) return bv - av; // descending
  }
  return 0;
}

function baseKey(tag) {
  const nums = parseTagNumbers(tag);
  const base = [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0].join(".");
  return "v" + base;
}

function pickLatestPerBase(tags) {
  const filtered = tags.filter((t) => isNumericTag(t));
  const map = new Map(); // base -> bestTag
  for (const t of filtered) {
    const base = baseKey(t);
    const current = map.get(base);
    // If there is no current best, or 't' is newer than current
    if (!current || compareTagDesc(current, t) > 0) {
      map.set(base, t);
    }
  }
  return Array.from(map.entries());
}

const TAGS = getStableTags();
const latestPerBase = pickLatestPerBase(TAGS);

latestPerBase.forEach(([base, tag]) => {
  const targetDir = path.join(BASE_DIR, base);
  if (fs.existsSync(targetDir)) {
    console.log(
      `Base ${base} already present at ${targetDir} (tag ${tag}), skipping.`,
    );
    return;
  }

  const tempDir = path.join(BASE_DIR, `.tmp-monorepo-${tag}`);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(
    `Cloning monorepo tag ${tag} (wiki only) into ${targetDir} as ${base}...`,
  );
  execSync(
    `git clone --depth 1 --filter=blob:none --sparse --branch ${tag} ${MONOREPO_URL} "${tempDir}"`,
    { stdio: "inherit" },
  );
  try {
    execSync("git sparse-checkout init --cone", {
      cwd: tempDir,
      stdio: "inherit",
    });
  } catch (_) {
    // ignore if already initialized
  }
  execSync('git sparse-checkout set "wiki"', {
    cwd: tempDir,
    stdio: "inherit",
  });

  const wikiSrc = path.join(tempDir, "wiki");
  const copied = copyDirContentsSync(wikiSrc, targetDir);
  if (!copied) {
    console.warn(`No /wiki directory found for tag ${tag}, skipping.`);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
});
