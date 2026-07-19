import { SocialPlatform } from "./entities/social-account.entity";
import {
  createLocationTag,
  getLocationTags,
  groupLocationTagsByOwner,
} from "./location-tags";

describe("location tags", () => {
  it.each([
    ["Berlin", "42-berlin"],
    ["  BeRLiN  ", "42-berlin"],
    ["Abu Dhabi", "42-abu-dhabi"],
    ["Sao Paulo", "42-sao-paulo"],
    ["São Paulo", "42-sao-paulo"],
    ["Heilbronn / Campus", "42-heilbronn-campus"],
  ])("normalizes campus %s", (campusName, expected) => {
    expect(
      createLocationTag({
        platform: SocialPlatform.FORTYTWO,
        campusName,
      }),
    ).toBe(expected);
  });

  it.each([null, "", "   ", "---"])(
    "omits a tag for campus %p",
    (campusName) => {
      expect(
        createLocationTag({
          platform: SocialPlatform.FORTYTWO,
          campusName,
        }),
      ).toBeNull();
    },
  );

  it("deduplicates and sorts location tags", () => {
    expect(
      getLocationTags([
        { platform: SocialPlatform.FORTYTWO, campusName: "Paris" },
        { platform: SocialPlatform.FORTYTWO, campusName: "Berlin" },
        { platform: SocialPlatform.FORTYTWO, campusName: "Berlin" },
        { platform: SocialPlatform.FORTYTWO, campusName: null },
      ]),
    ).toEqual(["42-berlin", "42-paris"]);
  });

  it("groups relational rows by team and includes teams without tags", () => {
    expect(
      groupLocationTagsByOwner(
        ["team-a", "team-b", "team-c"],
        [
          {
            ownerId: "team-a",
            platform: SocialPlatform.FORTYTWO,
            campusName: "Berlin",
          },
          {
            ownerId: "team-a",
            platform: SocialPlatform.FORTYTWO,
            campusName: "Paris",
          },
          {
            ownerId: "team-a",
            platform: SocialPlatform.FORTYTWO,
            campusName: "Berlin",
          },
          {
            ownerId: "team-b",
            platform: SocialPlatform.FORTYTWO,
            campusName: null,
          },
        ],
      ),
    ).toEqual(
      new Map([
        ["team-a", ["42-berlin", "42-paris"]],
        ["team-b", []],
        ["team-c", []],
      ]),
    );
  });
});
