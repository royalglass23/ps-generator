import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getCronConfig } from "@/lib/config";
import { getDatabase } from "@/lib/db/client";
import { DrizzleExpiredDraftRepository } from "@/modules/retention/drizzle-expired-draft-repository";
import { ExpiredDraftCleanupService } from "@/modules/retention/expired-draft-cleanup-service";
import { FailedUploadCleanupService } from "@/modules/retention/failed-upload-cleanup-service";
import { DrizzleRateLimitRepository } from "@/modules/security/drizzle-rate-limit-repository";
import { DrizzleUploadRepository } from "@/modules/uploads/drizzle-upload-repository";
import { r2ObjectStore } from "@/modules/uploads/r2-object-store";

export const runtime = "nodejs";

function secretsMatch(supplied: string | null, expected: string): boolean {
  if (!supplied?.startsWith("Bearer ")) return false;
  const suppliedBytes = Buffer.from(supplied.slice(7));
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function GET(request: Request) {
  const { CRON_SECRET } = getCronConfig();
  if (!secretsMatch(request.headers.get("authorization"), CRON_SECRET)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const database = getDatabase();
  const service = new ExpiredDraftCleanupService({
    repository: new DrizzleExpiredDraftRepository(database),
    objectStore: r2ObjectStore,
  });
  const result = await service.run();
  const failedUploadCleanup = await new FailedUploadCleanupService({
    repository: new DrizzleUploadRepository(database),
    objectStore: r2ObjectStore,
  }).run();
  const expiredRateLimitsDeleted = await new DrizzleRateLimitRepository(database).deleteExpired(
    new Date(),
  );
  return NextResponse.json(
    { ...result, failedUploadCleanup, expiredRateLimitsDeleted },
    { status: result.failed || failedUploadCleanup.failed ? 503 : 200 },
  );
}

export const POST = GET;
