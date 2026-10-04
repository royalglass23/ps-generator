import { NextResponse } from "next/server";

import { bearerToken, errorResponse, unauthorizedResponse } from "@/lib/http";
import { getApplicationService } from "@/modules/applications/runtime";
import { persistWithImmediateEmailDispatch } from "@/modules/email/runtime";

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
    const receipt = await persistWithImmediateEmailDispatch(() =>
      getApplicationService().sendDraftResumeLink(id, token),
    );
    return NextResponse.json(receipt);
  } catch (error) {
    return errorResponse(error);
  }
}
