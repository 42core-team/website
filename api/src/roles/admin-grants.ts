import { EntityManager, IsNull } from "typeorm";
import { UserRole, UserRoleEntity } from "../user/entities/user-role.entity";

export type AdminRemoval = "removed" | "not-found" | "last-admin";

/**
 * Deletes the ADMIN grant `isTarget` picks within one scope, an event or the
 * platform (null), unless it is the scope's last admin. Run it in a
 * transaction. It locks every admin row of the scope (FOR UPDATE) in id order
 * before deciding, so concurrent removals cannot each see another admin left
 * and remove both, and cannot deadlock by locking their targets first.
 */
export async function removeAdminGrant(
  manager: EntityManager,
  eventId: string | null,
  isTarget: (grant: UserRoleEntity) => boolean,
): Promise<AdminRemoval> {
  const admins = await manager.getRepository(UserRoleEntity).find({
    where: { role: UserRole.ADMIN, eventId: eventId ?? IsNull() },
    order: { id: "ASC" },
    lock: { mode: "pessimistic_write" },
  });
  const target = admins.find(isTarget);
  if (!target) return "not-found";
  if (admins.length <= 1) return "last-admin";
  await manager.delete(UserRoleEntity, target.id);
  return "removed";
}
