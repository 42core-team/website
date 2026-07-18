import { ConflictException } from "@nestjs/common";
import { QueryFailedError, Repository } from "typeorm";
import { SocialAccountService } from "./social-account.service";
import {
  SocialAccountEntity,
  SOCIAL_ACCOUNT_PLATFORM_USER_ID_UNIQUE_CONSTRAINT,
  SocialPlatform,
} from "./entities/social-account.entity";

describe("SocialAccountService", () => {
  let service: SocialAccountService;
  let repository: {
    create: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((entity) => entity as SocialAccountEntity),
      delete: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    service = new SocialAccountService(
      repository as unknown as Repository<SocialAccountEntity>,
    );
  });

  it("rejects linking a 42 account that already belongs to another user", async () => {
    repository.findOne.mockResolvedValueOnce({
      id: "social-account-1",
      userId: "other-user",
      platform: SocialPlatform.FORTYTWO,
      platformUserId: "42-user-id",
      username: "existing-login",
    } as SocialAccountEntity);

    await expect(
      service.upsertSocialAccountForUser({
        userId: "current-user",
        platform: SocialPlatform.FORTYTWO,
        platformUserId: "42-user-id",
        username: "new-login",
        campusId: 12,
        campusName: "Berlin",
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("updates the existing link when the same user reconnects their own 42 account", async () => {
    const existingAccount = {
      id: "social-account-1",
      userId: "current-user",
      platform: SocialPlatform.FORTYTWO,
      platformUserId: "42-user-id",
      username: "old-login",
      campusId: 1,
      campusName: "Paris",
    } as SocialAccountEntity;

    repository.findOne
      .mockResolvedValueOnce(existingAccount)
      .mockResolvedValueOnce(existingAccount);
    repository.save.mockImplementation(
      async (entity: SocialAccountEntity) => entity,
    );

    await expect(
      service.upsertSocialAccountForUser({
        userId: "current-user",
        platform: SocialPlatform.FORTYTWO,
        platformUserId: "42-user-id",
        username: "updated-login",
        campusId: 12,
        campusName: "Berlin",
      }),
    ).resolves.toMatchObject({
      id: "social-account-1",
      userId: "current-user",
      platformUserId: "42-user-id",
      username: "updated-login",
      campusId: 12,
      campusName: "Berlin",
    });
  });

  it("persists campus data when creating a new link", async () => {
    repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repository.save.mockImplementation(
      async (entity: SocialAccountEntity) => entity,
    );

    await service.upsertSocialAccountForUser({
      userId: "current-user",
      platform: SocialPlatform.FORTYTWO,
      platformUserId: "42-user-id",
      username: "new-login",
      campusId: 12,
      campusName: "Berlin",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ campusId: 12, campusName: "Berlin" }),
    );
  });

  it("clears stale campus data when reconnecting without a primary campus", async () => {
    const existingAccount = {
      id: "social-account-1",
      userId: "current-user",
      platform: SocialPlatform.FORTYTWO,
      platformUserId: "42-user-id",
      username: "old-login",
      campusId: 12,
      campusName: "Berlin",
    } as SocialAccountEntity;
    repository.findOne
      .mockResolvedValueOnce(existingAccount)
      .mockResolvedValueOnce(existingAccount);
    repository.save.mockImplementation(
      async (entity: SocialAccountEntity) => entity,
    );

    await service.upsertSocialAccountForUser({
      userId: "current-user",
      platform: SocialPlatform.FORTYTWO,
      platformUserId: "42-user-id",
      username: "new-login",
      campusId: null,
      campusName: null,
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ campusId: null, campusName: null }),
    );
  });

  it("returns a conflict when the database rejects a duplicate provider identity", async () => {
    repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repository.create.mockReturnValue({
      userId: "current-user",
      platform: SocialPlatform.FORTYTWO,
      platformUserId: "42-user-id",
      username: "new-login",
    } as SocialAccountEntity);
    repository.save.mockRejectedValue(
      new QueryFailedError("INSERT INTO social_accounts ...", [], {
        code: "23505",
        constraint: SOCIAL_ACCOUNT_PLATFORM_USER_ID_UNIQUE_CONSTRAINT,
      } as Error & { code: string; constraint: string }),
    );

    await expect(
      service.upsertSocialAccountForUser({
        userId: "current-user",
        platform: SocialPlatform.FORTYTWO,
        platformUserId: "42-user-id",
        username: "new-login",
        campusId: 12,
        campusName: "Berlin",
      }),
    ).rejects.toThrow(ConflictException);
  });
});
