import { Effect, Context, Layer, Data } from "effect";
import { FileSystem } from "@effect/platform";
import * as path from "node:path";
import * as YAML from "yaml";
import simpleGit, { type SimpleGit } from "simple-git";

export class RepoGitError extends Data.TaggedError("RepoGitError")<{
  message: string;
  cause?: unknown;
}> {}

export class RepoIOError extends Data.TaggedError("RepoIOError")<{
  message: string;
  cause?: unknown;
}> {}

export type RepoUtilsError = RepoGitError | RepoIOError;

export interface RepoUtils {
  readonly cloneMonoRepo: (opts: {
    monoRepoUrl: string;
    monoRepoVersion: string;
    myCoreBotDockerImage: string;
    visualizerDockerImage: string;
    tempFolderPath: string;
    eventId: string;
    teamName: string;
    basePath: string;
    gameConfig: string;
    serverConfig: string;
    apiBaseUrl: string;
    starterTemplateId?: string;
  }) => Effect.Effect<SimpleGit, RepoUtilsError, FileSystem.FileSystem>;

  readonly pushToTeamRepo: (opts: {
    teamRepo: { name: string; ssh_url: string; clone_url: string };
    decryptedGithubAccessToken: string;
    tempFolderPath: string;
    gitRepo: SimpleGit;
    basePath: string;
  }) => Effect.Effect<void, RepoUtilsError, FileSystem.FileSystem>;
}

export const RepoUtils = Context.GenericTag<RepoUtils>("RepoUtils");

const COREIGNORE_FILE = ".coreignore";

const tryGit = <A>(
  label: string,
  f: () => Promise<A>,
): Effect.Effect<A, RepoGitError> =>
  Effect.tryPromise({
    try: f,
    catch: (e) => new RepoGitError({ message: label, cause: e }),
  });

const fileExists = (
  fs: FileSystem.FileSystem,
  p: string,
): Effect.Effect<boolean, never> =>
  Effect.map(Effect.either(fs.stat(p)), (either) => either._tag === "Right");

const readTextFile = (
  fs: FileSystem.FileSystem,
  p: string,
): Effect.Effect<string, RepoIOError> =>
  Effect.mapError(
    Effect.map(fs.readFile(p), (uint8) => new TextDecoder().decode(uint8)),
    (e) => new RepoIOError({ message: `Failed to read ${p}`, cause: e }),
  );

const writeTextFile = (
  fs: FileSystem.FileSystem,
  p: string,
  content: string,
): Effect.Effect<void, RepoIOError> =>
  Effect.mapError(
    fs.writeFileString(p, content),
    (e) => new RepoIOError({ message: `Failed to write ${p}`, cause: e }),
  );

const removeIfExists = (
  fs: FileSystem.FileSystem,
  p: string,
): Effect.Effect<void, RepoIOError> =>
  Effect.gen(function* () {
    const exists = yield* fileExists(fs, p);
    if (exists) {
      yield* Effect.mapError(
        fs.remove(p, { recursive: true }),
        (e) => new RepoIOError({ message: `Failed to remove ${p}`, cause: e }),
      );
    }
  });

const ensureDirectory = (
  fs: FileSystem.FileSystem,
  p: string,
): Effect.Effect<void, RepoIOError> =>
  Effect.mapError(
    fs.makeDirectory(p, { recursive: true }),
    (e) =>
      new RepoIOError({ message: `Failed to create directory ${p}`, cause: e }),
  );

const initRepo = (
  fs: FileSystem.FileSystem,
  tempFolderPath: string,
  basePath: string,
): Effect.Effect<SimpleGit, RepoUtilsError> =>
  Effect.gen(function* () {
    yield* Effect.all(
      [
        removeIfExists(fs, `${tempFolderPath}/.git`),
        removeIfExists(fs, `${tempFolderPath}/${basePath}/.git`),
      ],
      { concurrency: "unbounded" },
    );
    const gitRepo = simpleGit(path.join(tempFolderPath, basePath));
    yield* tryGit("git init", () => gitRepo.init());
    return gitRepo;
  }).pipe(
    Effect.withSpan("initRepo", {
      attributes: { "temp.folder": tempFolderPath, "base.path": basePath },
    }),
  );

const updateGitignoreFromCoreignore = (
  fs: FileSystem.FileSystem,
  repoRoot: string,
) =>
  Effect.gen(function* () {
    const coreignorePath = path.join(repoRoot, COREIGNORE_FILE);
    const exists = yield* fileExists(fs, coreignorePath);
    if (!exists) return;
    const content = yield* readTextFile(fs, coreignorePath);
    const gitignorePath = path.join(repoRoot, ".gitignore");
    const existing = yield* readTextFile(fs, gitignorePath);
    yield* writeTextFile(fs, gitignorePath, existing + content);
    yield* removeIfExists(fs, coreignorePath);
    yield* Effect.log(
      `Converted .coreignore to .gitignore at ${gitignorePath}`,
    );
  }).pipe(
    Effect.withSpan("updateGitignoreFromCoreignore", {
      attributes: { "repo.root": repoRoot },
    }),
  );

