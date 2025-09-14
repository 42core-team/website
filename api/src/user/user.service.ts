import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {UserEntity} from "./entities/user.entity";
import {Repository, UpdateResult} from "typeorm";
import {UserInviteSearchResult} from "./dtos/user-search-invite.dto";

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
    ) {
    }

    async createUser(
        email: string,
        username: string,
        name: string,
        profilePicture: string,
        githubId: string,
        githubAccessToken: string,
        canCreateEvent?: boolean,
    ): Promise<UserEntity> {
        const newUser = this.userRepository.create({
            email,
            username,
            name,
            profilePicture,
            githubId,
            githubAccessToken,
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
        return this.userRepository.update(id, {
            email,
            username,
            name,
            profilePicture,
            githubId,
            githubAccessToken,
        });
    }

    getUserCountOfEvent(eventId: string): Promise<number> {
        return this.userRepository.count({
            where: {
                events: {
                    id: eventId,
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
        return this.userRepository
            .createQueryBuilder()
            .relation(UserEntity, "events")
            .of(userId)
            .add(eventId);
    }

    canCreateEvent(userId: string): Promise<boolean> {
        return this.userRepository.existsBy({
            id: userId,
            canCreateEvent: true,
        });
    }

    getUserById(userId: string) {
        return this.userRepository.findOneByOrFail({
            id: userId,
        });
    }

    addTeamInvite(userId: string, teamId: string): Promise<void> {
        return this.userRepository
            .createQueryBuilder()
            .relation(UserEntity, "teamInvites")
            .of(userId)
            .add(teamId);
    }

    searchUsersForInvite(
        eventId: string,
        searchQuery: string,
        teamId: string,
    ): Promise<UserInviteSearchResult[]> {
        return this.userRepository
            .createQueryBuilder("user")
            .select("user.id", "id")
            .addSelect("user.name", "name")
            .addSelect("user.username", "username")
            .addSelect("user.profilePicture", "profilePicture")
            .addSelect(
                `(MAX(CASE WHEN inviteTeam.id = :teamId THEN 1 ELSE 0 END) = 1)`,
                'isInvited',
            )
            .innerJoin("user.events", "event", "event.id = :eventId", {eventId})
            .leftJoin("user.teams", "team", "team.eventId = :eventId", {eventId})
            .leftJoin("user.teamInvites", "inviteTeam")
            .leftJoin("inviteTeam.event", "inviteEvent")
            .leftJoin("user.socialAccounts", "sa")
            .where(
                "(LOWER(user.username) LIKE LOWER(:username) OR LOWER(user.name) LIKE LOWER(:name) OR LOWER(sa.username) LIKE LOWER(:social))",
                {username: `%${searchQuery}%`, name: `%${searchQuery}%`, social: `%${searchQuery}%`},
            )
            .andWhere("team.id IS NULL")
            .andWhere(
                "(inviteEvent.id IS NULL OR inviteEvent.id != :eventId OR inviteTeam.id = :teamId)",
                {eventId, teamId},
            )
            .groupBy("user.id")
            .getRawMany<UserInviteSearchResult>();
    }
}
