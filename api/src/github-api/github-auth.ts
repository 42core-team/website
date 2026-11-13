import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GithubAppAuth } from "./github-app-auth";
import { GithubInstallationEntity } from "./entities/github-installation.entity";
import { isSimulatedRepository } from "./simulated-repository";

/**
 * How github-service authenticates against an event's GitHub organization: as
 * the CORE GitHub App installation. Mirrors GithubAuth in
 * github-service/src/github-auth.ts.
 */
export type GithubAuth = { installationId: number };

/**
 * Sent for seeded repositories, which github-service simulates without
 * credentials. 0 is never a valid installation, so it can never be used.
 */
const SIMULATED_AUTH: GithubAuth = { installationId: 0 };

/** The event has no usable GitHub credentials; the message is shown to admins. */
export class GithubNotConnectedError extends Error {}

type EventGithubCredentials = { githubInstallationId: string | null };

@Injectable()
export class GithubAuthService {
  constructor(
    @InjectRepository(GithubInstallationEntity)
    private readonly installationRepository: Repository<GithubInstallationEntity>,
    private readonly githubAppAuth: GithubAppAuth,
  ) {}

  /**
   * The credentials to send to github-service for operations on the given
   * repositories. Seeded test repositories need none in development.
   */
  async authFor(
    event: EventGithubCredentials,
    repositoryNames: (string | null | undefined)[] = [],
  ): Promise<GithubAuth> {
    if (
      repositoryNames.length &&
      repositoryNames.every((name) => isSimulatedRepository(name))
    )
      return SIMULATED_AUTH;
    if (!event.githubInstallationId)
      throw new GithubNotConnectedError(
        "GitHub is not connected for this event. Connect the CORE GitHub App in the event settings.",
      );
    const installation = await this.activeInstallation(
      event.githubInstallationId,
    );
    return { installationId: installation.installationId };
  }

  /**
   * A token a match pod uses to clone one team repository. It can only read
   * that repository and expires within an hour.
   */
  async cloneTokenFor(
    event: EventGithubCredentials,
    repositoryName: string,
  ): Promise<string> {
    const auth = await this.authFor(event);
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
