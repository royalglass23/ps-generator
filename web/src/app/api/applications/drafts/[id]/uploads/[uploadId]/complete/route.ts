import { NextResponse } from "next/server";

import { bearerToken, errorResponse, unauthorizedResponse } from "@/lib/http";
import { getUploadService } from "@/modules/applications/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; uploadId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  if (!token) return unauthorizedResponse();
  try {
    const { id, uploadId } = await context.params;
    const upload = await getUploadService().complete({
      applicationId: id,
      uploadId,
      resumeToken: token,
    });
    return NextResponse.json({
      id: upload.id,
      originalName: upload.originalName,
      contentType: upload.contentType,
      sizeBytes: upload.sizeBytes,
      status: upload.status,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
