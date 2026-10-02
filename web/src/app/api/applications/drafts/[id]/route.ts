import { NextResponse } from "next/server";

import { bearerToken, errorResponse, unauthorizedResponse } from "@/lib/http";
import { getApplicationService } from "@/modules/applications/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  if (!token) return unauthorizedResponse();
  try {
    const { id } = await context.params;
    const application = await getApplicationService().getDraft(id, token);
    return NextResponse.json({
      id: application.id,
      status: application.status,
      payload: application.payload,
      expiresAt: application.draftExpiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  if (!token) return unauthorizedResponse();
  try {
    const { id } = await context.params;
    const payload: unknown = await request.json();
    const application = await getApplicationService().saveDraft(id, token, payload);
    return NextResponse.json({
      id: application.id,
      status: application.status,
      expiresAt: application.draftExpiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
