interface ResumeUrlInput {
  applicationBaseUrl: string;
  publicApplicationUrl?: string;
  applicationId: string;
  resumeToken: string;
}

export function buildResumeUrl(input: ResumeUrlInput): string {
  const token = encodeURIComponent(input.resumeToken);
  if (input.publicApplicationUrl) {
    const url = new URL(input.publicApplicationUrl);
    url.searchParams.set("application", input.applicationId);
    url.hash = `token=${token}`;
    return url.toString();
  }

  const base = input.applicationBaseUrl.replace(/\/$/, "");
  return `${base}/application/${encodeURIComponent(input.applicationId)}#token=${token}`;
}
