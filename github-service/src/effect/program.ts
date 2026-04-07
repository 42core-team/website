import { Effect, Data } from "effect";
import { FileSystem, HttpClient } from "@effect/platform";
import type { AMQPConsumeMessage as ConsumeMessage } from "@effect-messaging/amqp/AMQPConsumeMessage";
import {
  matchMessage,
  InboundMessage,
  type AddWritePermissionsMessage,
  type RemoveWritePermissionsMessage,
  type AddUserToRepositoryMessage,
  type RemoveUserFromRepositoryMessage,
  type DeleteRepositoryMessage,
  type CreateTeamRepositoryMessage,
} from "./schemas/messages";
import { decryptSecret } from "./util/crypto";
import {
  GitHubFactory,
  type GitHubApi,
  GitHubErrors,
} from "./github/gitHubClient";
import { RepoUtils } from "./repo/repoUtils";
import { RabbitMQ } from "./rabbitmq/consumer";
import { Schema } from "@effect/schema";
import { ServiceConfigConfig } from "./layers/config";

export class ParseMessageError extends Data.TaggedError("ParseMessageError")<{
  message: string;
}> {}
export class TempFolderError extends Data.TaggedError("TempFolderError")<{
  message: string;
  cause?: unknown;
}> {}

const TMP_FOLDER = "./tmp";

const parseMessage = (msg: ConsumeMessage) =>
  Effect.try({
    try: () => JSON.parse(msg.content.toString("utf8")) as unknown,
    catch: () => new ParseMessageError({ message: "Invalid JSON message" }),
  });

const ok = (pattern: string, data: Record<string, unknown>) =>
  Effect.flatMap(RabbitMQ, (mq) =>
    mq.publish(`${pattern}_done`, { success: true, ...data }),
  );

const fail = (pattern: string, error: unknown, ctx?: unknown) =>
  Effect.flatMap(RabbitMQ, (mq) =>
    mq.publish(`${pattern}_error`, {
      success: false,
      error: String(error),
      context: ctx,
    }),
  );

const resolveUsername = (
  githubId: string,
  currentUsername: string,
  gh: GitHubApi,
) =>
  Effect.gen(function* () {
    const user = yield* gh.getUserById(githubId);
    if (user.login !== currentUsername) {
      yield* Effect.log(
        `Username changed for githubId ${githubId}: ${currentUsername} -> ${user.login}`,
      );
      const mq = yield* RabbitMQ;
      yield* mq.publish("github_username_changed", {
        oldUsername: currentUsername,
        newUsername: user.login,
        newName: user.name || user.login,
        githubId,
      });
      return user.login;
    }
    return null;
  }).pipe(
    Effect.withSpan("resolveUsername", {
      attributes: {
        githubId,
        currentUsername,
      },
    }),
  );

const executeGitHubAction = (opts: {
  username: string;
  githubId: string;
  encryptedSecret: string;
  actionName: string;
  context: Record<string, unknown>;
  action: (
    username: string,
    gh: GitHubApi,
  ) => Effect.Effect<void, GitHubErrors, HttpClient.HttpClient>;
}) =>
  Effect.gen(function* () {
    const factory = yield* GitHubFactory;
    const config = yield* ServiceConfigConfig;
    const token = yield* decryptSecret(
      opts.encryptedSecret,
      config.API_SECRET_ENCRYPTION_KEY,
    );
    const gh = factory.make(token);

    yield* Effect.log(`${opts.actionName} ${JSON.stringify(opts.context)}`);

    const result = yield* Effect.catchAll(
      opts.action(opts.username, gh),
      (error) =>
        Effect.gen(function* () {
          if (opts.githubId) {
            const newUsername = yield* resolveUsername(
              opts.githubId,
              opts.username,
              gh,
            );
            if (newUsername) {
              return yield* opts.action(newUsername, gh);
            }
          }
          yield* Effect.log(
            `Failed ${opts.actionName} ${JSON.stringify(opts.context)}: ${String(error)}`,
          );
          return yield* Effect.fail(error);
        }),
    );

    yield* Effect.log(
      `Completed ${opts.actionName} ${JSON.stringify(opts.context)}`,
    );
    return result;
  }).pipe(
    Effect.withSpan("executeGitHubAction", {
      attributes: {
        actionName: opts.actionName,
        githubId: opts.githubId,
        username: opts.username,
      },
    }),
  );

