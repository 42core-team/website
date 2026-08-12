import { BadRequestException } from "@nestjs/common";
import { Repository } from "typeorm";
import { OAuthFlow, OAuthStateEntity } from "./entities/oauth-state.entity";
import { OAuthStateService } from "./oauth-state.service";

function createRepository(): {
  repository: Repository<OAuthStateEntity>;
  records: Map<string, OAuthStateEntity>;
} {
  const records = new Map<string, OAuthStateEntity>();
  const parameters: Record<string, unknown> = {};
  const queryBuilder = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn((_clause: string, params: Record<string, unknown>) => {
      Object.assign(parameters, params);
      return queryBuilder;
    }),
    andWhere: jest.fn((_clause: string, params: Record<string, unknown>) => {
      Object.assign(parameters, params);
      return queryBuilder;
    }),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(async () => {
      const record = records.get(parameters.stateHash as string);
      if (
        !record ||
        record.browserHash !== parameters.browserHash ||
        record.flow !== parameters.flow ||
        record.expiresAt <= (parameters.now as Date)
      ) {
        return { raw: [] };
      }
      records.delete(record.stateHash);
      return { raw: [record] };
    }),
  };
  const repository = {
    delete: jest.fn(async () => ({ affected: 0 })),
    create: jest.fn((value) => value),
    save: jest.fn(async (record: OAuthStateEntity) => {
      records.set(record.stateHash, record);
      return record;
    }),
    createQueryBuilder: jest.fn(() => queryBuilder),
  } as unknown as Repository<OAuthStateEntity>;

  return { repository, records };
}

describe("OAuthStateService", () => {
  it.each([OAuthFlow.GITHUB, OAuthFlow.FORTYTWO])(
    "binds %s state to one browser and consumes it once",
    async (flow) => {
      const { repository } = createRepository();
      const service = new OAuthStateService(repository);
      const issued = await service.issue(
        flow,
        flow === OAuthFlow.FORTYTWO
          ? "00000000-0000-0000-0000-000000000001"
          : null,
        flow === OAuthFlow.GITHUB,
      );

      await expect(
        service.consume(flow, issued.state, "different-browser"),
      ).rejects.toBeInstanceOf(BadRequestException);

      const consumed = await service.consume(
        flow,
        issued.state,
        issued.browserBinding,
      );
      expect(consumed.flow).toBe(flow);

      await expect(
        service.consume(flow, issued.state, issued.browserBinding),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it("rejects expired state", async () => {
    const { repository, records } = createRepository();
    const service = new OAuthStateService(repository);
    const issued = await service.issue(OAuthFlow.FORTYTWO, null);
    const record = [...records.values()][0];
    record.expiresAt = new Date(Date.now() - 1);

    await expect(
      service.consume(OAuthFlow.FORTYTWO, issued.state, issued.browserBinding),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates an S256 PKCE challenge without exposing the verifier", async () => {
    const { repository, records } = createRepository();
    const service = new OAuthStateService(repository);
    const issued = await service.issue(OAuthFlow.GITHUB, null, true);
    const record = [...records.values()][0];

    expect(issued.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(record.codeVerifier).toBeTruthy();
    expect(issued).not.toHaveProperty("codeVerifier");
  });
});
