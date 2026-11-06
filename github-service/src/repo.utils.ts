import * as fs from "fs/promises";
import { simpleGit, SimpleGit } from "simple-git";
import * as path from "node:path";
import * as YAML from "yaml";
import { Logger } from "@nestjs/common";
import { GitHubRepository } from "./githubApi";
import {
  assertCheckoutInsideFolder,
  resolveInsideFolder,
  validateMonoRepoSource,
} from "./repo-validation";

/** Environment variables passed to git through simple-git's guard. */
const MONO_REPO_GIT_ENV_KEYS = ["GIT_ALLOW_PROTOCOL", "GIT_TERMINAL_PROMPT"];

/**
 * A minimal environment for cloning the mono repo: git only gets what it needs
 * (and none of this service's secrets), may only use https, and never prompts.
 */
function monoRepoGitEnv(): Record<string, string> {
  const env: Record<string, string> = {
    GIT_ALLOW_PROTOCOL: "https",
    GIT_TERMINAL_PROMPT: "0",
  };
  for (const key of [
    "PATH",
    "HOME",
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "NO_PROXY",
    "no_proxy",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

export class RepoUtils {
  // TODO: this needs to be dynamic in the future
  private readonly COREIGNORE_FILE = ".coreignore";

  private readonly logger = new Logger("RepoUtils");

  async cloneMonoRepo(
    monoRepoUrl: string,
    monoRepoVersion: string,
    myCoreBotDockerImage: string,
    visualizerDockerImage: string,
    tempFolderPath: string,
    eventId: string,
    teamName: string,
    basePath: string,
    gameConfig: string,
    serverConfig: string,
    apiBaseUrl: string,
    starterTemplateId?: string,
  ): Promise<SimpleGit> {
    validateMonoRepoSource(monoRepoUrl, monoRepoVersion, basePath);
    const repoRoot = resolveInsideFolder(tempFolderPath, basePath);

    this.logger.log(
      `Cloning mono repo ${monoRepoUrl} to temp folder ${tempFolderPath}`,
    );
    const gitMono = simpleGit({
      baseDir: tempFolderPath,
      allowEnvironment: MONO_REPO_GIT_ENV_KEYS,
    }).env(monoRepoGitEnv());
    await gitMono.raw([
      "clone",
      "--filter=blob:none",
      "--sparse",
      "--branch",
      monoRepoVersion,
      "--depth=1",
      "--",
      monoRepoUrl,
      ".",
    ]);
    await gitMono.raw(["sparse-checkout", "set", "--", basePath]);
    await assertCheckoutInsideFolder(tempFolderPath, repoRoot);

    const [gitRepo] = await Promise.all([
      this.initRepo(tempFolderPath, repoRoot),
      this.updateGitignoreFromCoreignore(repoRoot),
      this.updateDevcontainerDockerCompose(
        repoRoot,
        myCoreBotDockerImage,
        visualizerDockerImage,
      ),
      this.updateTeamName(repoRoot, teamName),
      this.writeJsonConfig(repoRoot, "game.config.json", gameConfig, "game"),
      this.writeJsonConfig(
        repoRoot,
        "server.config.json",
        serverConfig,
        "server",
      ),
      this.updateConfigsUrls(repoRoot, eventId, apiBaseUrl, starterTemplateId),
    ]);
    return gitRepo;
  }

  async pushToTeamRepo(
    teamRepo: GitHubRepository,
    decryptedGithubAccessToken: string,
    tempFolderPath: string,
    gitRepo: SimpleGit,
    basePath: string,
  ) {
    await this.updateReadmeRepoUrl(
      resolveInsideFolder(tempFolderPath, basePath),
      teamRepo.name,
      teamRepo.ssh_url,
    );

    await gitRepo.addRemote(
      "team-repo",
      teamRepo.clone_url.replace(
        "https://",
        `https://${decryptedGithubAccessToken}@`,
      ),
    );
    await gitRepo.add(".");
    await gitRepo.commit("Initial commit");

    await gitRepo.branch(["-M", "main"]);
    await gitRepo.push("team-repo", "main", ["-u"]);
    this.logger.log(
      `Pushed to team-repo ${teamRepo.clone_url} from temp folder ${tempFolderPath}`,
    );
  }

  private async initRepo(
    tempFolderPath: string,
    repoRoot: string,
  ): Promise<SimpleGit> {
    await Promise.all([
      fs.rm(path.join(tempFolderPath, ".git"), {
        recursive: true,
        force: true,
      }),
      fs.rm(path.join(repoRoot, ".git"), {
        recursive: true,
        force: true,
      }),
    ]);

    const gitRepo = simpleGit(repoRoot);
    await gitRepo.init();

    return gitRepo;
  }

  private async updateDevcontainerDockerCompose(
    repoRoot: string,
    myCoreBotDockerImage: string,
    visualizerDockerImage: string,
  ): Promise<void> {
    try {
      const composePath = path.join(
        repoRoot,
        ".devcontainer",
        "docker-compose.yml",
      );
      const exists = await fs
        .stat(composePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        this.logger.log(
          `No .devcontainer/docker-compose.yml found at ${composePath}, skipping image tag update`,
        );
        return;
      }

      const originalContent = await fs.readFile(composePath, "utf-8");

      const doc = YAML.parseDocument(originalContent);
      const services = doc.get("services");
      if (!services || typeof services !== "object") {
        this.logger.log(
          `No services section in ${composePath}, skipping image tag update`,
        );
        return;
      }

      if (YAML.isMap(services)) {
        for (const pair of services.items) {
          const serviceName = String(pair.key);
          const imageVal = doc.getIn(["services", serviceName, "image"]) as
            | string
            | undefined;
          if (!imageVal || typeof imageVal !== "string") continue;

          if (serviceName === "my-core-bot") {
            doc.setIn(["services", serviceName, "image"], myCoreBotDockerImage);
            this.logger.log(
              `Updated image for service ${serviceName} to ${myCoreBotDockerImage}`,
            );
          } else if (serviceName === "visualizer") {
            doc.setIn(
              ["services", serviceName, "image"],
              visualizerDockerImage,
            );
            this.logger.log(
              `Updated image for service ${serviceName} to ${visualizerDockerImage}`,
            );
          }
        }
      }

      const updatedContent = doc.toString();
      await fs.writeFile(composePath, updatedContent);
      this.logger.log(
        `Updated devcontainer docker-compose image tags to ${myCoreBotDockerImage} and ${visualizerDockerImage} at ${composePath}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update .devcontainer/docker-compose.yml image tags`,
        error as Error,
      );
    }
  }

  private async updateGitignoreFromCoreignore(repoRoot: string): Promise<void> {
    try {
      const coreignorePath = path.join(repoRoot, this.COREIGNORE_FILE);
      const exists = await fs
        .stat(coreignorePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) return;

      const coreIgnoreContent = await fs.readFile(coreignorePath, "utf-8");
      const gitignorePath = path.join(repoRoot, ".gitignore");
      await fs.appendFile(gitignorePath, coreIgnoreContent);
      await fs.rm(coreignorePath);
      this.logger.log(
        `Converted .coreignore to .gitignore at ${gitignorePath}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to convert .coreignore to .gitignore`,
        error as Error,
      );
    }
  }

  private extractFolderNameFromRepoUrl(repoName: string): string {
    try {
      const uuidPattern =
        /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const match = repoName.match(uuidPattern);

      if (match) {
        return repoName.replace(uuidPattern, "");
      }
      this.logger.error(
        `Failed to extract folder name from repo ${repoName} using default folder name "my-core-bot"`,
      );
      return "my-core-bot";
    } catch (error) {
      this.logger.error(
        `Failed to extract folder name from repo ${repoName} using default folder name "my-core-bot"`,
        error as Error,
      );
      return "my-core-bot";
    }
  }

  private async updateReadmeRepoUrl(
    repoRoot: string,
    repoName: string,
    sshUrl: string,
  ): Promise<void> {
    try {
      const readmePath = path.join(repoRoot, "README.md");
      const exists = await fs
        .stat(readmePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        this.logger.log(
          `No README.md found at ${readmePath}, skipping repo URL replacement`,
        );
        return;
      }

      const originalContent = await fs.readFile(readmePath, "utf-8");
      const folderName = this.extractFolderNameFromRepoUrl(repoName);

      let updatedContent = originalContent.replaceAll(
        "your-repo-url",
        sshUrl + " " + folderName,
      );
      updatedContent = updatedContent.replaceAll(
        "cd my-core-bot",
        `cd ${folderName}`,
      );

      if (updatedContent !== originalContent) {
        await fs.writeFile(readmePath, updatedContent);
        this.logger.log(
          `Replaced 'your-repo-url' with actual team repo URL and 'my-core-bot' with folder name '${folderName}' in ${readmePath}`,
        );
      } else {
        this.logger.log(
          `No occurrences of 'your-repo-url' or 'my-core-bot' found in ${readmePath}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to update README.md with team repo URL`,
        error as Error,
      );
    }
  }

  private async updateConfigsUrls(
    repoRoot: string,
    eventId: string,
    apiBaseUrl: string,
    starterTemplateId?: string,
  ): Promise<void> {
    const scriptsToUpdate = [
      "check_update_configs.sh",
      "check_image_updates.sh",
    ];

    for (const scriptName of scriptsToUpdate) {
      try {
        const scriptPath = path.join(repoRoot, "scripts", scriptName);
        const exists = await fs
          .stat(scriptPath)
          .then(() => true)
          .catch(() => false);

        if (!exists) {
          this.logger.log(
            `No scripts/${scriptName} found at ${scriptPath}, skipping url update`,
          );
          continue;
        }

        let eventUrl = `${apiBaseUrl}/event/${eventId}`;
        if (scriptName === "check_image_updates.sh" && starterTemplateId) {
          eventUrl = `${apiBaseUrl}/event/${eventId}/templates/${starterTemplateId}`;
        }

        const originalContent = await fs.readFile(scriptPath, "utf-8");

        const updatedContent = originalContent.replaceAll(
          "[[event_url]]",
          eventUrl,
        );

        if (updatedContent !== originalContent) {
          await fs.writeFile(scriptPath, updatedContent);
          this.logger.log(
            `Replaced '[[event_url]]' with '${eventUrl}' in ${scriptPath}`,
          );
        } else {
          this.logger.log(
            `No occurrence of '[[event_url]]' found in ${scriptPath}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to update config urls in ${scriptName}`,
          error as Error,
        );
      }
    }
  }

  private async updateTeamName(
    repoRoot: string,
    teamName: string,
  ): Promise<void> {
    const files = [
      path.join(repoRoot, "my-core-bot", "src", "main.c"),
      path.join(repoRoot, "my-core-bot", "main.go"),
    ];
    let foundFile = false;

    for (const filePath of files) {
      try {
        const originalContent = await fs.readFile(filePath, "utf-8");
        foundFile = true;
        const updatedContent = originalContent.replaceAll(
          "My CORE Bot",
          teamName,
        );

        if (updatedContent !== originalContent) {
          await fs.writeFile(filePath, updatedContent);
          this.logger.log(
            `Replaced 'My CORE Bot' with '${teamName}' in ${filePath}`,
          );
        } else {
          this.logger.log(
            `No occurrence of 'My CORE Bot' found in ${filePath}`,
          );
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          this.logger.error(
            `Failed to update team name in ${filePath}`,
            error as Error,
          );
        }
      }
    }

    if (!foundFile) {
      this.logger.warn(
        `No bot main file found in ${repoRoot}; checked ${files.join(", ")}`,
      );
    }
  }

  private async writeJsonConfig(
    repoRoot: string,
    fileName: string,
    content: string,
    configType: string,
  ): Promise<void> {
    if (!content || content.length === 0) return;

    try {
      const configsDir = path.join(repoRoot, "configs");
      const filePath = path.join(configsDir, fileName);

      // Ensure configs directory exists
      await fs.mkdir(configsDir, { recursive: true });

      await fs.writeFile(filePath, content);
      this.logger.log(`Updated ${configType} config at ${filePath}`);
    } catch (error) {
      this.logger.error(
        `Failed to update ${configType} config in configs/${fileName}`,
        error as Error,
      );
    }
  }
}
