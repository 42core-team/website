import { instanceToPlain } from "class-transformer";
import { RepositoryStatus, TeamEntity } from "./entities/team.entity";
import { toOwnTeamResponse, toTeamResponse } from "./team-response";

function team() {
  return Object.assign(new TeamEntity(), {
    id: "team",
    name: "Team",
    picture: null,
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
  });
}

describe("team responses", () => {
  it("uses the given standing instead of the stored one", () => {
    const plain = instanceToPlain(
      toTeamResponse(team(), { score: 2, buchholzPoints: 4 }, ["Berlin"]),
    );

    expect(plain).toMatchObject({
      id: "team",
      score: 2,
      buchholzPoints: 4,
      tags: ["Berlin"],
      repositoryStatus: RepositoryStatus.LOCKED,
      background: { large: "bg.webp" },
    });
    for (const field of [
      "credits",
      "repo",
      "repositoryError",
      "repositoryOperationId",
      "queueScore",
      "lastCreditGrantedAt",
      "startedRepoCreationAt",
    ])
      expect(plain).not.toHaveProperty(field);
  });

  it("adds repository and credits for the own team only", () => {
    const plain = instanceToPlain(
      toOwnTeamResponse(team(), { score: 0, buchholzPoints: 0 }, []),
    );

    expect(plain).toMatchObject({
      repo: "repo",
      repositoryError: "error",
      credits: 3,
      score: 0,
      buchholzPoints: 0,
    });
    expect(plain).not.toHaveProperty("queueScore");
    expect(plain).not.toHaveProperty("repositoryOperationId");
  });
});
