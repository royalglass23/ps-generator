export const uploadUrlTtlSeconds = 10 * 60;
const pendingUploadGraceSeconds = 60;

export function pendingUploadExpiresBefore(now: Date): Date {
  return new Date(
    now.getTime() - (uploadUrlTtlSeconds + pendingUploadGraceSeconds) * 1_000,
  );
}
