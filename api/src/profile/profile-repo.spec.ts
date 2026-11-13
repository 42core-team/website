import { getVisibleRepo } from "./profile-repo";

const team = {
  id: "team-1",
  repo: "winter-cup-gempire",
  event: { githubOrg: "core-event" },
};

describe("getVisibleRepo", () => {
  it("links the repository for a viewer on the team", () => {
    expect(getVisibleRepo(team, new Set(["team-1"]))).toEqual({
      name: "winter-cup-gempire",
      url: "https://github.com/core-event/winter-cup-gempire",
    });
  });

  it("hides it from viewers who are not on the team", () => {
    expect(getVisibleRepo(team, new Set(["team-2"]))).toBeNull();
    expect(getVisibleRepo(team, new Set())).toBeNull();
  });

  it("is null while the team has no repository", () => {
    expect(
      getVisibleRepo({ ...team, repo: null }, new Set(["team-1"])),
    ).toBeNull();
  });
});
