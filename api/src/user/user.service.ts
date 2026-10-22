import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "./entities/user.entity";
import { ILike, Repository, UpdateResult } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { UserInviteSearchResult } from "./dtos/user-search-invite.dto";
import { ConfigService } from "@nestjs/config";
import { encryptSecret } from "../common/encryption";
import { isRegistrationOpen } from "../event/event-lifecycle";

/** GitHub profile fields kept in sync by the grant check (ADR 0003). */
export type GithubSyncedProfile = Partial<
  Pick<UserEntity, "username" | "name" | "profilePicture">
>;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async createUser(
    email: string,
    username: string,
    name: string,
    profilePicture: string,
    githubId: string,
    githubAccessToken: string,
    canCreateEvent?: boolean,
  ): Promise<UserEntity> {
    const encryptedToken = encryptSecret(
      githubAccessToken,
      this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
    );

    const newUser = this.userRepository.create({
      email,
      username,
      name,
      profilePicture,
      githubId,
      githubAccessToken: encryptedToken,
      // Login just fetched GET /user with this token (ADR 0003).
      githubCheckedAt: new Date(),
      canCreateEvent,
    });
    return this.userRepository.save(newUser);
  }

  async updateUser(
    id: string,
    email: string,
    username: string,
    name: string,
    profilePicture: string,
    githubId: string,
    githubAccessToken: string,
  ): Promise<UpdateResult> {
    const encryptedToken = encryptSecret(
      githubAccessToken,
      this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
    );
    return this.userRepository.update(id, {
      email,
      username,
      name,
      profilePicture,
      githubId,
      githubAccessToken: encryptedToken,
      // Login just fetched GET /user with this token (ADR 0003).
      githubCheckedAt: new Date(),
    });
  }

  /** Record a successful GitHub grant check and the profile fields that changed. */
  async recordGithubCheck(
    id: string,
    checkedAt: Date,
    profile: GithubSyncedProfile,
  ): Promise<void> {
    await this.userRepository.update(id, {
      ...profile,
      githubCheckedAt: checkedAt,
    });
  }

  async updateUsername(githubId: string, newUsername: string, newName: string) {
    return this.userRepository.update(
      { githubId },
      { username: newUsername, name: newName },
    );
  }

  getUserCountOfEvent(eventId: string): Promise<number> {
    return this.userRepository.count({
      where: {
        teams: {
          event: {
            id: eventId,
          },
        },
      },
    });
  }

  getUserByGithubId(githubId: string) {
    return this.userRepository.findOneBy({
      githubId,
    });
  }

  getUserByEmail(email: string) {
    return this.userRepository.findOneBy({
      email,
    });
  }

  joinEvent(userId: string, eventId: string) {
    return this.userRepository.manager.transaction(async (manager) => {
      // Recheck at the mutation, after identity/whitelist lookups, and serialize
      // with administrative closure so a previously authorized request cannot join late.
      const event = await manager.findOneOrFail(EventEntity, {
        where: { id: eventId },
        lock: { mode: "pessimistic_read" },
      });
      if (!isRegistrationOpen(event))
        throw new BadRequestException("Event registration is closed");
      await manager
        .createQueryBuilder()
        .relation(UserEntity, "events")
        .of(userId)
        .add(eventId);
    });
  }

  canCreateEvent(userId: string): Promise<boolean> {
    return this.userRepository.existsBy({
      id: userId,
      canCreateEvent: true,
    });
  }

  getUserById(userId: string) {
    return this.userRepository.findOneOrFail({
      where: { id: userId },
    });
  }

  getUserWithSocialAccounts(userId: string) {
    return this.userRepository.findOneOrFail({
      where: { id: userId },
      relations: { socialAccounts: true },
    });
  }

  addTeamInvite(userId: string, teamId: string): Promise<void> {
    return this.userRepository
      .createQueryBuilder()
      .relation(UserEntity, "teamInvites")
      .of(userId)
      .add(teamId);
  }

  async searchUsersForInvite(
    eventId: string,
    searchQuery: string,
    teamId: string,
    userId: string,
  ): Promise<UserInviteSearchResult[]> {
    const isEventPublic = await this.userRepository.manager
      .getRepository(EventEntity)
      .existsBy({
        id: eventId,
        isPrivate: false,
      });

    const queryBuilder = this.userRepository
      .createQueryBuilder("user")
      .select("user.id", "id")
      .addSelect("user.name", "name")
      .addSelect("user.username", "username")
      .addSelect("user.profilePicture", "profilePicture")
      .addSelect(
        `(MAX(CASE WHEN inviteTeam.id = :teamId THEN 1 ELSE 0 END) = 1)`,
        "isInvited",
      )
      .leftJoin("user.events", "event", "event.id = :eventId", { eventId })
      .leftJoin("user.teams", "team", "team.eventId = :eventId", { eventId })
      .leftJoin("user.teamInvites", "inviteTeam")
      .leftJoin("inviteTeam.event", "inviteEvent")
      .leftJoin("user.socialAccounts", "sa")
      .where(
        "(LOWER(user.username) LIKE LOWER(:username) OR LOWER(user.name) LIKE LOWER(:name) OR LOWER(sa.username) LIKE LOWER(:social))",
        {
          username: `%${searchQuery}%`,
          name: `%${searchQuery}%`,
          social: `%${searchQuery}%`,
        },
      )
      .andWhere("user.id != :userId", { userId })
      .andWhere("team.id IS NULL")
      .andWhere(
        "(inviteEvent.id IS NULL OR inviteEvent.id != :eventId OR inviteTeam.id = :teamId)",
        { eventId, teamId },
      )
      .groupBy("user.id");

    if (!isEventPublic) {
      queryBuilder.andWhere("event.id IS NOT NULL");
    }

    return queryBuilder.getRawMany<UserInviteSearchResult>();
  }

  async searchUsers(query: string): Promise<UserEntity[]> {
    return this.userRepository.find({
      where: [{ username: ILike(`%${query}%`) }, { name: ILike(`%${query}%`) }],
      take: 10,
    });
  }
}
