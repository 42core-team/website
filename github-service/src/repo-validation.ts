import * as fs from "fs/promises";
import * as path from "node:path";

/*
 * The mono repo URL, version and base path come from event configuration,
 * which event organizers control. The API validates them as well; these checks
 * repeat that validation right where the values are used (git arguments and
 * file system paths).
 */

/** https://github.com/<owner>/<repo>, optionally ending in .git, nothing else. */
export const GITHUB_REPO_URL_PATTERN =
  /^https:\/\/github\.com\/(?=[A-Za-z0-9-]{1,39}\/)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

/** A branch or tag name that can never be read as an option. */
export const GIT_REF_PATTERN =
  /^(?!-)(?!\/)(?!.*\/$)(?!.*\.\.)(?!.*\/\/)(?!.*\.lock$)[A-Za-z0-9._/-]{1,255}$/;

/** A relative path without "." or ".." segments, leading "/" or leading "-". */
export const REPO_RELATIVE_PATH_PATTERN =
  /^(?=.{1,255}$)(?!\.{1,2}(?:\/|$))[A-Za-z0-9._][A-Za-z0-9._-]*(?:\/(?!\.{1,2}(?:\/|$))[A-Za-z0-9._][A-Za-z0-9._-]*)*\/?$/;

export function validateMonoRepoSource(
  monoRepoUrl: string,
  monoRepoVersion: string,
  basePath: string,
): void {
  if (
    typeof monoRepoUrl !== "string" ||
    !GITHUB_REPO_URL_PATTERN.test(monoRepoUrl)
  )
    throw new Error(
      "Invalid mono repo URL: expected https://github.com/<owner>/<repo>",
    );
  if (
    typeof monoRepoVersion !== "string" ||
    !GIT_REF_PATTERN.test(monoRepoVersion)
  )
    throw new Error("Invalid mono repo version");
  if (
    typeof basePath !== "string" ||
    !REPO_RELATIVE_PATH_PATTERN.test(basePath)
  )
    throw new Error("Invalid base path");
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(".." + path.sep) &&
      !path.isAbsolute(relative))
  );
}

/**
 * Joins a relative path onto a folder and makes sure the result does not
 * leave that folder.
 */
export function resolveInsideFolder(folder: string, relativePath: string) {
  const root = path.resolve(folder);
  const resolved = path.resolve(root, relativePath);
  if (path.isAbsolute(relativePath) || !isInside(root, resolved))
    throw new Error(`Path ${relativePath} leaves ${folder}`);
  return resolved;
}

/**
 * Makes sure the checked out directory really lies inside the temp folder
 * (no symlinked parent directories) and that no symlink inside it points
 * outside of it, so files written into it cannot land elsewhere on disk.
 * Symlinks are only allowed as relative links without ".." segments.
 */
export async function assertCheckoutInsideFolder(
  folder: string,
  checkoutDir: string,
): Promise<void> {
  const [realFolder, realCheckoutDir] = await Promise.all([
    fs.realpath(folder),
    fs.realpath(checkoutDir),
  ]);
  if (!isInside(realFolder, realCheckoutDir))
    throw new Error(`Checkout ${checkoutDir} resolves outside of ${folder}`);

  const pending = [realCheckoutDir];
  while (pending.length > 0) {
    const dir = pending.pop() as string;
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const target = await fs.readlink(entryPath);
        if (path.isAbsolute(target) || target.split(/[\\/]/).includes(".."))
          throw new Error(
            `Symlink ${path.relative(realFolder, entryPath)} points outside of the checkout`,
          );
      } else if (entry.isDirectory() && entry.name !== ".git") {
        pending.push(entryPath);
      }
    }
  }
}
