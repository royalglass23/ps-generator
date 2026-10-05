export const submittedApplicationPath = "/application/submitted";

const receiptStorageKey = "rg-ps1-submission-receipt";

export interface SubmissionReceipt {
  reference: string;
  submittedAt: string;
  email: string;
}

interface ReceiptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ReceiptDependencies {
  storage?: ReceiptStorage;
  replaceUrl?: (url: string) => void;
}

export function getSubmissionReceiptSnapshot(storage: ReceiptStorage): string | null {
  try {
    return storage.getItem(receiptStorageKey);
  } catch {
    return null;
  }
}

export function persistSubmissionReceipt(
  receipt: SubmissionReceipt,
  dependencies: ReceiptDependencies = {},
): void {
  const storage = dependencies.storage ?? window.sessionStorage;
  const replaceUrl = dependencies.replaceUrl
    ?? ((url: string) => window.history.replaceState({}, "", url));

  try {
    storage.setItem(receiptStorageKey, JSON.stringify(receipt));
  } catch {
    // The token-free receipt route remains useful even when browser storage is unavailable.
  }

  replaceUrl(submittedApplicationPath);
}

export function loadSubmissionReceipt(storage: ReceiptStorage): SubmissionReceipt | null {
  return parseSubmissionReceipt(getSubmissionReceiptSnapshot(storage));
}

export function parseSubmissionReceipt(serializedReceipt: string | null): SubmissionReceipt | null {
  try {
    const value: unknown = JSON.parse(serializedReceipt ?? "null");
    if (!value || typeof value !== "object") return null;

    const receipt = value as Record<string, unknown>;
    if (
      typeof receipt.reference !== "string"
      || typeof receipt.submittedAt !== "string"
      || typeof receipt.email !== "string"
    ) return null;

    return {
      reference: receipt.reference,
      submittedAt: receipt.submittedAt,
      email: receipt.email,
    };
  } catch {
    return null;
  }
}
