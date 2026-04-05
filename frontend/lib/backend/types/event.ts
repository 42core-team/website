export interface EventStarterTemplate {
  id: string;
  name: string;
  basePath: string;
  myCoreBotDockerImage: string;
}

export interface Event {
  id: string;
  startDate: string;
  name: string;
  description?: string;
  location?: string;
  endDate: string;
  minTeamSize: number;
  maxTeamSize: number;
  currentRound: number;
  type?: string;
  treeFormat?: number;
  githubOrg: string;
  repoLockDate?: string;
  canCreateTeam: boolean;
  lockedAt: string | null;
  processQueue: boolean;
  monorepoUrl?: string;
  monorepoVersion?: string;
  gameServerDockerImage?: string;
  myCoreBotDockerImage?: string;
  visualizerDockerImage?: string;
  basePath?: string;
  gameConfig?: string;
  serverConfig?: string;
  isPrivate: boolean;
  githubOrgSecret?: string;
  starterTemplates?: EventStarterTemplate[];
}

export interface EventCreateParams {
  name: string;
  description?: string;
  githubOrg: string;
  githubOrgSecret: string;
  location?: string;
  startDate: number;
  endDate: number;
  minTeamSize: number;
  maxTeamSize: number;
  monorepoVersion: string;
  gameServerDockerImage: string;
  myCoreBotDockerImage: string;
  visualizerDockerImage: string;
  monorepoUrl: string;
  basePath: string;
  gameConfig: string;
  serverConfig: string;
  isPrivate: boolean;
}

export interface EventSettingsUpdate {
  canCreateTeam?: boolean;
  processQueue?: boolean;
  isPrivate?: boolean;
  name?: string;
  description?: string;
  githubOrg?: string;
  githubOrgSecret?: string;
  location?: string;
  startDate?: number;
  endDate?: number;
  minTeamSize?: number;
  maxTeamSize?: number;
  gameServerDockerImage?: string;
  myCoreBotDockerImage?: string;
  visualizerDockerImage?: string;
  monorepoUrl?: string;
  monorepoVersion?: string;
  basePath?: string;
  gameConfig?: string;
  serverConfig?: string;
}

export interface EventAdmin {
  id: string;
  username: string;
  name: string;
}
