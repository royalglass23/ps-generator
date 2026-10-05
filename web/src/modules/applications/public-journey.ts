import type { DraftPayload, SubmissionPayload } from "./schemas";

export interface JourneyState {
  need: NonNullable<DraftPayload["need"]>;
  applicant: {
    name: string;
    mobile: string;
    email: string;
    role: NonNullable<NonNullable<DraftPayload["applicant"]>["role"]> | "";
  };
  project: {
    address: string;
    city: string;
    postalCode: string;
    buildingConsentNumber: string;
    resourceConsentNumber: string;
    estimatedInstallation: NonNullable<NonNullable<DraftPayload["project"]>["estimatedInstallation"]>;
    stage: NonNullable<NonNullable<DraftPayload["project"]>["stage"]> | "";
  };
  design: {
    family: NonNullable<NonNullable<DraftPayload["design"]>["family"]> | "";
    system: string;
  };
  site: {
    substrate: NonNullable<NonNullable<DraftPayload["site"]>["substrate"]>;
    locations: Array<{
      types: string[];
      environment: "internal" | "external" | "";
      other: string;
    }>;
  };
  acknowledgement: boolean;
}

export interface DraftSession {
  id: string;
  resumeToken: string;
  expiresAt: string;
  resumeUrl: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  sizeBytes: number;
}

export function contentTypeForUpload(file: Pick<File, "name" | "type">): string {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split(".").at(-1);
  return ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", dwg: "application/dwg" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

type Fetcher = typeof fetch;

export const initialJourneyState: JourneyState = {
  need: "ps1",
  applicant: { name: "", mobile: "", email: "", role: "" },
  project: {
    address: "",
    city: "",
    postalCode: "",
    buildingConsentNumber: "",
    resourceConsentNumber: "",
    estimatedInstallation: "not_sure",
    stage: "",
  },
  design: { family: "balustrade", system: "" },
  site: {
    substrate: "not_sure",
    locations: [],
  },
  acknowledgement: false,
};

export function saveForLaterError(state: JourneyState): string | null {
  const { name, mobile, email } = state.applicant;
  if (name.trim() && mobile.trim() && /^\S+@\S+\.\S+$/.test(email.trim())) return null;
  return "Enter your full name, mobile number, and a valid email address before saving for later.";
}

export function buildDraftPayload(state: JourneyState): DraftPayload {
  return {
    need: state.need,
    applicant: { ...state.applicant, role: state.applicant.role || undefined },
    project: { ...state.project, stage: state.project.stage || undefined },
    design: { ...state.design, family: state.design.family || undefined },
    site: {
      substrate: state.site.substrate,
      locations: state.site.locations.map((location) => ({
        types: [...location.types],
        environment: location.environment || undefined,
        other: location.other,
      })),
    },
  };
}

export function buildSubmissionPayload(state: JourneyState): SubmissionPayload {
  if (!state.acknowledgement) {
    throw new Error("Confirm the application before submitting it.");
  }
  if (!state.applicant.role) {
    throw new Error("Select your role in the project before submitting.");
  }
  const draft = buildDraftPayload(state);
  return {
    ...draft,
    need: state.need,
    applicant: {
      name: state.applicant.name,
      mobile: state.applicant.mobile,
      email: state.applicant.email,
      role: state.applicant.role,
    },
    project: {
      address: state.project.address,
      city: state.project.city,
      postalCode: state.project.postalCode,
      buildingConsentNumber: state.project.buildingConsentNumber,
      resourceConsentNumber: state.project.resourceConsentNumber,
      estimatedInstallation: state.project.estimatedInstallation,
      stage: state.project.stage || undefined,
    },
    design: {
      family: state.design.family || "not_sure",
      system: state.design.system,
    },
    site: {
      substrate: state.site.substrate,
      locations: state.site.locations.map((location) => {
        if (!location.environment) throw new Error("Choose internal or external for every area.");
        return { types: [...location.types], environment: location.environment, other: location.other };
      }),
    },
    acknowledgement: { accepted: true },
  } as SubmissionPayload;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string } & T;
  if (!response.ok) {
    throw new Error(body.message || friendlyApiError(body.error));
  }
  return body;
}

