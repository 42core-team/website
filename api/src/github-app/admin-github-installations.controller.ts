import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { Can, CurrentUser, PlatformPolicy } from "../authz";
import { UserEntity } from "../user/entities/user.entity";
import { GithubAppService } from "./github-app.service";

/** Sharing installations so event creators can link them without owning them. */
@Controller("admin/github-installations")
@Can(PlatformPolicy, "manageSharedInstallations")
export class AdminGithubInstallationsController {
  constructor(private readonly githubAppService: GithubAppService) {}

  @Get()
  list() {
    return this.githubAppService.listForAdmin();
  }

  @Get(":id")
  detail(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.githubAppService.getAdminDetail(id);
  }

  /** Installing the App on an organization outside any event. */
  @Post("install")
  @HttpCode(200)
  install(@CurrentUser() user: UserEntity) {
    return this.githubAppService.createAdminInstallUrl(user);
  }

  @Post(":id/share")
  @HttpCode(200)
  share(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.githubAppService.share(id, user);
  }

  @Delete(":id/share")
  @HttpCode(204)
  async unshare(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    await this.githubAppService.unshare(id, user);
  }
}