const ensureDirectory = (path: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    Effect.mapError(
      fs.makeDirectory(path, { recursive: true }),
      (e) =>
        new TempFolderError({
          message: `Failed to create directory ${path}`,
          cause: e,
        }),
    ),
  );

const removeDirectory = (path: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    Effect.mapError(
      fs.remove(path, { recursive: true }),
      (e) =>
        new TempFolderError({
          message: `Failed to remove directory ${path}`,
          cause: e,
        }),
    ),
  );

const withTempFolder = <A, E, R>(
  name: string,
  use: (tempFolderPath: string) => Effect.Effect<A, E, R>,
) => {
  const tempFolderPath = `${TMP_FOLDER}/${name}-${Date.now()}`;

  const acquire = ensureDirectory(tempFolderPath).pipe(
    Effect.as(tempFolderPath),
  );

  const release = (path: string) =>
    removeDirectory(path).pipe(
      Effect.tap(() => Effect.log(`Removed temp folder ${path}`)),
      Effect.catchAll((e) =>
        Effect.log(
          `Warning: failed to remove temp folder ${path}: ${String(e)}`,
        ),
      ),
    );

  return ensureDirectory(TMP_FOLDER).pipe(
    Effect.andThen(Effect.acquireUseRelease(acquire, use, release)),
  );
};

const handleAddWritePermissions = (msg: AddWritePermissionsMessage) => {
  const d = msg.data;
  return Effect.matchEffect(
    executeGitHubAction({
      username: d.username,
      githubId: d.githubId,
      encryptedSecret: d.encryptedSecret,
      actionName: "Adding write permissions",
      context: {
        username: d.username,
        repoOwner: d.repoOwner,
        repoName: d.repoName,
      },
      action: (user, gh) =>
        gh.addWritePermission(d.repoOwner, d.repoName, user),
    }),
    {
      onFailure: (e) =>
        fail("add_write_permissions", e, {
          repoOwner: d.repoOwner,
          repoName: d.repoName,
          username: d.username,
        }),
      onSuccess: () =>
        ok("add_write_permissions", {
          repoOwner: d.repoOwner,
          repoName: d.repoName,
          username: d.username,
        }),
    },
  ).pipe(
    Effect.withSpan("github.action.add_write_permissions", {
      attributes: {
        pattern: "add_write_permissions",
        repoOwner: d.repoOwner,
        repoName: d.repoName,
        username: d.username,
        githubId: d.githubId,
      },
    }),
  );
};

const handleRemoveWritePermissions = (msg: RemoveWritePermissionsMessage) => {
  const d = msg.data;
  return Effect.matchEffect(
    executeGitHubAction({
      username: d.username,
      githubId: d.githubId,
      encryptedSecret: d.encryptedSecret,
      actionName: "Removing write permissions",
      context: {
        username: d.username,
        repoOwner: d.repoOwner,
        repoName: d.repoName,
      },
      action: (user, gh) =>
        gh.removeWritePermission(d.repoOwner, d.repoName, user),
    }),
    {
      onFailure: (e) =>
        fail("remove_write_permissions", e, {
          repoOwner: d.repoOwner,
          repoName: d.repoName,
          username: d.username,
        }),
      onSuccess: () =>
        ok("remove_write_permissions", {
          repoOwner: d.repoOwner,
          repoName: d.repoName,
          username: d.username,
        }),
    },
  ).pipe(
    Effect.withSpan("github.action.remove_write_permissions", {
      attributes: {
        pattern: "remove_write_permissions",
        repoOwner: d.repoOwner,
        repoName: d.repoName,
        username: d.username,
        githubId: d.githubId,
      },
    }),
  );
};

const handleAddUserToRepository = (msg: AddUserToRepositoryMessage) => {
  const d = msg.data;
  return Effect.gen(function* () {
    yield* executeGitHubAction({
      username: d.username,
      githubId: d.githubId,
      encryptedSecret: d.encryptedSecret,
      actionName: "Adding user to repository",
      context: {
        repositoryName: d.repositoryName,
        username: d.username,
        githubOrg: d.githubOrg,
      },
      action: (user, gh) =>
        gh.addUserToRepository(d.githubOrg, d.repositoryName, user),
    });

    yield* acceptInvitationIfToken(
      d.githubAccessToken,
      d.githubOrg,
      d.repositoryName,
      d.username,
    );

    yield* ok("add_user_to_repository", {
      githubOrg: d.githubOrg,
      repositoryName: d.repositoryName,
      username: d.username,
    });
  }).pipe(
    Effect.withSpan("github.action.add_user_to_repository", {
      attributes: {
        pattern: "add_user_to_repository",
        githubOrg: d.githubOrg,
        repositoryName: d.repositoryName,
        username: d.username,
        githubId: d.githubId,
      },
    }),
  );
};

