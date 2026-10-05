import { pendingUploadExpiresBefore } from "@/modules/uploads/upload-policy";
import type { UploadRecord } from "@/modules/uploads/upload-service";

export interface FailedUploadCleanupRepository {
  listForCleanup(staleBefore: Date, limit: number): Promise<UploadRecord[]>;
  beginCleanup(id: string, applicationId: string): Promise<UploadRecord | null>;
  finishCleanup(id: string, applicationId: string): Promise<void>;
}

interface CleanupDependencies {
  repository: FailedUploadCleanupRepository;
  objectStore: { delete(key: string): Promise<void> };
  now?: () => Date;
  batchSize?: number;
}

export class FailedUploadCleanupService {
  private readonly now: () => Date;
  private readonly batchSize: number;

  constructor(private readonly dependencies: CleanupDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.batchSize = dependencies.batchSize ?? 100;
  }

  async run(): Promise<{ deleted: number; failed: number }> {
    const candidates = await this.dependencies.repository.listForCleanup(
      pendingUploadExpiresBefore(this.now()),
      this.batchSize,
    );
    let deleted = 0;
    let failed = 0;

    for (const upload of candidates) {
      try {
        const candidate = await this.dependencies.repository.beginCleanup(
          upload.id,
          upload.applicationId,
        );
        if (!candidate) continue;
        await this.dependencies.objectStore.delete(candidate.objectKey);
        await this.dependencies.repository.finishCleanup(candidate.id, candidate.applicationId);
        deleted += 1;
      } catch (error) {
        failed += 1;
        console.error("Failed PS1 upload cleanup failed", { uploadId: upload.id, error });
      }
    }

    return { deleted, failed };
  }
}
