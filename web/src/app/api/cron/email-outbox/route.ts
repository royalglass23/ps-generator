import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getCronConfig } from "@/lib/config";
import { getEmailOutboxDispatcher } from "@/modules/email/runtime";

export const runtime = "nodejs";

function authorized(header: string | null, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expectedBytes = Buffer.from(expected);
  return supplied.length === expectedBytes.length && timingSafeEqual(supplied, expectedBytes);
}

export async function GET(request: Request) {
  const { CRON_SECRET } = getCronConfig();
  if (!authorized(request.headers.get("authorization"), CRON_SECRET)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await getEmailOutboxDispatcher().run();
  return NextResponse.json(result, { status: result.failed ? 503 : 200 });
}

export const POST = GET;
