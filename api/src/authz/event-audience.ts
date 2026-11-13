import { Injectable, Module } from "@nestjs/common";
import { isUUID } from "class-validator";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import {
  EventWhitelistEntity,
  WhitelistPlatform,
} from "../event/entities/event-whitelist.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { SocialPlatform } from "../user/entities/social-account.entity";
import { UserEntity } from "../user/entities/user.entity";

/**
 * Who may see an event regardless of roles: everyone for a public event; for
 * a private one, its participants, the members of its teams and the users on
 * its whitelist. One query either way.
 */
@Injectable()
export class EventAudience {
  constructor(private readonly dataSource: DataSource) {}

  async includes(eventId: string, userId: string | null): Promise<boolean> {
    // The id comes straight from the route; Postgres rejects a malformed uuid.
    if (!isUUID(eventId)) return false;
    const query = this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder("event")
      .where("event.id = :eventId", { eventId });
    if (!userId) return query.andWhere("NOT event.isPrivate").getExists();

    const participant = query
      .subQuery()
      .select("1")
      .from(UserEntity, "participant")
      .innerJoin("participant.events", "joined", "joined.id = event.id")
      .where("participant.id = :userId")
      .getQuery();
    const teamMember = query
      .subQuery()
      .select("1")
      .from(TeamEntity, "team")
      .innerJoin("team.users", "member", "member.id = :userId")
      .where("team.event = event.id")
      .andWhere("team.deletedAt IS NULL")
      .getQuery();
    // Entries are stored trimmed and lowercased, as join compares them.
    const whitelisted = query
      .subQuery()
      .select("1")
      .from(EventWhitelistEntity, "entry")
      .innerJoin(UserEntity, "viewer", "viewer.id = :userId")
      .leftJoin(
        "viewer.socialAccounts",
        "fortyTwo",
        "fortyTwo.platform = :fortyTwoAccount",
      )
      .where("entry.event = event.id")
      .andWhere(
        `((entry.platform = :github AND entry.username = LOWER(TRIM(viewer.username)))
          OR (entry.platform = :fortyTwo AND entry.username = LOWER(TRIM(fortyTwo.username))))`,
      )
      .getQuery();
    return query
      .andWhere(
        `(NOT event.isPrivate OR EXISTS ${participant} OR EXISTS ${teamMember} OR EXISTS ${whitelisted})`,
      )
      .setParameters({
        userId,
        github: WhitelistPlatform.GITHUB,
        fortyTwo: WhitelistPlatform.FORTYTWO,
        fortyTwoAccount: SocialPlatform.FORTYTWO,
      })
      .getExists();
  }
}

/** Provides EventAudience to the policies; the DataSource is global. */
@Module({ providers: [EventAudience], exports: [EventAudience] })
export class EventAudienceModule {}
