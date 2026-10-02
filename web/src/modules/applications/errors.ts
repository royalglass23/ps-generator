export type ApplicationErrorCode =
  | "APPLICATION_NOT_AVAILABLE"
  | "APPLICATION_LOCKED"
  | "VALIDATION_FAILED"
  | "INFORMATION_REQUEST_NOT_OPEN"
  | "UNSUPPORTED_UPLOAD_TYPE"
  | "UPLOAD_LIMIT_REACHED"
  | "UPLOAD_TOO_LARGE"
  | "ABUSE_CHECK_FAILED"
  | "RATE_LIMITED";

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
