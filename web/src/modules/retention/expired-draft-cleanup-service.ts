export interface ExpiredDraftCandidate {
  id: string;
  expiresAt: Date;
  objectKeys: string[];
}

export interface ExpiredDraftRepository {
  listExpiredDrafts(now: Date, limit: number): Promise<ExpiredDraftCandidate[]>;
  claimExpiredDraft(id: string, expectedExpiry: Date, now: Date): Promise<boolean>;
  deleteClaimedDraft(id: string): Promise<void>;
}

interface CleanupDependencies {
  repository: ExpiredDraftRepository;
  objectStore: { delete(key: string): Promise<void> };
  now?: () => Date;
  batchSize?: number;
}

export class ExpiredDraftCleanupService {
  private readonly now: () => Date;
  private readonly batchSize: number;

  constructor(private readonly dependencies: CleanupDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.batchSize = dependencies.batchSize ?? 100;
  }

  async run(): Promise<{ deleted: number; failed: number }> {
    const now = this.now();
    const candidates = await this.dependencies.repository.listExpiredDrafts(now, this.batchSize);
    let deleted = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const claimed = await this.dependencies.repository.claimExpiredDraft(
          candidate.id,
          candidate.expiresAt,
          now,
        );
        if (!claimed) continue;
        for (const objectKey of candidate.objectKeys) {
          await this.dependencies.objectStore.delete(objectKey);
        }
        await this.dependencies.repository.deleteClaimedDraft(candidate.id);
        deleted += 1;
      } catch (error) {
        failed += 1;
        console.error("Expired PS1 draft cleanup failed", { applicationId: candidate.id, error });
      }
    }

    return { deleted, failed };
  }
}
