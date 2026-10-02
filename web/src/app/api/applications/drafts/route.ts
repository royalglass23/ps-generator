import { NextResponse } from "next/server";
import { z } from "zod";

import { getApplicationConfig } from "@/lib/config";
import { errorResponse, requestIp } from "@/lib/http";
import { getApplicationService } from "@/modules/applications/runtime";
import { limitDraftCreation } from "@/modules/security/runtime";
import { verifyTurnstile } from "@/modules/security/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ turnstileToken: z.string().min(1).max(2_048) }).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "ABUSE_CHECK_FAILED" }, { status: 403 });
    }
    const remoteIp = requestIp(request);
    await verifyTurnstile(parsed.data.turnstileToken, remoteIp === "unavailable" ? undefined : remoteIp);
    await limitDraftCreation(remoteIp);
    const draft = await getApplicationService().createDraft();
    const { APP_BASE_URL } = getApplicationConfig();
    return NextResponse.json(
      {
        id: draft.id,
        resumeToken: draft.resumeToken,
        expiresAt: draft.expiresAt.toISOString(),
        resumeUrl: `${APP_BASE_URL}/application/${draft.id}#token=${encodeURIComponent(draft.resumeToken)}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
