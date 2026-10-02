import { NextResponse } from "next/server";
import { z } from "zod";

import { bearerToken, errorResponse, unauthorizedResponse } from "@/lib/http";
import { ApplicationError } from "@/modules/applications/errors";
import { getApplicationService, getUploadService } from "@/modules/applications/runtime";
import { limitUploadReservation } from "@/modules/security/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const reservationSchema = z
  .object({
    originalName: z.string().min(1).max(500),
    contentType: z.string().min(1).max(100),
    sizeBytes: z.number().int().positive(),
    informationRequestId: z.uuid().optional(),
  })
  .strict();

export async function POST(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  if (!token) return unauthorizedResponse();
  try {
    const parsed = reservationSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApplicationError("VALIDATION_FAILED", "The upload details are invalid.", parsed.error.issues);
    }
    const { id } = await context.params;
    await getApplicationService().authorizeForUpload(
      id,
      token,
      parsed.data.informationRequestId,
    );
    await limitUploadReservation(id);
    const result = await getUploadService().reserve({
      applicationId: id,
      resumeToken: token,
      requestId: parsed.data.informationRequestId,
      originalName: parsed.data.originalName,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json(
      {
        id: result.upload.id,
        uploadUrl: result.uploadUrl,
        method: "PUT",
        headers: { "Content-Type": result.upload.contentType },
        expiresInSeconds: 600,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