const updateDevcontainerDockerCompose = (
  fs: FileSystem.FileSystem,
  repoRoot: string,
  myCoreBotDockerImage: string,
  visualizerDockerImage: string,
) =>
  Effect.gen(function* () {
    const composePath = path.join(
      repoRoot,
      ".devcontainer",
      "docker-compose.yml",
    );
    const exists = yield* fileExists(fs, composePath);
    if (!exists) {
      yield* Effect.log(
        `No .devcontainer/docker-compose.yml found at ${composePath}, skipping`,
      );
      return;
    }
    const originalContent = yield* readTextFile(fs, composePath);
    const doc = YAML.parseDocument(originalContent);
    const services = doc.get("services");
    if (!services || typeof services !== "object") {
      yield* Effect.log(`No services section in ${composePath}, skipping`);
      return;
    }
    if (YAML.isMap(services)) {
      for (const pair of services.items) {
        const serviceName = String(pair.key);
        const imageVal = doc.getIn(["services", serviceName, "image"]) as
          | string
          | undefined;
        if (!imageVal) continue;
        switch (serviceName) {
          case "my-core-bot":
            doc.setIn(["services", serviceName, "image"], myCoreBotDockerImage);
            break;
          case "visualizer":
            doc.setIn(
              ["services", serviceName, "image"],
              visualizerDockerImage,
            );
            break;
        }
      }
    }
    yield* writeTextFile(fs, composePath, doc.toString());
    yield* Effect.log(
      `Updated devcontainer docker-compose image tags at ${composePath}`,
    );
  }).pipe(
    Effect.withSpan("updateDevcontainerDockerCompose", {
      attributes: {
        "repo.root": repoRoot,
        "my-core-bot.image": myCoreBotDockerImage,
        "visualizer.image": visualizerDockerImage,
      },
    }),
  );

const updateTeamName = (
  fs: FileSystem.FileSystem,
  repoRoot: string,
  teamName: string,
) =>
  Effect.gen(function* () {
    const mainCPath = path.join(repoRoot, "my-core-bot", "src", "main.c");
    const exists = yield* fileExists(fs, mainCPath);
    if (!exists) {
      yield* Effect.log(
        `No src/main.c found at ${mainCPath}, skipping team name update`,
      );
      return;
    }
    const original = yield* readTextFile(fs, mainCPath);
    const updated = original.replaceAll("YOUR TEAM NAME HERE", teamName);
    if (updated !== original) {
      yield* writeTextFile(fs, mainCPath, updated);
      yield* Effect.log(`Replaced team name in ${mainCPath}`);
    }
  }).pipe(
    Effect.withSpan("updateTeamName", {
      attributes: { "repo.root": repoRoot },
    }),
  );

const writeJsonConfig = (
  fs: FileSystem.FileSystem,
  repoRoot: string,
  fileName: string,
  content: string,
  configType: string,
) =>
  Effect.gen(function* () {
    if (!content || content.length === 0) return;
    const configsDir = path.join(repoRoot, "configs");
    const filePath = path.join(configsDir, fileName);
    yield* ensureDirectory(fs, configsDir);
    yield* writeTextFile(fs, filePath, content);
    yield* Effect.log(`Updated ${configType} config at ${filePath}`);
  }).pipe(
    Effect.withSpan("writeJsonConfig", {
      attributes: { "repo.root": repoRoot, "config.type": configType },
    }),
  );

const updateConfigsUrls = (
  fs: FileSystem.FileSystem,
  repoRoot: string,
  eventId: string,
  apiBaseUrl: string,
  starterTemplateId?: string,
) =>
  Effect.gen(function* () {
    const scriptsToUpdate = [
      "check_update_configs.sh",
      "check_image_updates.sh",
    ];
    for (const scriptName of scriptsToUpdate) {
      const scriptPath = path.join(repoRoot, "scripts", scriptName);
      const exists = yield* fileExists(fs, scriptPath);
      if (!exists) {
        yield* Effect.log(`No scripts/${scriptName} found, skipping`);
        continue;
      }

      let eventUrl = `${apiBaseUrl}/event/${eventId}`;
      if (scriptName === "check_image_updates.sh" && starterTemplateId) {
        eventUrl = `${apiBaseUrl}/event/${eventId}/templates/${starterTemplateId}`;
      }
      const original = yield* readTextFile(fs, scriptPath);
      const updated = original.replaceAll("[[event_url]]", eventUrl);

      if (updated !== original) {
        yield* writeTextFile(fs, scriptPath, updated);
        yield* Effect.log(`Replaced [[event_url]] in ${scriptPath}`);
      }
    }
  }).pipe(
    Effect.withSpan("updateScripts", {
      attributes: { "repo.root": repoRoot },
    }),
  );

