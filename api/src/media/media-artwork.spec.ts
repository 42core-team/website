import { instanceToPlain } from "class-transformer";
import { DataSource, getMetadataArgsStorage } from "typeorm";
import { MediaUploadEntity } from "./entities/media-upload.entity";
import { mediaArtwork } from "./media-artwork";
import { TeamEntity } from "../team/entities/team.entity";
import { MatchEntity } from "../match/entites/match.entity";

function upload(
  kind: "picture" | "background",
  variant: "small" | "large",
  objectKey: string,
) {
  return Object.assign(new MediaUploadEntity(), { kind, variant, objectKey });
}

describe("relational media artwork", () => {
  it("assembles two picture variants and one background variant", () => {
    expect(
      mediaArtwork([
        upload("picture", "small", "small.webp"),
        upload("picture", "large", "large.webp"),
        upload("background", "large", "background.webp"),
      ]),
    ).toEqual({
      picture: { small: "small.webp", large: "large.webp" },
      background: { large: "background.webp" },
    });
  });

  it("returns null when artwork is missing or a picture is incomplete", () => {
    expect(mediaArtwork([])).toEqual({ picture: null, background: null });
    expect(mediaArtwork([upload("picture", "small", "small.webp")])).toEqual({
      picture: null,
      background: null,
    });
  });

  it("preserves the public response shape without exposing upload ownership", () => {
    const team = Object.assign(new TeamEntity(), {
      mediaUploads: [
        Object.assign(upload("picture", "small", "small.webp"), {
          teamId: "team",
          userId: null,
        }),
        upload("picture", "large", "large.webp"),
      ],
    });
    team.loadArtwork();
    const response = instanceToPlain(team);
    expect(response.picture).toEqual({
      small: "small.webp",
      large: "large.webp",
    });
    expect(response.background).toBeNull();
    expect(response).not.toHaveProperty("mediaUploads");
  });
});

class MetadataDataSource extends DataSource {
  async prepareMetadata() {
    await this.buildMetadatas();
  }
}

describe("media upload ORM schema", () => {
  let source: MetadataDataSource;
  beforeAll(async () => {
    source = new MetadataDataSource({
      type: "postgres",
      entities: getMetadataArgsStorage()
        .tables.map((table) => table.target)
        .filter((target) => typeof target === "function"),
    });
    await source.prepareMetadata();
  });

  it("uses a separate table and no team artwork JSONB columns", () => {
    const media = source.getMetadata(MediaUploadEntity);
    expect(media.tableName).toBe("media_uploads");
    expect(
      media.foreignKeys.map((key) => key.referencedTablePath).sort(),
    ).toEqual(["teams", "users"]);
    expect(media.checks.map((check) => check.name)).toContain(
      "media_uploads_owner_check",
    );
    expect(media.indices.filter((index) => index.isUnique)).toHaveLength(2);
    const columns = source
      .getMetadata(TeamEntity)
      .columns.map((column) => column.propertyName);
    expect(columns).not.toContain("picture");
    expect(columns).not.toContain("background");
  });

  it("loads artwork even for partially selected queue teams and winners", () => {
    const sql = source
      .getRepository(MatchEntity)
      .createQueryBuilder("match")
      .setFindOptions({
        select: {
          id: true,
          teams: { id: true, name: true },
          winner: { id: true, name: true },
        },
        relations: { teams: true, winner: true },
      })
      .getSql();
    expect(sql.match(/JOIN "media_uploads"/g)).toHaveLength(2);
    expect(sql).toContain('"objectKey"');
  });

  it("omits artwork joins when locking a team without eager relations", () => {
    const sql = source
      .getRepository(TeamEntity)
      .createQueryBuilder("team")
      .setFindOptions({
        where: { id: "team" },
        loadEagerRelations: false,
        lock: { mode: "pessimistic_write" },
      })
      .getSql();
    expect(sql).not.toContain('JOIN "media_uploads"');
    expect(sql).toContain("FOR UPDATE");
  });
});