const handleRemoveUserFromRepository = (
  msg: RemoveUserFromRepositoryMessage,
) => {
  const d = msg.data;
  return Effect.matchEffect(
    executeGitHubAction({
      username: d.username,
      githubId: d.githubId,
      encryptedSecret: d.encryptedSecret,
      actionName: "Removing user from repository",
      context: {
        repositoryName: d.repositoryName,
        username: d.username,
        githubOrg: d.githubOrg,
      },
      action: (user, gh) =>
        gh.removeUserFromRepository(d.githubOrg, d.repositoryName, user),
    }),
    {
      onFailure: (e) =>
        fail("remove_user_from_repository", e, {
          githubOrg: d.githubOrg,
          repositoryName: d.repositoryName,
          username: d.username,
        }),
      onSuccess: () =>
        ok("remove_user_from_repository", {
          githubOrg: d.githubOrg,
          repositoryName: d.repositoryName,
          username: d.username,
        }),
    },
  ).pipe(
    Effect.withSpan("github.action.remove_user_from_repository", {
      attributes: {
        pattern: "remove_user_from_repository",
        githubOrg: d.githubOrg,
        repositoryName: d.repositoryName,
        username: d.username,
        githubId: d.githubId,
      },
    }),
  );
};

const handleDeleteRepository = (msg: DeleteRepositoryMessage) => {
  const d = msg.data;

  return Effect.gen(function* () {
    const factory = yield* GitHubFactory;
    const config = yield* ServiceConfigConfig;

    const token = yield* decryptSecret(
      d.encryptedSecret,
      config.API_SECRET_ENCRYPTION_KEY,
    );
    const gh = factory.make(token);
    yield* Effect.matchEffect(
      gh.deleteRepository(d.githubOrg, d.repositoryName),
      {
        onFailure: (e) =>
          fail("delete_repository", e, {
            githubOrg: d.githubOrg,
            repositoryName: d.repositoryName,
          }),
        onSuccess: () =>
          ok("delete_repository", {
            githubOrg: d.githubOrg,
            repositoryName: d.repositoryName,
          }),
      },
    );
  }).pipe(
    Effect.withSpan("github.action.delete_repository", {
      attributes: {
        pattern: "delete_repository",
        githubOrg: d.githubOrg,
        repositoryName: d.repositoryName,
      },
    }),
  );
};

const acceptInvitationIfToken = (
  encryptedToken: string | undefined,
  githubOrg: string,
  repoName: string,
  username: string,
) => {
  if (!encryptedToken || encryptedToken.length === 0) return Effect.void;

  return Effect.gen(function* () {
    const factory = yield* GitHubFactory;
    const config = yield* ServiceConfigConfig;

    const userToken = yield* decryptSecret(
      encryptedToken,
      config.API_SECRET_ENCRYPTION_KEY,
    );
    const userGh = factory.make(userToken);
    yield* Effect.matchEffect(
      userGh.acceptRepositoryInvitationByRepo(githubOrg, repoName),
      {
        onFailure: (e) =>
          Effect.log(
            `WARN: failed to accept invitation for ${username}: ${String(e)}`,
          ),
        onSuccess: () =>
          Effect.log(
            `Accepted invitation for ${username} to ${githubOrg}/${repoName}`,
          ),
      },
    );
  });
};

