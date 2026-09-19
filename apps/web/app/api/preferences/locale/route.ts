import { NextResponse } from "next/server";
import { z } from "zod";
import { requestIdentity } from "@/lib/clerk";
import { opportunityRuntime } from "@/lib/runtime";

const bodySchema = z.object({ locale: z.enum(["es", "en"]) });
export async function PUT(request: Request) {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (identity.mode === "clerk") await runtime.repository.updatePreferredLocaleByClerkUserId(identity.userId, body.data.locale);
  const response = NextResponse.json({ locale: body.data.locale });
  response.cookies.set("neora_locale", body.data.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}
