import type { EmailMessage } from "./types";

export interface OutboxJob extends EmailMessage {
  id: string;
  claimToken: string;
  attempts: number;
}

export interface OutboxRepository {
  claimNext(now: Date, leaseBefore: Date): Promise<OutboxJob | null>;
  markSent(id: string, claimToken: string, sentAt: Date, providerMessageId: string): Promise<void>;
  markFailed(
    id: string,
    claimToken: string,
    retryAt: Date,
    error: string,
  ): Promise<void>;
}

interface DispatcherDependencies {
  repository: OutboxRepository;
  send(message: EmailMessage): Promise<string>;
  now?: () => Date;
  batchSize?: number;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown email delivery failure").slice(0, 1_000);
}

function retryAt(now: Date, attempts: number): Date {
  const delayMinutes = Math.min(360, 5 * 2 ** attempts);
  return new Date(now.getTime() + delayMinutes * 60_000);
}

export class OutboxDispatcher {
  private readonly now: () => Date;
  private readonly batchSize: number;

  constructor(private readonly dependencies: DispatcherDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.batchSize = dependencies.batchSize ?? 10;
  }

  async run(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (let index = 0; index < this.batchSize; index += 1) {
      const now = this.now();
      const leaseBefore = new Date(now.getTime() - 10 * 60_000);
      const job = await this.dependencies.repository.claimNext(now, leaseBefore);
      if (!job) break;

      try {
        const providerMessageId = await this.dependencies.send({
          ...job,
          idempotencyKey: `ps1-outbox/${job.id}`,
        });
        await this.dependencies.repository.markSent(job.id, job.claimToken, now, providerMessageId);
        sent += 1;
      } catch (error) {
        await this.dependencies.repository.markFailed(
          job.id,
          job.claimToken,
          retryAt(now, job.attempts),
          errorMessage(error),
        );
        failed += 1;
      }
    }

    return { sent, failed };
  }
}