const createAndPushRepo = (
  gh: GitHubApi,
  secret: string,
  d: CreateTeamRepositoryMessage["data"],
) =>
  Effect.gen(function* () {
    const repoUtils = yield* RepoUtils;
    let repoName = d.name;

    return yield* withTempFolder(d.name, (tempFolderPath) =>
      Effect.gen(function* () {
        const [teamRepo, gitRepo] = yield* Effect.all(
          [
            gh.createRepo(d.githubOrg, { name: repoName, private: true }).pipe(
              Effect.tap((repo) =>
                Effect.sync(() => {
                  repoName = repo.name;
                }),
              ),
            ),
            repoUtils.cloneMonoRepo({
              monoRepoUrl: d.monoRepoUrl,
              monoRepoVersion: d.monoRepoVersion,
              myCoreBotDockerImage: d.myCoreBotDockerImage,
              visualizerDockerImage: d.visualizerDockerImage,
              tempFolderPath,
              eventId: d.eventId,
              teamName: d.teamName,
              basePath: d.basePath,
              gameConfig: d.gameConfig,
              serverConfig: d.serverConfig,
              apiBaseUrl: d.apiBaseUrl,
              starterTemplateId: d.starterTemplateId,
            }),
          ],
          { concurrency: "unbounded" },
        );

        yield* repoUtils.pushToTeamRepo({
          teamRepo,
          decryptedGithubAccessToken: secret,
          tempFolderPath,
          gitRepo,
          basePath: d.basePath,
        });

        return repoName;
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.log(
              `Failed to clone/push for repo ${repoName}: ${String(error)}`,
            );
            yield* Effect.catchAll(
              gh.deleteRepository(d.githubOrg, repoName),
              (e) =>
                Effect.log(`Failed to cleanup repo after error: ${String(e)}`),
            );
            return yield* Effect.fail(error);
          }),
        ),
      ),
    );
  });

const addCollaborators = (
  d: CreateTeamRepositoryMessage["data"],
  repoName: string,
) =>
  Effect.all(
    d.githubUsers.map((user) =>
      Effect.gen(function* () {
        yield* Effect.log(
          `Adding user ${user.username} to repository ${repoName} in org ${d.githubOrg}`,
        );

        yield* executeGitHubAction({
          username: user.username,
          githubId: user.githubId,
          encryptedSecret: d.encryptedSecret,
          actionName: "Adding user to team repository",
          context: {
            username: user.username,
            name: repoName,
            githubOrg: d.githubOrg,
          },
          action: (u, ghInner) =>
            ghInner.addUserToRepository(d.githubOrg, repoName, u),
        });

        yield* acceptInvitationIfToken(
          user.githubAccessToken,
          d.githubOrg,
          repoName,
          user.username,
        );
      }),
    ),
    { concurrency: "unbounded" },
  );

const handleCreateTeamRepository = (msg: CreateTeamRepositoryMessage) =>
  Effect.gen(function* () {
    const d = msg.data;
    const factory = yield* GitHubFactory;
    const config = yield* ServiceConfigConfig;

    const secret = yield* decryptSecret(
      d.encryptedSecret,
      config.API_SECRET_ENCRYPTION_KEY,
    );
    const gh = factory.make(secret);
    const mq = yield* RabbitMQ;

    yield* Effect.log(
      `Creating team repository ${JSON.stringify({ name: d.name, teamName: d.teamName, githubOrg: d.githubOrg, teamId: d.teamId, apiBaseUrl: d.apiBaseUrl })}`,
    );

    const repoName = yield* createAndPushRepo(gh, secret, d);

    yield* mq.publish("repository_created", {
      repositoryName: repoName,
      teamId: d.teamId,
    });

    yield* addCollaborators(d, repoName);

    yield* Effect.log(
      `Created team repository ${JSON.stringify({ name: repoName, githubOrg: d.githubOrg, teamId: d.teamId })}`,
    );
  }).pipe(
    Effect.withSpan("github.action.create_team_repository", {
      attributes: {
        pattern: "create_team_repository",
        githubOrg: msg.data.githubOrg,
        teamId: msg.data.teamId,
        teamName: msg.data.teamName,
        repositoryName: msg.data.name,
      },
    }),
  );

export const handleMessage = (msg: ConsumeMessage) =>
  Effect.gen(function* () {
    const raw = yield* parseMessage(msg);
    const inbound = yield* Schema.decodeUnknown(InboundMessage)(raw);
    yield* Effect.log(`Received pattern=${inbound.pattern}`);

    yield* matchMessage(inbound, {
      add_write_permissions: handleAddWritePermissions,
      remove_write_permissions: handleRemoveWritePermissions,
      add_user_to_repository: handleAddUserToRepository,
      remove_user_from_repository: handleRemoveUserFromRepository,
      delete_repository: handleDeleteRepository,
      create_team_repository: handleCreateTeamRepository,
    });
  });
