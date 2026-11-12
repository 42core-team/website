import { instanceToPlain } from "class-transformer";
import { DataSource, getMetadataArgsStorage } from "typeorm";
import { MediaUploadEntity } from "./entities/media-upload.entity";
import { mediaArtwork } from "./media-artwork";
import { TeamEntity } from "../team/entities/team.entity";
import { MatchEntity } from "../match/entites/match.entity";

function upload(objectKey: string) {
  return Object.assign(new MediaUploadEntity(), { objectKey });
}

describe("relational media artwork", () => {
  it("assembles two picture variants and one background variant", () => {
    expect(
      mediaArtwork({
        pictureSmallUpload: upload("small.webp"),
        pictureLargeUpload: upload("large.webp"),
        backgroundLargeUpload: upload("background.webp"),
      }),
    ).toEqual({
      picture: { small: "small.webp", large: "large.webp" },
      background: { large: "background.webp" },
    });
  });

  it("returns null when artwork is missing or a picture is incomplete", () => {
    expect(mediaArtwork({})).toEqual({ picture: null, background: null });
    expect(
      mediaArtwork({ pictureSmallUpload: upload("small.webp") }),
    ).toEqual({
      picture: null,
      background: null,
    });
  });

  it("preserves the public response shape without exposing upload relations", () => {
    const team = Object.assign(new TeamEntity(), {
      pictureSmallUploadId: "small-id",
      pictureLargeUploadId: "large-id",
      backgroundLargeUploadId: null,
      pictureSmallUpload: upload("small.webp"),
      pictureLargeUpload: upload("large.webp"),
      backgroundLargeUpload: null,
    });
    team.loadArtwork();
    const response = instanceToPlain(team);
    expect(response.picture).toEqual({
      small: "small.webp",
      large: "large.webp",
    });
    expect(response.background).toBeNull();
    expect(response).not.toHaveProperty("pictureSmallUploadId");
    expect(response).not.toHaveProperty("pictureLargeUploadId");
    expect(response).not.toHaveProperty("backgroundLargeUploadId");
    expect(response).not.toHaveProperty("pictureSmallUpload");
    expect(response).not.toHaveProperty("pictureLargeUpload");
    expect(response).not.toHaveProperty("backgroundLargeUpload");
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

  it("uses a generic media_uploads table referenced by team foreign keys", () => {
    const media = source.getMetadata(MediaUploadEntity);
    expect(media.tableName).toBe("media_uploads");
    expect(media.foreignKeys).toHaveLength(0);
    expect(
      media.columns.map((column) => column.propertyName).sort(),
    ).toEqual(["createdAt", "id", "objectKey"]);

    const teamMeta = source.getMetadata(TeamEntity);
    const columns = teamMeta.columns.map((column) => column.propertyName);
    expect(columns).not.toContain("picture");
    expect(columns).not.toContain("background");
    expect(columns).toEqual(
      expect.arrayContaining([
        "pictureSmallUploadId",
        "pictureLargeUploadId",
        "backgroundLargeUploadId",
      ]),
    );
    const mediaFks = teamMeta.foreignKeys.filter(
      (key) => key.referencedTablePath === "media_uploads",
    );
    expect(mediaFks).toHaveLength(3);
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
    expect(sql.match(/JOIN "media_uploads"/g)).toHaveLength(6);
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
