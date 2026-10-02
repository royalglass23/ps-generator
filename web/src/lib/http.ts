import { NextResponse } from "next/server";

import { ApplicationError } from "@/modules/applications/errors";

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = /^Bearer ([A-Za-z0-9_-]{12,})$/.exec(authorization ?? "");
  return match?.[1] ?? null;
}

export function requestIp(request: Request): string {
  const value =
    request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "";
  return value.split(",")[0]?.trim().slice(0, 64) || "unavailable";
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "APPLICATION_NOT_AVAILABLE" }, { status: 404 });
}

export function errorResponse(error: unknown) {
  if (!(error instanceof ApplicationError)) {
    console.error("PS1 API request failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  const status =
    {
      APPLICATION_NOT_AVAILABLE: 404,
      APPLICATION_LOCKED: 409,
      VALIDATION_FAILED: 422,
      INFORMATION_REQUEST_NOT_OPEN: 409,
      UNSUPPORTED_UPLOAD_TYPE: 415,
      UPLOAD_LIMIT_REACHED: 409,
      UPLOAD_TOO_LARGE: 413,
      ABUSE_CHECK_FAILED: 403,
      RATE_LIMITED: 429,
    }[error.code] ?? 500;
  return NextResponse.json(
    {
      error: error.code,
      ...(error.code === "VALIDATION_FAILED" ? { details: error.details } : {}),
    },
    { status },
  );
}
