interface ResumeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const resumeStorageKey = (applicationId: string) => `rg-ps1-resume-token:${applicationId}`;

function validToken(token: string): boolean {
  return token.length >= 1 && token.length <= 1024;
}

export function rememberResumeToken(
  applicationId: string,
  token: string,
  storage: ResumeStorage,
): boolean {
  if (!validToken(token)) return false;
  try {
    storage.setItem(resumeStorageKey(applicationId), token);
    return true;
  } catch {
    return false;
  }
}

export function resolveResumeToken(
  applicationId: string,
  hash: string,
  storage: ResumeStorage,
): { token: string; consumedFragment: boolean } | null {
  if (/^#token=[^#]{1,2048}$/.test(hash)) {
    try {
      const token = decodeURIComponent(hash.slice("#token=".length));
      if (!validToken(token)) return null;
      return {
        token,
        consumedFragment: rememberResumeToken(applicationId, token, storage),
      };
    } catch {
      return null;
    }
  }

  try {
    const token = storage.getItem(resumeStorageKey(applicationId));
    return token && validToken(token) ? { token, consumedFragment: false } : null;
  } catch {
    return null;
  }
}

export function clearResumeToken(applicationId: string, storage: ResumeStorage): void {
  try {
    storage.removeItem(resumeStorageKey(applicationId));
  } catch {
    // The submitted application is locked server-side even if browser cleanup is unavailable.
  }
}
