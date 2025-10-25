import fs from "fs";
import path from "path";

export type Release = {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string; // ISO
  author: string | null;
};

const DATA_PATH = path.join(process.cwd(), "content/changelog/releases.json");

export function getAllReleases(): Release[] {
  if (!fs.existsSync(DATA_PATH)) return [];
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const arr: Release[] = JSON.parse(raw);
  // defensive sort (newest first)
  return arr.sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}

export function getPaginatedReleases(page: number, perPage: number) {
  const releases = getAllReleases();
  const total = releases.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const end = start + perPage;
  return {
    releases: releases.slice(start, end),
    total,
    totalPages,
    page: safePage,
    perPage,
  };
}
