import { Injectable, Module } from "@nestjs/common";
import { isUUID } from "class-validator";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";

/** Guests may only see public events. Signed-in viewers need no lookup. */
@Injectable()
export class EventAudience {
  constructor(private readonly dataSource: DataSource) {}

  async isPublic(eventId: string): Promise<boolean> {
    // Guards run before route pipes; never send a malformed uuid to Postgres.
    if (!isUUID(eventId)) return false;
    return this.dataSource
      .getRepository(EventEntity)
      .existsBy({ id: eventId, isPrivate: false });
  }
}

/** Provides EventAudience to the policies; the DataSource is global. */
@Module({ providers: [EventAudience], exports: [EventAudience] })
export class EventAudienceModule {}
