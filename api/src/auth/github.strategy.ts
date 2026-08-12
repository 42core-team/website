import { BadGatewayException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserEntity } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

@Injectable()
export class GithubOAuthClient {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UserService,
  ) {}

  getAuthorizationUrl(state: string, codeChallenge: string): string {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set(
      "client_id",
      this.config.getOrThrow<string>("CLIENT_GITHUB_ID"),
    );
    url.searchParams.set(
      "redirect_uri",
      this.config.getOrThrow<string>("CALLBACK_GITHUB_URL"),
    );
    url.searchParams.set("scope", "user:email repo:invite");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async authenticate(code: string, codeVerifier: string): Promise<UserEntity> {
    const accessToken = await this.exchangeCode(code, codeVerifier);
    const profile = await this.fetchJson<GitHubUser>(
      "https://api.github.com/user",
      accessToken,
    );
    const emails = profile.email
      ? []
      : await this.fetchJson<GitHubEmail[]>(
          "https://api.github.com/user/emails",
          accessToken,
        );
    const githubId = String(profile.id);
    const email = profile.email ?? this.selectEmail(emails);
    const username = profile.login || email || githubId;
    const name = profile.name || username;

    let user = await this.users.getUserByGithubId(githubId);
    if (user) {
      await this.users.updateUser(
        user.id,
        email || user.email,
        username || user.username,
        name || user.name,
        profile.avatar_url || user.profilePicture,
        githubId,
        accessToken,
      );
      user = await this.users.getUserById(user.id);
    } else {
      user = await this.users.createUser(
        email || `${githubId}@users.noreply.github.com`,
        username,
        name,
        profile.avatar_url || "",
        githubId,
        accessToken,
        false,
      );
    }

    if (!user) {
      throw new BadGatewayException("GitHub login did not produce a user.");
    }
    return user;
  }

  private async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.getOrThrow<string>("CLIENT_GITHUB_ID"),
      client_secret: this.config.getOrThrow<string>("CLIENT_GITHUB_SECRET"),
      code,
      redirect_uri: this.config.getOrThrow<string>("CALLBACK_GITHUB_URL"),
      code_verifier: codeVerifier,
    });
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const result = (await response.json()) as {
      access_token?: string;
      error_description?: string;
    };
    if (!response.ok || !result.access_token) {
      throw new BadGatewayException(
        result.error_description || "GitHub token exchange failed.",
      );
    }
    return result.access_token;
  }

  private async fetchJson<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      throw new BadGatewayException(
        `GitHub API request failed (${response.status}).`,
      );
    }
    return (await response.json()) as T;
  }

  private selectEmail(emails: GitHubEmail[]): string | undefined {
    return (
      emails.find((email) => email.primary && email.verified)?.email ??
      emails.find((email) => email.verified)?.email
    );
  }
}
