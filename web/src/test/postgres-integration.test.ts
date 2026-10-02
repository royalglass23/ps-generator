import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { applications, emailOutbox, informationRequests, rateLimits, uploads } from "@/lib/db/schema";
import { DrizzleApplicationRepository } from "@/modules/applications/drizzle-application-repository";
import type { ApplicationRecord } from "@/modules/applications/types";
import { DrizzleOutboxRepository } from "@/modules/email/drizzle-outbox-repository";
import type { EmailMessage } from "@/modules/email/types";
import { DrizzleRateLimitRepository } from "@/modules/security/drizzle-rate-limit-repository";
import { RateLimiter } from "@/modules/security/rate-limiter";
import { DrizzleUploadRepository } from "@/modules/uploads/drizzle-upload-repository";

const NOW = new Date("2026-10-02T00:00:00.000Z");
const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

describe("PostgreSQL adapters", () => {
  const client = new PGlite();
  const database = drizzle(client, { schema }) as unknown as Database;

  beforeAll(async () => {
    const directory = join(process.cwd(), "drizzle");
    for (const name of readdirSync(directory).filter((value) => value.endsWith(".sql")).sort()) {
      const migration = readFileSync(join(directory, name), "utf8");
      for (const statement of migration.split("--> statement-breakpoint")) {
        if (statement.trim()) await client.exec(statement);
      }
    }
  });

  afterAll(async () => {
    await client.close();
  });

  it("commits submission and outbox rows atomically, then claims an email", async () => {
    const repository = new DrizzleApplicationRepository(database);
    const draft: ApplicationRecord = {
      id: APPLICATION_ID,
      reference: null,
      status: "draft",
      resumeTokenHash: "hash",
      payload: {},
      draftExpiresAt: new Date("2026-10-09T00:00:00.000Z"),
      createdAt: NOW,
      updatedAt: NOW,
      submittedAt: null,
      lockedAt: null,
    };
    await repository.createDraft(draft);
    const message = (kind: EmailMessage["kind"]): EmailMessage => ({
      kind,
      from: "Royal Glass <support@royalglass.co.nz>",
      to: ["recipient@example.test"],
      subject: "PS1",
      text: "PS1",
      html: "<p>PS1</p>",
    });

    await repository.submit({
      id: APPLICATION_ID,
      payload: {
        need: "ps1",
        applicant: {
          name: "Jordan Applicant",
          mobile: "021 555 0101",
          email: "jordan@example.test",
          role: "homeowner",
        },
        project: {
          address: "28 Example Street",
          city: "Auckland",
          postalCode: "1010",
          buildingConsentNumber: "",
          resourceConsentNumber: "",
          estimatedInstallation: "3_months",
          stage: "preparing_consent",
        },
        design: { family: "balustrade", system: "not-sure" },
        site: {
          substrate: "timber",
          locations: [{ types: ["deck"], environment: "external", other: "" }],
        },
        acknowledgement: { accepted: true },
      },
      reference: "PS1-2026-ABC12345",
      submittedAt: NOW,
      buildMessages: () => [message("internal_submission"), message("applicant_confirmation")],
    });

    const rows = await database.select().from(emailOutbox);
    expect(rows).toHaveLength(2);
    const outbox = new DrizzleOutboxRepository(database);
    const claimNow = new Date("2026-10-03T00:00:00.000Z");
    const claimed = await outbox.claimNext(claimNow, new Date(claimNow.getTime() - 600_000));
    expect(claimed?.attempts).toBe(1);
    await outbox.markSent(claimed!.id, claimed!.claimToken, claimNow, "provider-1");
    expect((await database.select().from(emailOutbox).where(eq(emailOutbox.id, claimed!.id)))[0]?.sentAt).toEqual(claimNow);
  });

  it("atomically rejects concurrent requests beyond a shared rate-limit bucket", async () => {
    const limiter = new RateLimiter({
      repository: new DrizzleRateLimitRepository(database),
      secret: "an-integration-secret-that-is-at-least-32-characters",
      now: () => NOW,
    });

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        limiter.consume({ scope: "draft_create", identifier: "203.0.113.10", limit: 5 }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rows = await database.select().from(rateLimits);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(5);
    expect(rows[0]?.keyHash).not.toContain("203.0.113.10");
  });

  it("serializes upload reservations so concurrent requests cannot exceed five files", async () => {
    const uploadRepository = new DrizzleUploadRepository(database);
    await database
      .update(applications)
      .set({ status: "more_information_required" })
      .where(eq(applications.id, APPLICATION_ID));
    await database.insert(informationRequests).values({
      id: REQUEST_ID,
      applicationId: APPLICATION_ID,
      message: "Please add details",
    });

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        uploadRepository.reserve(
          {
            id: `33333333-3333-4333-8333-33333333333${index}`,
            applicationId: APPLICATION_ID,
            informationRequestId: REQUEST_ID,
            objectKey: `applications/${APPLICATION_ID}/information-requests/${REQUEST_ID}/${index}`,
            originalName: `drawing-${index}.pdf`,
            contentType: "application/pdf",
            sizeBytes: 10,
            status: "pending",
          },
          { requestId: REQUEST_ID },
          { maxFiles: 5, maxTotalBytes: 1_000 },
        ),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    expect(await database.select().from(uploads)).toHaveLength(5);
  });

  it("attaches ready More Information uploads to the transactional notification", async () => {
    await database.update(uploads).set({ status: "ready" });
    const repository = new DrizzleApplicationRepository(database);
    await repository.respondToInformationRequest({
      applicationId: APPLICATION_ID,
      requestId: REQUEST_ID,
      response: "The requested drawings are attached.",
      respondedAt: new Date("2026-10-02T01:00:00.000Z"),
      message: {
        kind: "information_response_received",
        from: "PS1 Generator <support@royalglass.co.nz>",
        to: ["support@royalglass.co.nz", "servicem8@example.test"],
        subject: "PS1 information received",
        text: "Information received",
        html: "<p>Information received</p>",
      },
    });

    const rows = await database
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.kind, "information_response_received"));
    expect(rows[0]?.attachments).toHaveLength(5);
  });
});
