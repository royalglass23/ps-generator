import { NextResponse } from "next/server";
import { z } from "zod";

import { bearerToken, errorResponse, unauthorizedResponse } from "@/lib/http";
import { ApplicationError } from "@/modules/applications/errors";
import { getApplicationService } from "@/modules/applications/runtime";
import { persistWithImmediateEmailDispatch } from "@/modules/email/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>;
}

const responseSchema = z.object({ response: z.string().trim().min(1).max(5_000) }).strict();

export async function POST(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  if (!token) return unauthorizedResponse();
  try {
    const { id, requestId } = await context.params;
    const parsed = responseSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApplicationError("VALIDATION_FAILED", "The response is invalid.", parsed.error.issues);
    }
    const application = await persistWithImmediateEmailDispatch(() =>
      getApplicationService().respondToInformationRequest(
        id,
        token,
        requestId,
        parsed.data.response,
      ),
    );
    return NextResponse.json({ id: application.id, status: application.status });
  } catch (error) {
    return errorResponse(error);
  }
}
