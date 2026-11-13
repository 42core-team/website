import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import {
  Can,
  CurrentUser,
  EventPolicy,
  param,
  Public,
  SignedIn,
} from "../authz";
import { UserEntity } from "../user/entities/user.entity";
import { CompleteGithubInstallationDto } from "./dtos/complete-github-installation.dto";
import { LinkGithubInstallationDto } from "./dtos/link-github-installation.dto";
import { isValidWebhookSignature } from "./github-app-state";
import { GithubAppService } from "./github-app.service";

@Controller()
export class GithubAppController {
  constructor(
    private readonly githubAppService: GithubAppService,
    private readonly configService: ConfigService,
  ) {}

  /** Lets the event form offer the App only where it is configured. */
  @Public()
  @Get("github/app")
  getAppAvailability() {
    return { available: this.githubAppService.isAvailable() };
  }

  @Can(EventPolicy, "administer", param("id"))
  @Get("event/:id/github")
  getStatus(@Param("id", new ParseUUIDPipe()) eventId: string) {
    return this.githubAppService.getStatus(eventId);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post("event/:id/github/connect")
  connect(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.githubAppService.createInstallUrl(eventId, user);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Get("event/:id/github/installations")
  listInstallations(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.githubAppService.listLinkableInstallations(eventId, user);
  }

  @Can(EventPolicy, "administer", param("id"))
  @Post("event/:id/github/installations")
  linkInstallation(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: LinkGithubInstallationDto,
  ) {
    return this.githubAppService.linkInstallation(
      eventId,
      user,
      body.installationId,
    );
  }

  @SignedIn()
  @Get("github/installations")
  listForCreate(@CurrentUser() user: UserEntity) {
    return this.githubAppService.listInstallations(user);
  }

  /**
   * Called by the frontend page that GitHub's Setup URL points to. The event
   * comes from the signed state, so the service checks the admin rights.
   */
  @SignedIn()
  @Post("github/installations")
  completeInstallation(
    @CurrentUser() user: UserEntity,
    @Body() body: CompleteGithubInstallationDto,
  ) {
    return this.githubAppService.completeInstallation(
      user,
      body.installationId,
      body.state,
    );
  }

  /** Authenticated by its signature, not a session. */
  @Public()
  @Post("github/webhook")
  @HttpCode(204)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-github-event") eventName: string | undefined,
    @Headers("x-hub-signature-256") signature: string | undefined,
  ) {
    const secret = this.configService.get<string>("GITHUB_APP_WEBHOOK_SECRET");
    if (!secret) throw new NotFoundException();
    if (
      !req.rawBody ||
      !isValidWebhookSignature(secret, req.rawBody, signature)
    )
      throw new UnauthorizedException("Invalid webhook signature");
    if (eventName)
      await this.githubAppService.handleWebhook(eventName, req.body ?? {});
  }
}
