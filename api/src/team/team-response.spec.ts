import { instanceToPlain } from "class-transformer";
import { RepositoryStatus, TeamEntity } from "./entities/team.entity";
import {
  toAdminEventTeamResponse,
  toEventTeamResponse,
  toInvitingTeamResponse,
  toOwnTeamResponse,
  toTeamResponse,
} from "./team-response";

function team() {
  return Object.assign(new TeamEntity(), {
    id: "team",
    name: "Team",
    picture: { small: "small.webp", large: "large.webp" },
    background: { large: "bg.webp" },
    locked: true,
    repositoryStatus: RepositoryStatus.LOCKED,
    repositoryOperationId: "operation",
    repositoryError: "error",
    tournamentExcluded: false,
    repo: "repo",
    score: 5,
    buchholzPoints: 17,
    queueScore: 1500,
    credits: 3,
    hadBye: true,
    eventId: "event",
    lastCreditGrantedAt: new Date("2026-01-02T00:00:00.000Z"),
    startedRepoCreationAt: new Date("2026-01-03T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-04T00:00:00.000Z"),
    deletedAt: null,
  });
}

function keys(response: object) {
  return Object.keys(instanceToPlain(response)).sort();
}

describe("team responses", () => {
  it("gives the public profile identity and artwork only", () => {
    expect(keys(toTeamResponse(team(), ["Berlin"]))).toEqual(
      ["background", "id", "name", "picture", "tags"].sort(),
    );
    expect(toTeamResponse(team(), ["Berlin"])).toMatchObject({
      id: "team",
      tags: ["Berlin"],
      background: { large: "bg.webp" },
    });
  });

  it("adds the repository state for the own team", () => {
    const response = toOwnTeamResponse(team(), []);
    expect(keys(response)).toEqual(
      [
        "background",
        "id",
        "name",
        "picture",
        "repo",
        "repositoryError",
        "repositoryStatus",
        "tags",
        "tournamentExcluded",
      ].sort(),
    );
    expect(response).toMatchObject({
      repo: "repo",
      repositoryStatus: RepositoryStatus.LOCKED,
      repositoryError: "error",
    });
  });

  it("gives an inviting team its name and tags only", () => {
    expect(keys(toInvitingTeamResponse(team(), []))).toEqual([
      "id",
      "name",
      "tags",
    ]);
  });

  it("uses the given standing for the event team list", () => {
    const response = toEventTeamResponse(
      team(),
      { score: 2, buchholzPoints: 4 },
      3,
      [],
    );
    expect(keys(response)).toEqual(
      [
        "buchholzPoints",
        "createdAt",
        "hadBye",
        "id",
        "name",
        "picture",
        "score",
        "tags",
        "userCount",
      ].sort(),
    );
    expect(response).toMatchObject({
      score: 2,
      buchholzPoints: 4,
      userCount: 3,
    });
  });

  it("adds repository state, credits and queue score to the admin team list", () => {
    const response = toAdminEventTeamResponse(
      team(),
      { score: 5, buchholzPoints: 17 },
      1,
      [],
    );
    expect(response).toMatchObject({
      repositoryStatus: RepositoryStatus.LOCKED,
      repositoryError: "error",
      tournamentExcluded: false,
      credits: 3,
      queueScore: 1500,
    });
  });

  it.each([
    ["profile", () => toTeamResponse(team(), [])],
    ["own team", () => toOwnTeamResponse(team(), [])],
    ["invite", () => toInvitingTeamResponse(team(), [])],
    [
      "event list",
      () => toEventTeamResponse(team(), { score: 0, buchholzPoints: 0 }, 0, []),
    ],
  ])("leaves the queue score out of the %s", (_, build) => {
    expect(instanceToPlain(build())).not.toHaveProperty("queueScore");
  });

  it.each([
    ["profile", () => toTeamResponse(team(), [])],
    ["own team", () => toOwnTeamResponse(team(), [])],
    ["invite", () => toInvitingTeamResponse(team(), [])],
    [
      "event list",
      () => toEventTeamResponse(team(), { score: 0, buchholzPoints: 0 }, 0, []),
    ],
    [
      "admin event list",
      () =>
        toAdminEventTeamResponse(
          team(),
          { score: 0, buchholzPoints: 0 },
          0,
          [],
        ),
    ],
  ])("leaves timestamps and internal fields out of the %s", (_, build) => {
    const plain = instanceToPlain(build());
    for (const field of [
      "updatedAt",
      "deletedAt",
      "lastCreditGrantedAt",
      "startedRepoCreationAt",
      "repositoryOperationId",
      "locked",
      "eventId",
    ])
      expect(plain).not.toHaveProperty(field);
  });
});
