import { EntityManager, FindOperator, Repository } from "typeorm";
import { UserEntity } from "../../user/entities/user.entity";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";

/**
 * In-memory stand-in for `Repository<RefreshTokenEntity>` used by tests. It
 * supports exactly the repository calls and find operators the refresh token
 * service relies on.
 */
type Where = Partial<Record<keyof RefreshTokenEntity, unknown>>;

function matches(record: RefreshTokenEntity, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = record[key as keyof RefreshTokenEntity] as unknown;
    if (expected instanceof FindOperator) {
      const value = expected.value as Date;
      switch (expected.type) {
        case "isNull":
          return actual === null || actual === undefined;
        case "lessThan":
          return actual instanceof Date && actual < value;
        case "lessThanOrEqual":
          return actual instanceof Date && actual <= value;
        default:
          throw new Error(`Unsupported operator ${expected.type}`);
      }
    }
    return actual === expected;
  });
}

export function createInMemoryRefreshTokenRepository(
  getUser: (
    id: string,
  ) => Pick<UserEntity, "id" | "githubAccessToken"> | undefined = (id) => ({
    id,
    githubAccessToken: "",
  }),
): {
  repository: Repository<RefreshTokenEntity>;
  records: RefreshTokenEntity[];
} {
  const records: RefreshTokenEntity[] = [];
  let nextId = 1;
  let transactionTail = Promise.resolve();

  const repository = {
    manager: {
      transaction: async <T>(
        work: (manager: EntityManager) => Promise<T>,
      ): Promise<T> => {
        const previous = transactionTail;
        let release!: () => void;
        transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        const snapshot = records.map((record) => ({ ...record }));
        try {
          return await work({
            getRepository: (entity: unknown) =>
              entity === RefreshTokenEntity
                ? repository
                : {
                    findOne: async ({ where }: { where: { id: string } }) => {
                      const user = getUser(where.id);
                      return user ? { ...user } : null;
                    },
                  },
          } as unknown as EntityManager);
        } catch (error) {
          records.splice(0, records.length, ...snapshot);
          throw error;
        } finally {
          release();
        }
      },
    },
    create: (value: Partial<RefreshTokenEntity>) => ({ ...value }),
    save: async (value: RefreshTokenEntity) => {
      if (records.some((record) => record.tokenHash === value.tokenHash)) {
        throw new Error("duplicate key value violates unique constraint");
      }
      const record: RefreshTokenEntity = {
        ...value,
        rotatedAt: value.rotatedAt ?? null,
        revokedAt: value.revokedAt ?? null,
        createdAt: value.createdAt ?? new Date(),
        id: String(nextId++),
      };
      records.push(record);
      return { ...record };
    },
    findOne: async ({ where }: { where: Where }) => {
      const found = records.find((record) => matches(record, where));
      return found ? { ...found } : null;
    },
    update: async (where: Where, partial: Partial<RefreshTokenEntity>) => {
      const targets = records.filter((record) => matches(record, where));
      targets.forEach((record) => Object.assign(record, partial));
      return { affected: targets.length };
    },
    delete: async (where: Where) => {
      const targets = records.filter((record) => matches(record, where));
      targets.forEach((record) => records.splice(records.indexOf(record), 1));
      return { affected: targets.length };
    },
  } as unknown as Repository<RefreshTokenEntity>;

  return { repository, records };
}
