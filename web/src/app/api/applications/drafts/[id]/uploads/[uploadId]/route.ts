import { NextResponse } from "next/server";

import { bearerToken, errorResponse, unauthorizedResponse } from "@/lib/http";
import { getUploadService } from "@/modules/applications/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; uploadId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const token = bearerToken(request);
  if (!token) return unauthorizedResponse();
  try {
    const { id, uploadId } = await context.params;
    await getUploadService().cancel({
      applicationId: id,
      uploadId,
      resumeToken: token,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
