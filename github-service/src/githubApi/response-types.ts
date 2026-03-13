/**
 * GitHub API Response Types
 *
 * These types represent the structure of responses from the GitHub API.
 * They are not exhaustive but cover the most common fields.
 */

/**
 * GitHub User
 */
export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub Repository
 */
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  forks_url: string;
  keys_url: string;
  collaborators_url: string;
  teams_url: string;
  hooks_url: string;
  issue_events_url: string;
  events_url: string;
  assignees_url: string;
  branches_url: string;
  tags_url: string;
  blobs_url: string;
  git_tags_url: string;
  git_refs_url: string;
  trees_url: string;
  statuses_url: string;
  languages_url: string;
  stargazers_url: string;
  contributors_url: string;
  subscribers_url: string;
  subscription_url: string;
  commits_url: string;
  git_commits_url: string;
  comments_url: string;
  issue_comment_url: string;
  contents_url: string;
  compare_url: string;
  merges_url: string;
  archive_url: string;
  downloads_url: string;
  issues_url: string;
  pulls_url: string;
  milestones_url: string;
  notifications_url: string;
  labels_url: string;
  releases_url: string;
  deployments_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
    url: string;
    node_id: string;
  } | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: string;
  default_branch: string;
  temp_clone_token: string | null;
  network_count: number;
  subscribers_count: number;
}

/**
 * GitHub Issue
 */
export interface GitHubIssue {
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: GitHubUser;
  labels: Array<{
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    default: boolean;
    description: string | null;
  }>;
  state: "open" | "closed";
  locked: boolean;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: {
    url: string;
    html_url: string;
    labels_url: string;
    id: number;
    node_id: string;
    number: number;
    title: string;
    description: string | null;
    creator: GitHubUser;
    open_issues: number;
    closed_issues: number;
    state: string;
    created_at: string;
    updated_at: string;
    due_on: string | null;
    closed_at: string | null;
  } | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
  active_lock_reason: string | null;
  body: string | null;
  reactions: {
    url: string;
    total_count: number;
    "+1": number;
    "-1": number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
  timeline_url: string;
  performed_via_github_app: unknown | null;
  state_reason: string | null;
}

/**
 * GitHub Collaborator Permission
 */
export interface GitHubCollaboratorPermission {
  permission: "admin" | "maintain" | "write" | "triage" | "read";
  role_name: string;
  user: GitHubUser;
}

/**
 * GitHub Repository Invitation
 */
export interface GitHubRepositoryInvitation {
  id: number;
  repository: GitHubRepository;
  invitee: GitHubUser;
  inviter: GitHubUser;
  permissions: "read" | "write" | "admin" | "maintain" | "triage";
  created_at: string;
  url: string;
  html_url: string;
  node_id: string;
}

/**
 * GitHub Rate Limit Response
 */
export interface GitHubRateLimit {
  resources: {
    core: {
      limit: number;
      used: number;
      remaining: number;
      reset: number;
    };
    search: {
      limit: number;
      used: number;
      remaining: number;
      reset: number;
    };
    graphql: {
      limit: number;
      used: number;
      remaining: number;
      reset: number;
    };
    integration_manifest: {
      limit: number;
      used: number;
      remaining: number;
      reset: number;
    };
    code_scanning_upload: {
      limit: number;
      used: number;
      remaining: number;
      reset: number;
    };
  };
  rate: {
    limit: number;
    used: number;
    remaining: number;
    reset: number;
  };
}
