import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  SocialAccountEntity,
  SocialPlatform,
} from "./entities/social-account.entity";
import { UserEntity } from "./entities/user.entity";

@Injectable()
export class SocialAccountService {
  constructor(
    @InjectRepository(SocialAccountEntity)
    private socialAccountRepository: Repository<SocialAccountEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
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
    const existing = await this.socialAccountRepository.findOne({
      where: { userId: params.userId, platform: params.platform },
    });

    if (existing) {
      existing.username = params.username;
      existing.platformUserId = params.platformUserId;
      return this.socialAccountRepository.save(existing);
    }

    const entity = this.socialAccountRepository.create({
      userId: params.userId,
      platform: params.platform,
      username: params.username,
      platformUserId: params.platformUserId,
    });
    return this.socialAccountRepository.save(entity);
  }
}