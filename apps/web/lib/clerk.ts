import type { OpportunityRepository } from "@neora/db";
import { localDemoIdentity, resolveRoleIdentity, type AppIdentity } from "./auth";

export async function requestIdentity(repository: OpportunityRepository): Promise<AppIdentity | null> {
  const demo = localDemoIdentity();
  if (demo) return demo;
  // Credential-free integration harnesses may provide a seeded Clerk user
  // identity explicitly. This hook is development-only and cannot be enabled
  // by production configuration.
  if (process.env.NODE_ENV !== "production" && process.env.NEORA_TEST_CLERK_USER_ID) {
    return resolveRoleIdentity(process.env.NEORA_TEST_CLERK_USER_ID, (clerkUserId) => repository.findRoleByClerkUserId(clerkUserId));
  }
  if (!process.env.CLERK_SECRET_KEY) return null;
  const { auth } = await import("@clerk/nextjs/server");
  const session = await auth();
  if (!session.userId) return null;
  return resolveRoleIdentity(session.userId, (clerkUserId) => repository.findRoleByClerkUserId(clerkUserId));
}
