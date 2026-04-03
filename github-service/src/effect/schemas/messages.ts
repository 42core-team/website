import { Schema } from "@effect/schema";
import { Effect } from "effect";

function createMessage<
  Pattern extends string,
  Fields extends Schema.Struct.Fields,
>(pattern: Pattern, fields: Fields) {
  return Schema.Struct({
    pattern: Schema.Literal(pattern),
    data: Schema.Struct(fields),
  });
}

const repoInfoFields = {
  repoOwner: Schema.String,
  repoName: Schema.String,
  encryptedSecret: Schema.String,
} as const;

const GitHubUser = Schema.Struct({
  username: Schema.String,
  githubId: Schema.String,
  githubAccessToken: Schema.optional(Schema.String),
});

export const RemoveWritePermissions = createMessage(
  "remove_write_permissions",
  {
    ...repoInfoFields,
    username: Schema.String,
    githubId: Schema.String,
  },
);

export const AddWritePermissions = createMessage("add_write_permissions", {
  ...repoInfoFields,
  username: Schema.String,
  githubId: Schema.String,
});

export const AddUserToRepository = createMessage("add_user_to_repository", {
  repositoryName: Schema.String,
  githubOrg: Schema.String,
  encryptedSecret: Schema.String,
  githubAccessToken: Schema.optional(Schema.String),
  username: Schema.String,
  githubId: Schema.String,
});

export const RemoveUserFromRepository = createMessage(
  "remove_user_from_repository",
  {
    repositoryName: Schema.String,
    githubOrg: Schema.String,
    encryptedSecret: Schema.String,
    username: Schema.String,
    githubId: Schema.String,
  },
);

export const DeleteRepository = createMessage("delete_repository", {
  repositoryName: Schema.String,
  githubOrg: Schema.String,
  encryptedSecret: Schema.String,
});

export const CreateTeamRepository = createMessage("create_team_repository", {
  name: Schema.String,
  teamName: Schema.String,
  githubUsers: Schema.Array(GitHubUser),
  githubOrg: Schema.String,
  encryptedSecret: Schema.String,
  teamId: Schema.String,
  monoRepoUrl: Schema.String,
  monoRepoVersion: Schema.String,
  myCoreBotDockerImage: Schema.String,
  visualizerDockerImage: Schema.String,
  eventId: Schema.String,
  basePath: Schema.String,
  gameConfig: Schema.String,
  serverConfig: Schema.String,
  starterTemplateId: Schema.optional(Schema.String),
  apiBaseUrl: Schema.String,
});

export const InboundMessage = Schema.Union(
  RemoveWritePermissions,
  AddWritePermissions,
  AddUserToRepository,
  RemoveUserFromRepository,
  DeleteRepository,
  CreateTeamRepository,
);

export type RemoveWritePermissionsMessage = Schema.Schema.Type<
  typeof RemoveWritePermissions
>;
export type AddWritePermissionsMessage = Schema.Schema.Type<
  typeof AddWritePermissions
>;
export type AddUserToRepositoryMessage = Schema.Schema.Type<
  typeof AddUserToRepository
>;
export type RemoveUserFromRepositoryMessage = Schema.Schema.Type<
  typeof RemoveUserFromRepository
>;
export type DeleteRepositoryMessage = Schema.Schema.Type<
  typeof DeleteRepository
>;
export type CreateTeamRepositoryMessage = Schema.Schema.Type<
  typeof CreateTeamRepository
>;

export type InboundMessageType = Schema.Schema.Type<typeof InboundMessage>;

type InboundPattern = InboundMessageType["pattern"];
type MessageForPattern<P extends InboundPattern> = Extract<
  InboundMessageType,
  { pattern: P }
>;

export type MessageHandlers<A, E, R> = {
  [P in InboundPattern]: (msg: MessageForPattern<P>) => Effect.Effect<A, E, R>;
};

export const matchMessage = <A, E, R>(
  msg: InboundMessageType,
  handlers: MessageHandlers<A, E, R>,
): Effect.Effect<A, E, R> => {
  switch (msg.pattern) {
    case "remove_write_permissions":
      return handlers.remove_write_permissions(msg);
    case "add_write_permissions":
      return handlers.add_write_permissions(msg);
    case "add_user_to_repository":
      return handlers.add_user_to_repository(msg);
    case "remove_user_from_repository":
      return handlers.remove_user_from_repository(msg);
    case "delete_repository":
      return handlers.delete_repository(msg);
    case "create_team_repository":
      return handlers.create_team_repository(msg);
  }
};
