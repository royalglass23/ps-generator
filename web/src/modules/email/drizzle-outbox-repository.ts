import { randomUUID } from "node:crypto";

import { and, eq, isNull, lt, lte, or, sql } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { emailOutbox } from "@/lib/db/schema";

import type { OutboxJob, OutboxRepository } from "./outbox-dispatcher";

export class DrizzleOutboxRepository implements OutboxRepository {
  constructor(private readonly db: Database) {}

  async claimNext(now: Date, leaseBefore: Date): Promise<OutboxJob | null> {
    return this.db.transaction(async (transaction) => {
      const [candidate] = await transaction
        .select()
        .from(emailOutbox)
        .where(
          and(
            isNull(emailOutbox.sentAt),
            lte(emailOutbox.availableAt, now),
            lt(emailOutbox.attempts, 5),
            or(isNull(emailOutbox.claimedAt), lte(emailOutbox.claimedAt, leaseBefore)),
          ),
        )
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return null;

      const claimToken = randomUUID();
      const [claimed] = await transaction
        .update(emailOutbox)
        .set({
          claimToken,
          claimedAt: now,
          attempts: sql`${emailOutbox.attempts} + 1`,
        })
        .where(eq(emailOutbox.id, candidate.id))
        .returning();
      if (!claimed) return null;
      return {
        id: claimed.id,
        claimToken,
        attempts: claimed.attempts,
        kind: claimed.kind,
        from: claimed.fromAddress,
        to: claimed.toAddresses,
        ...(claimed.replyTo ? { replyTo: claimed.replyTo } : {}),
        subject: claimed.subject,
        text: claimed.textBody,
        html: claimed.htmlBody,
        attachments: claimed.attachments,
      };
    });
  }

  async markSent(
    id: string,
    claimToken: string,
    sentAt: Date,
    providerMessageId: string,
  ): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({ sentAt, providerMessageId, claimToken: null, claimedAt: null, lastError: null })
      .where(and(eq(emailOutbox.id, id), eq(emailOutbox.claimToken, claimToken)));
  }

  async markFailed(
    id: string,
    claimToken: string,
    retryAt: Date,
    error: string,
  ): Promise<void> {
    await this.db
      .update(emailOutbox)
      .set({ availableAt: retryAt, lastError: error, claimToken: null, claimedAt: null })
      .where(and(eq(emailOutbox.id, id), eq(emailOutbox.claimToken, claimToken)));
  }
}
