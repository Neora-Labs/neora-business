import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { requestIdentity } from "@/lib/clerk";
import { opportunityRuntime } from "@/lib/runtime";

const updateSchema = z.object({ priority: z.enum(["A", "B", "C"]), outreachStatus: z.string().trim().min(1).max(100) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const runtime = opportunityRuntime(); const identity = await requestIdentity(runtime.repository);
  if (!identity || !authorize(identity, "manage_prospects")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const prospect = await runtime.repository.updateProspect((await params).id, parsed.data);
  return prospect ? NextResponse.json({ data: prospect }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
