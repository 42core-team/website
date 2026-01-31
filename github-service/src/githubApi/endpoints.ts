import { GitHubApiClient } from "./client";
import {
  GitHubRepository,
  GitHubIssue,
  GitHubUser,
  GitHubCollaboratorPermission,
  GitHubRepositoryInvitation,
} from "./response-types";

/**
 * Repository-related API endpoints
 */
export class RepositoryApi {
  private client: GitHubApiClient;

  constructor(client: GitHubApiClient) {
    this.client = client;
  }

  /**
   * Get a repository by owner and repo name
   * @param owner Repository owner
   * @param repo Repository name
   * @returns Repository data
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.client.get<GitHubRepository>(`repos/${owner}/${repo}`);
  }

  /**
   * Create a new repository
   * @param options Repository creation options
   * @param org Optional organization name (if creating in an organization)
   * @returns Created repository data
   */
  async createRepo(
    options: {
      name: string;
      description?: string;
      homepage?: string;
      private?: boolean;
      has_issues?: boolean;
      has_projects?: boolean;
      has_wiki?: boolean;
      has_downloads?: boolean;
      team_id?: number;
      auto_init?: boolean;
      gitignore_template?: string;
      license_template?: string;
      allow_squash_merge?: boolean;
      allow_merge_commit?: boolean;
      allow_rebase_merge?: boolean;
      allow_auto_merge?: boolean;
      delete_branch_on_merge?: boolean;
    },
    org?: string,
  ): Promise<GitHubRepository> {
    const endpoint = org ? `orgs/${org}/repos` : "user/repos";
    return this.client.post<GitHubRepository>(endpoint, options);
  }

  /**
   * Create a new repository from a template
   * @param templateOwner Owner of the template repository
   * @param templateRepo Name of the template repository
   * @param options Repository creation options
   * @returns Created repository data
   */
  async createRepoFromTemplate(
    templateOwner: string,
    templateRepo: string,
    options: {
      owner: string;
      name: string;
      description?: string;
      private?: boolean;
      include_all_branches?: boolean;
    },
  ): Promise<GitHubRepository> {
    return this.client.post<GitHubRepository>(
      `repos/${templateOwner}/${templateRepo}/generate`,
      options,
    );
  }

  /**
   * Delete a repository
   * @param owner Repository owner (user or organization)
   * @param repo Repository name
   * @returns Void on success
   */
  async deleteRepo(owner: string, repo: string): Promise<void> {
    return this.client.delete<void>(`repos/${owner}/${repo}`);
  }

