import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getCronConfig } from "@/lib/config";
import { getDatabase } from "@/lib/db/client";
import { DrizzleOutboxRepository } from "@/modules/email/drizzle-outbox-repository";
import { OutboxDispatcher } from "@/modules/email/outbox-dispatcher";
import { sendEmail } from "@/modules/email/resend-sender";

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

  const dispatcher = new OutboxDispatcher({
    repository: new DrizzleOutboxRepository(getDatabase()),
    send: sendEmail,
  });
  const result = await dispatcher.run();
  return NextResponse.json(result, { status: result.failed ? 503 : 200 });
}

export const POST = GET;