const extractFolderNameFromRepoUrl = (repoName: string): string => {
  const uuidPattern =
    /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const match = repoName.match(uuidPattern);
  return match ? repoName.replace(uuidPattern, "") : "my-core-bot";
};

const updateReadmeRepoUrl = (
  fs: FileSystem.FileSystem,
  repoRoot: string,
  repoName: string,
  sshUrl: string,
) =>
  Effect.gen(function* () {
    const readmePath = path.join(repoRoot, "README.md");
    const exists = yield* fileExists(fs, readmePath);
    if (!exists) {
      yield* Effect.log(`No README.md found at ${readmePath}, skipping`);
      return;
    }

    const original = yield* readTextFile(fs, readmePath);
    const folderName = extractFolderNameFromRepoUrl(repoName);
    let updated = original.replaceAll(
      "your-repo-url",
      sshUrl + " " + folderName,
    );

    updated = updated.replaceAll("cd my-core-bot", `cd ${folderName}`);
    if (updated !== original) {
      yield* writeTextFile(fs, readmePath, updated);
      yield* Effect.log(
        `Updated README.md with repo URL and folder name '${folderName}'`,
      );
    }
  }).pipe(
    Effect.withSpan("updateReadme", {
      attributes: { "repo.root": repoRoot },
    }),
  );

export const RepoUtilsLive = Layer.effect(
  RepoUtils,
  Effect.map(FileSystem.FileSystem, (fs) => ({
    cloneMonoRepo: (opts) =>
      Effect.gen(function* () {
        yield* Effect.log(
          `Cloning mono repo ${opts.monoRepoUrl} to ${opts.tempFolderPath}`,
        );
        const gitMono = simpleGit(opts.tempFolderPath);

        yield* tryGit("git clone", () =>
          gitMono.clone(opts.monoRepoUrl, "./", [
            "--filter=blob:none",
            "--sparse",
            "--branch",
            opts.monoRepoVersion,
            "--depth=1",
          ]),
        );

        yield* tryGit("sparse-checkout", () =>
          gitMono.raw(["sparse-checkout", "set", opts.basePath]),
        );

        const repoRoot = path.join(opts.tempFolderPath, opts.basePath);
        const [gitRepo] = yield* Effect.all(
          [
            initRepo(fs, opts.tempFolderPath, opts.basePath),
            updateGitignoreFromCoreignore(fs, repoRoot),
            updateDevcontainerDockerCompose(
              fs,
              repoRoot,
              opts.myCoreBotDockerImage,
              opts.visualizerDockerImage,
            ),
            updateTeamName(fs, repoRoot, opts.teamName),
            writeJsonConfig(
              fs,
              repoRoot,
              "game.config.json",
              opts.gameConfig,
              "game",
            ),
            writeJsonConfig(
              fs,
              repoRoot,
              "server.config.json",
              opts.serverConfig,
              "server",
            ),
            updateConfigsUrls(
              fs,
              repoRoot,
              opts.eventId,
              opts.apiBaseUrl,
              opts.starterTemplateId,
            ),
          ],
          { concurrency: "unbounded" },
        );
        return gitRepo;
      }).pipe(Effect.withSpan("cloneMonoRepo", { attributes: opts })),

    pushToTeamRepo: (opts) =>
      Effect.gen(function* () {
        const repoRoot = path.join(opts.tempFolderPath, opts.basePath);
        yield* updateReadmeRepoUrl(
          fs,
          repoRoot,
          opts.teamRepo.name,
          opts.teamRepo.ssh_url,
        );

        const authUrl = opts.teamRepo.clone_url.replace(
          "https://",
          `https://${opts.decryptedGithubAccessToken}@`,
        );
        yield* tryGit("git push", () =>
          opts.gitRepo
            .addRemote("team-repo", authUrl)
            .then(() => opts.gitRepo.add("."))
            .then(() => opts.gitRepo.commit("Initial commit"))
            .then(() => opts.gitRepo.branch(["-M", "main"]))
            .then(() => opts.gitRepo.push("team-repo", "main", ["-u"])),
        );
        yield* Effect.log(`Pushed to team-repo ${opts.teamRepo.clone_url}`);
      }).pipe(
        Effect.withSpan("pushToTeamRepo", {
          attributes: {
            "team.repo.name": opts.teamRepo.name,
            "team.repo.clone_url": opts.teamRepo.clone_url,
            "team.repo.ssh_url": opts.teamRepo.ssh_url,
            "team.repo": opts.teamRepo,
            "team.git.repo": opts.gitRepo,
          },
        }),
      ),
  })),
);