  /**
   * List repository issues
   * @param owner Repository owner
   * @param repo Repository name
   * @param options Query parameters
   * @returns List of issues
   */
  async listIssues(
    owner: string,
    repo: string,
    options: {
      state?: "open" | "closed" | "all";
      sort?: "created" | "updated" | "comments";
      direction?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<GitHubIssue[]> {
    return this.client.get<GitHubIssue[]>(`repos/${owner}/${repo}/issues`, {
      params: options,
    });
  }

  /**
   * List repository collaborators
   * @param owner Repository owner
   * @param repo Repository name
   * @param options Query parameters
   * @returns List of collaborators
   */
  async listCollaborators(
    owner: string,
    repo: string,
    options: {
      affiliation?: "outside" | "direct" | "all";
      permission?: "pull" | "push" | "admin" | "maintain" | "triage";
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<GitHubUser[]> {
    return this.client.get<GitHubUser[]>(
      `repos/${owner}/${repo}/collaborators`,
      {
        params: options,
      },
    );
  }

  /**
   * Check if a user is a collaborator
   * @param owner Repository owner
   * @param repo Repository name
   * @param username Username to check
   * @returns True if the user is a collaborator
   */
  async isCollaborator(
    owner: string,
    repo: string,
    username: string,
  ): Promise<boolean> {
    try {
      await this.client.get(`repos/${owner}/${repo}/collaborators/${username}`);
      return true;
    } catch (error) {
      // 404 means the user is not a collaborator
      return false;
    }
  }

  /**
   * Invite a collaborator to a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @param username Username to invite
   * @param permission Permission level to grant
   * @returns Repository invitation
   */
  async addCollaborator(
    owner: string,
    repo: string,
    username: string,
    permission: "pull" | "push" | "admin" | "maintain" | "triage" = "pull",
  ): Promise<GitHubRepositoryInvitation> {
    return this.client.put<GitHubRepositoryInvitation>(
      `repos/${owner}/${repo}/collaborators/${username}`,
      {
        permission,
      },
    );
  }

  /**
   * Update a collaborator's permissions
   * @param owner Repository owner
   * @param repo Repository name
   * @param username Username to update
   * @param permission New permission level
   * @returns Repository invitation or empty response if already a collaborator
   */
  async updateCollaboratorPermission(
    owner: string,
    repo: string,
    username: string,
    permission: "pull" | "push" | "admin" | "maintain" | "triage",
  ): Promise<GitHubRepositoryInvitation | void> {
    return this.client.put<GitHubRepositoryInvitation | void>(
      `repos/${owner}/${repo}/collaborators/${username}`,
      {
        permission,
      },
    );
  }

  /**
   * Remove a collaborator from a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @param username Username to remove
   * @returns Response data
   */
  async removeCollaborator(
    owner: string,
    repo: string,
    username: string,
  ): Promise<void> {
    return this.client.delete<void>(
      `repos/${owner}/${repo}/collaborators/${username}`,
    );
  }

  /**
   * Get collaborator permission level
   * @param owner Repository owner
   * @param repo Repository name
   * @param username Username to check
   * @returns Permission details
   */
  async getCollaboratorPermissionLevel(
    owner: string,
    repo: string,
    username: string,
  ): Promise<GitHubCollaboratorPermission> {
    return this.client.get<GitHubCollaboratorPermission>(
      `repos/${owner}/${repo}/collaborators/${username}/permission`,
    );
  }

  /**
   * List pending repository invitations
   * @param owner Repository owner
   * @param repo Repository name
   * @param options Query parameters
   * @returns List of repository invitations
   */
  async listInvitations(
    owner: string,
    repo: string,
    options: {
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<GitHubRepositoryInvitation[]> {
    return this.client.get<GitHubRepositoryInvitation[]>(
      `repos/${owner}/${repo}/invitations`,
      {
        params: options,
      },
    );
  }

  /**
   * Delete a repository invitation
   * @param owner Repository owner
   * @param repo Repository name
   * @param invitationId Invitation ID to delete
   * @returns Response data
   */
  async deleteInvitation(
    owner: string,
    repo: string,
    invitationId: number,
  ): Promise<void> {
    return this.client.delete<void>(
      `repos/${owner}/${repo}/invitations/${invitationId}`,
    );
  }

  /**
   * Create an issue in a repository
   * @param owner Repository owner
   * @param repo Repository name
   * @param data Issue data
   * @returns Created issue
   */
  async createIssue(
    owner: string,
    repo: string,
    data: {
      title: string;
      body?: string;
      assignees?: string[];
      labels?: string[];
    },
  ): Promise<GitHubIssue> {
    return this.client.post<GitHubIssue>(`repos/${owner}/${repo}/issues`, data);
  }
}

/**
 * User-related API endpoints
 */
export class UserApi {
  private client: GitHubApiClient;

  constructor(client: GitHubApiClient) {
    this.client = client;
  }

  /**
   * Get the authenticated user
   * @returns User data
   */
  async getAuthenticatedUser(): Promise<GitHubUser> {
    return this.client.get<GitHubUser>("user");
  }

  /**
   * Get a user by username
   * @param username GitHub username
   * @returns User data
   */
  async getUser(username: string): Promise<GitHubUser> {
    return this.client.get<GitHubUser>(`users/${username}`);
  }

  /**
   * Get a user by ID
   * @param id GitHub user ID
   * @returns User data
   */
  async getUserById(id: number | string): Promise<GitHubUser> {
    return this.client.get<GitHubUser>(`user/${id}`);
  }

  /**
   * List repositories for a user
   * @param username GitHub username
   * @param options Query parameters
   * @returns List of repositories
   */
  async listUserRepositories(
    username: string,
    options: {
      type?: "all" | "owner" | "member";
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<GitHubRepository[]> {
    return this.client.get<GitHubRepository[]>(`users/${username}/repos`, {
      params: options,
    });
  }

  /**
   * List repository invitations for the authenticated user
   * @param accessToken Optional access token to use for this request
   * @returns List of repository invitations
   */
  async listRepositoryInvitations(
    accessToken?: string,
  ): Promise<GitHubRepositoryInvitation[]> {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    return this.client.get<GitHubRepositoryInvitation[]>(
      "user/repository_invitations",
      {
        headers,
      },
    );
  }

  /**
   * Accept a repository invitation
   * @param invitationId Invitation ID to accept
   * @param accessToken Optional access token to use for this request
   * @returns Response data
   */
  async acceptRepositoryInvitation(
    invitationId: number,
    accessToken?: string,
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    return this.client.patch<void>(
      `user/repository_invitations/${invitationId}`,
      {},
      {
        headers,
      },
    );
  }

  /**
   * Decline a repository invitation
   * @param invitationId Invitation ID to decline
   * @param accessToken Optional access token to use for this request
   * @returns Response data
   */
  async declineRepositoryInvitation(
    invitationId: number,
    accessToken?: string,
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    return this.client.delete<void>(
      `user/repository_invitations/${invitationId}`,
      {
        headers,
      },
    );
  }

  /**
   * Accept all pending repository invitations for the authenticated user
   * @param accessToken Optional access token to use for this request
   * @returns Number of accepted invitations
   */
  async acceptAllRepositoryInvitations(accessToken?: string): Promise<number> {
    const invitations = await this.listRepositoryInvitations(accessToken);

    if (invitations.length === 0) {
      return 0;
    }

    const acceptPromises = invitations.map((invitation) =>
      this.acceptRepositoryInvitation(invitation.id, accessToken),
    );

    await Promise.all(acceptPromises);
    return invitations.length;
  }

  /**
   * Find and accept a specific repository invitation by repository name
   * @param owner Repository owner
   * @param repo Repository name
   * @param accessToken Optional access token to use for this request
   * @returns True if invitation was found and accepted, false otherwise
   */
  async acceptRepositoryInvitationByRepo(
    owner: string,
    repo: string,
    accessToken?: string,
  ): Promise<boolean> {
    const invitations = await this.listRepositoryInvitations(accessToken);

    const invitation = invitations.find(
      (inv) =>
        inv.repository.owner.login.toLowerCase() === owner.toLowerCase() &&
        inv.repository.name.toLowerCase() === repo.toLowerCase(),
    );

    if (invitation) {
      await this.acceptRepositoryInvitation(invitation.id, accessToken);
      return true;
    }

    return false;
  }
}
