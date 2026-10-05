import { after, NextResponse } from "next/server";

import { bearerToken, errorResponse, unauthorizedResponse } from "@/lib/http";
import { getApplicationService } from "@/modules/applications/runtime";
import { dispatchEmailOutboxSafely } from "@/modules/email/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  if (!token) return unauthorizedResponse();
  try {
    const { id } = await context.params;
    const payload: unknown = await request.json();
    const application = await getApplicationService().submit(id, token, payload);
    after(dispatchEmailOutboxSafely);
    return NextResponse.json({
      id: application.id,
      status: application.status,
      reference: application.reference,
      submittedAt: application.submittedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