function friendlyApiError(code?: string): string {
  const messages: Record<string, string> = {
    ABUSE_CHECK_FAILED: "Complete the security check and try again.",
    VALIDATION_FAILED: "Check the highlighted information and try again.",
    APPLICATION_NOT_AVAILABLE: "This application link is no longer available.",
    UPLOAD_TOO_LARGE: "This file is too large. The maximum file size is 10 MB.",
    UNSUPPORTED_UPLOAD_TYPE: "Use a PDF, JPG, PNG or DWG file.",
    RATE_LIMITED: "Too many attempts were made. Wait a little and try again.",
  };
  return messages[code ?? ""] ?? "Something went wrong. Your information is still on this page; try again.";
}

export async function createDraftSession(
  turnstileToken: string,
  fetcher: Fetcher = fetch,
): Promise<DraftSession> {
  return readJson<DraftSession>(
    await fetcher("/api/applications/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    }),
  );
}

export async function saveDraft(
  session: DraftSession,
  state: JourneyState,
  fetcher: Fetcher = fetch,
): Promise<void> {
  await readJson(
    await fetcher(`/api/applications/drafts/${session.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.resumeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDraftPayload(state)),
    }),
  );
}

export async function sendDraftResumeLink(
  session: DraftSession,
  fetcher: Fetcher = fetch,
): Promise<{ email: string; resumeUrl: string }> {
  return readJson(
    await fetcher(`/api/applications/drafts/${session.id}/resume-link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.resumeToken}` },
    }),
  );
}

export async function loadDraft(
  id: string,
  resumeToken: string,
  fetcher: Fetcher = fetch,
): Promise<JourneyState> {
  const result = await readJson<{ payload: DraftPayload }>(
    await fetcher(`/api/applications/drafts/${id}`, {
      headers: { Authorization: `Bearer ${resumeToken}` },
    }),
  );
  const payload = result.payload;
  return {
    need: payload.need ?? initialJourneyState.need,
    applicant: { ...initialJourneyState.applicant, ...payload.applicant },
    project: { ...initialJourneyState.project, ...payload.project },
    design: { ...initialJourneyState.design, ...payload.design },
    site: {
      substrate: payload.site?.substrate ?? initialJourneyState.site.substrate,
      locations: (payload.site?.locations?.length
        ? payload.site.locations
        : initialJourneyState.site.locations
      ).map((location) => ({
        types: [...(location.types ?? [])],
        environment: location.environment ?? "",
        other: location.other ?? "",
      })),
    },
    acknowledgement: false,
  };
}

export async function uploadApplicationFile(
  session: DraftSession,
  file: File,
  fetcher: Fetcher = fetch,
): Promise<UploadedFile> {
  const contentType = contentTypeForUpload(file);
  const reservation = await readJson<{ id: string; uploadUrl: string; headers: Record<string, string> }>(
    await fetcher(`/api/applications/drafts/${session.id}/uploads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.resumeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ originalName: file.name, contentType, sizeBytes: file.size }),
    }),
  );
  const uploadResponse = await fetcher(reservation.uploadUrl, {
    method: "PUT",
    headers: reservation.headers,
    body: file,
  });
  if (!uploadResponse.ok) throw new Error("The file could not be uploaded. Try again.");
  await readJson(
    await fetcher(`/api/applications/drafts/${session.id}/uploads/${reservation.id}/complete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.resumeToken}` },
    }),
  );
  return { id: reservation.id, name: file.name, sizeBytes: file.size };
}

export async function submitApplication(
  session: DraftSession,
  state: JourneyState,
  fetcher: Fetcher = fetch,
): Promise<{ reference: string; submittedAt: string }> {
  return readJson(
    await fetcher(`/api/applications/drafts/${session.id}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.resumeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildSubmissionPayload(state)),
    }),
  );
}
