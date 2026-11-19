import {
  Body,
  Controller,
  ForbiddenException,
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
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EventService } from "../event/event.service";
import { UserId } from "../guards/UserGuard";
import { CompleteGithubInstallationDto } from "./dtos/complete-github-installation.dto";
import { LinkGithubInstallationDto } from "./dtos/link-github-installation.dto";
import { isValidWebhookSignature } from "./github-app-state";
import { GithubAppService } from "./github-app.service";

@Controller()
export class GithubAppController {
  constructor(
    private readonly githubAppService: GithubAppService,
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
  ) {}

  /** Lets the event form offer the App only where it is configured. */
  @Get("github/app")
  getAppAvailability() {
    return { available: this.githubAppService.isAvailable() };
  }

  @UseGuards(JwtAuthGuard)
  @Get("event/:id/github")
  async getStatus(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    if (!(await this.eventService.isEventAdmin(eventId, userId)))
      throw new ForbiddenException("You are not an admin of this event");
    return this.githubAppService.getStatus(eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("event/:id/github/connect")
  connect(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.githubAppService.createInstallUrl(eventId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("event/:id/github/installations")
  listInstallations(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
  ) {
    return this.githubAppService.listLinkableInstallations(eventId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("event/:id/github/installations")
  linkInstallation(
    @Param("id", new ParseUUIDPipe()) eventId: string,
    @UserId() userId: string,
    @Body() body: LinkGithubInstallationDto,
  ) {
    return this.githubAppService.linkInstallation(
      eventId,
      userId,
      body.installationId,
    );
  }

  /** Called by the frontend page that GitHub's Setup URL points to. */
  @UseGuards(JwtAuthGuard)
  @Post("github/installations")
  completeInstallation(
    @UserId() userId: string,
    @Body() body: CompleteGithubInstallationDto,
  ) {
    return this.githubAppService.completeInstallation(
      userId,
      body.installationId,
      body.state,
    );
  }

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
