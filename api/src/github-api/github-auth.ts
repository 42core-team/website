import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { decryptSecret } from "../common/encryption";
import { GithubAppAuth } from "./github-app-auth";
import { GithubInstallationEntity } from "./entities/github-installation.entity";

/**
 * How github-service authenticates against an event's GitHub organization: as
 * the CORE GitHub App installation, or with the organizer's encrypted token.
 * Mirrors GithubAuth in github-service/src/github-auth.ts.
 */
export type GithubAuth =
  | { kind: "installation"; installationId: number }
  | { kind: "token"; encryptedSecret: string };

/** The event has no usable GitHub credentials; the message is shown to admins. */
export class GithubNotConnectedError extends Error {}

type EventGithubCredentials = {
  githubInstallationId: string | null;
  githubOrgSecret: string | null;
};

@Injectable()
export class GithubAuthService {
  constructor(
    @InjectRepository(GithubInstallationEntity)
    private readonly installationRepository: Repository<GithubInstallationEntity>,
    private readonly githubAppAuth: GithubAppAuth,
    private readonly configService: ConfigService,
  ) {}

  /** The credentials to send to github-service; the App wins over a stored token. */
  async authFor(event: EventGithubCredentials): Promise<GithubAuth> {
    if (event.githubInstallationId) {
      const installation = await this.activeInstallation(
        event.githubInstallationId,
      );
      return {
        kind: "installation",
        installationId: installation.installationId,
      };
    }
    if (event.githubOrgSecret)
      return { kind: "token", encryptedSecret: event.githubOrgSecret };
    throw new GithubNotConnectedError(
      "GitHub is not connected for this event. Connect the CORE GitHub App in the event settings.",
    );
  }

  /**
   * A token a match pod uses to clone one team repository. With the App it can
   * only read that repository and expires within an hour.
   */
  async cloneTokenFor(
    event: EventGithubCredentials,
    repositoryName: string,
  ): Promise<string> {
    const auth = await this.authFor(event);
    if (auth.kind === "token")
      return decryptSecret(
        auth.encryptedSecret,
        this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
      );
    this.assertAppEnabled();
    const { token } = await this.githubAppAuth.createScopedToken(
      auth.installationId,
      { repositories: [repositoryName], permissions: { contents: "read" } },
    );
    return token;
  }

  private async activeInstallation(id: string) {
    this.assertAppEnabled();
    const installation = await this.installationRepository.findOneBy({ id });
    if (!installation || installation.deletedAt)
      throw new GithubNotConnectedError(
        "The CORE GitHub App was uninstalled from this event's organization. Reconnect it in the event settings.",
      );
    if (installation.suspendedAt)
      throw new GithubNotConnectedError(
        "The CORE GitHub App is suspended on this event's organization. An organization owner must unsuspend it.",
      );
    return installation;
  }

  private assertAppEnabled() {
    if (!this.githubAppAuth.isEnabled())
      throw new GithubNotConnectedError(
        "This event uses the CORE GitHub App, but the App is not configured on this server.",
      );
  }
}
