import type { UserRoleEntity } from "../user/entities/user-role.entity";

export interface RoleResponse {
  id: string;
  role: UserRoleEntity["role"];
  eventId: string | null;
  event?: { id: string; name: string };
  user: {
    id: string;
    username: string;
    name: string;
    profilePicture: string;
  };
  grantedBy?: { id: string; username: string };
  createdAt: Date;
}

/** Only the listed fields go out; the relations must be loaded. */
export function toRoleResponse(row: UserRoleEntity): RoleResponse {
  return {
    id: row.id,
    role: row.role,
    eventId: row.eventId,
    ...(row.event && { event: { id: row.event.id, name: row.event.name } }),
    user: {
      id: row.user.id,
      username: row.user.username,
      name: row.user.name,
      profilePicture: row.user.profilePicture,
    },
    ...(row.grantedBy && {
      grantedBy: { id: row.grantedBy.id, username: row.grantedBy.username },
    }),
    createdAt: row.createdAt,
  };
}
