import type { AppRole, Permission } from "@neora/db";
import { hasPermission } from "@neora/db";

export interface AppIdentity { userId: string; role: AppRole; mode: "clerk" | "local-demo" }
export async function resolveRoleIdentity(
  clerkUserId: string,
  findRole: (clerkUserId: string) => Promise<AppRole | null>
): Promise<AppIdentity | null> {
  const role = await findRole(clerkUserId);
  return role ? { userId: clerkUserId, role, mode: "clerk" } : null;
}
export function localDemoIdentity(): AppIdentity | null {
  if (process.env.NODE_ENV === "production" || process.env.NEORA_LOCAL_DEMO !== "true") return null;
  return { userId: "local-demo-user", role: "administrator", mode: "local-demo" };
}
export function authorize(identity: AppIdentity | null, permission: Permission): boolean { return identity !== null && hasPermission(identity.role, permission); }
