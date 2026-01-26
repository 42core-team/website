/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const axios = require("axios");

const PER_PAGE = 100;
const OUT_DIR = path.join(__dirname, "../content/changelog");
const OUT_FILE = path.join(OUT_DIR, "releases.json");

async function fetchAllReleases() {
  const base = `https://api.github.com/repos/42core-team/monorepo/releases`;
  let page = 1;
  const all = [];

  // 60 unauthenticated requests/hour. After 6000 releases, this code will start failing. Should be fine for the next few decades...
  while (true) {
    const url = `${base}?per_page=${PER_PAGE}&page=${page}`;
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "coregame-build",
        "Accept": "application/vnd.github+json",
      },
      validateStatus: s => s >= 200 && s < 500,
    });

    if (!Array.isArray(data)) {
      throw new TypeError(
        `GitHub API error (status likely 4xx/5xx). Response: ${JSON.stringify(
          data,
        ).slice(0, 200)}...`,
      );
    }

    if (data.length === 0)
      break;

    for (const r of data) {
      if (r.draft || r.prerelease)
        continue;
      all.push({
        id: r.id,
        tag_name: r.tag_name,
        name: r.name || r.tag_name,
        body: r.body || "",
        html_url: r.html_url,
        published_at: r.published_at || r.created_at,
        author: r.author?.login || null,
      });
    }

    if (data.length < PER_PAGE)
      break;
    page += 1;
  }

  all.sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );

  return all;
}

(async () => {
  try {
    const releases = await fetchAllReleases();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(releases, null, 2), "utf8");
    console.log(
      `Saved ${releases.length} release(s) to ${path.relative(
        process.cwd(),
        OUT_FILE,
      )}`,
    );
  }
  catch (err) {
    console.error("Failed to fetch releases:", err?.message || err);
    process.exit(1);
  }
})();
