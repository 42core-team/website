import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import {
  SocialAccountEntity,
  SOCIAL_ACCOUNT_PLATFORM_USER_ID_UNIQUE_CONSTRAINT,
  SocialPlatform,
} from "./entities/social-account.entity";

const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";
const SOCIAL_ACCOUNT_ALREADY_LINKED_MESSAGE =
  "This social account is already linked to another user";

@Injectable()
export class SocialAccountService {
  constructor(
    @InjectRepository(SocialAccountEntity)
    private socialAccountRepository: Repository<SocialAccountEntity>,
  ) {}

  async unlinkSocialAccount(
    userId: string,
    platform: SocialPlatform,
  ): Promise<void> {
    const result = await this.socialAccountRepository.delete({
      userId,
      platform,
    });

    if (result.affected === 0) {
      throw new NotFoundException("Social account link not found");
    }
  }

  async getSocialAccounts(userId: string): Promise<SocialAccountEntity[]> {
    return await this.socialAccountRepository.find({
      where: { userId },
      order: { createdAt: "ASC" },
    });
  }

  async getSocialAccountByPlatform(
    userId: string,
    platform: SocialPlatform,
  ): Promise<SocialAccountEntity | null> {
    return await this.socialAccountRepository.findOne({
      where: { userId, platform },
    });
  }

  async upsertSocialAccountForUser(params: {
    userId: string;
    platform: SocialPlatform;
    username: string;
    platformUserId: string;
  }): Promise<SocialAccountEntity> {
    const linkedAccount = await this.socialAccountRepository.findOne({
      where: {
        platform: params.platform,
        platformUserId: params.platformUserId,
      },
    });

    if (linkedAccount && linkedAccount.userId !== params.userId) {
      throw new ConflictException(SOCIAL_ACCOUNT_ALREADY_LINKED_MESSAGE);
    }

    const existing = await this.socialAccountRepository.findOne({
      where: { userId: params.userId, platform: params.platform },
    });

    if (existing) {
      existing.username = params.username;
      existing.platformUserId = params.platformUserId;
      return this.saveSocialAccount(existing);
    }

    const entity = this.socialAccountRepository.create({
      userId: params.userId,
      platform: params.platform,
      username: params.username,
      platformUserId: params.platformUserId,
    });
    return this.saveSocialAccount(entity);
  }

  private async saveSocialAccount(
    entity: SocialAccountEntity,
  ): Promise<SocialAccountEntity> {
    try {
      return await this.socialAccountRepository.save(entity);
    } catch (error) {
      if (this.isDuplicatePlatformAccountError(error)) {
        throw new ConflictException(SOCIAL_ACCOUNT_ALREADY_LINKED_MESSAGE);
      }

      throw error;
    }
  }

  private isDuplicatePlatformAccountError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as
      | { code?: string; constraint?: string }
      | undefined;

    return (
      driverError?.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
      driverError.constraint ===
        SOCIAL_ACCOUNT_PLATFORM_USER_ID_UNIQUE_CONSTRAINT
    );
  }
}
