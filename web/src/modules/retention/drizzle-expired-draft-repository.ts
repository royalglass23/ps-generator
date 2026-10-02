import { and, asc, eq, inArray, lte } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { applications, uploads } from "@/lib/db/schema";

import type { ExpiredDraftCandidate, ExpiredDraftRepository } from "./expired-draft-cleanup-service";

export class DrizzleExpiredDraftRepository implements ExpiredDraftRepository {
  constructor(private readonly db: Database) {}

  async listExpiredDrafts(now: Date, limit: number): Promise<ExpiredDraftCandidate[]> {
    const rows = await this.db
      .select({ id: applications.id, expiresAt: applications.draftExpiresAt })
      .from(applications)
      .where(
        and(
          inArray(applications.status, ["draft", "expired_draft"]),
          lte(applications.draftExpiresAt, now),
        ),
      )
      .orderBy(asc(applications.draftExpiresAt))
      .limit(limit);

    return Promise.all(
      rows.flatMap((row) => {
        const expiresAt = row.expiresAt;
        return expiresAt
          ? [
              (async () => ({
                id: row.id,
                expiresAt,
                objectKeys: (
                  await this.db
                    .select({ objectKey: uploads.objectKey })
                    .from(uploads)
                    .where(eq(uploads.applicationId, row.id))
                ).map((upload) => upload.objectKey),
              }))(),
            ]
          : [];
      }),
    );
  }

  async claimExpiredDraft(id: string, expectedExpiry: Date, now: Date): Promise<boolean> {
    const [claimed] = await this.db
      .update(applications)
      .set({ status: "expired_draft", updatedAt: now })
      .where(
        and(
          eq(applications.id, id),
          eq(applications.status, "draft"),
          eq(applications.draftExpiresAt, expectedExpiry),
          lte(applications.draftExpiresAt, now),
        ),
      )
      .returning({ id: applications.id });
    if (claimed) return true;

    const [previouslyClaimed] = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.status, "expired_draft")))
      .limit(1);
    return Boolean(previouslyClaimed);
  }

  async deleteClaimedDraft(id: string): Promise<void> {
    await this.db
      .delete(applications)
      .where(and(eq(applications.id, id), eq(applications.status, "expired_draft")));
  }
}
