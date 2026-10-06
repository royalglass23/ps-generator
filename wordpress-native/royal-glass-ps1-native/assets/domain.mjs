export const applicationInputLimits = Object.freeze({
  name: 100,
  mobile: 25,
  email: 320,
  address: 250,
  consentNumber: 50,
  otherLocation: 200,
});

export const allowedUploads = Object.freeze({
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  dwg: "application/dwg",
});

export const initialJourneyState = Object.freeze({
  need: "ps1",
  applicant: {
    name: "",
    mobile: "",
    email: "",
    role: "",
    decisionMaker: { name: "", mobile: "", email: "" },
  },
  project: {
    address: "",
    buildingConsentNumber: "",
    resourceConsentNumber: "",
    estimatedInstallation: "not_sure",
    stage: "",
  },
  design: { family: "balustrade", system: "" },
  site: { substrate: "not_sure", locations: [] },
  acknowledgement: false,
});

const namePattern = /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u;
const addressPattern = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ,.'’\-\/#&()]*$/u;
const consentPattern = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/;
const otherPattern = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ,.?!”“'’\-\/()&:]*$/u;

function normalized(value) {
  return String(value ?? "").normalize("NFC").trim();
}

function validNzPhone(value) {
  if (!/^[+0-9 ()-]+$/.test(value)) return false;
  const compact = value.replace(/[ ()-]/g, "");
  const national = compact.startsWith("+64") ? compact.slice(3) : compact.slice(1);
  if (!/^(?:2\d{7,9}|[34679]\d{7})$/.test(national)) return false;
  return /^(?:\+64|0)\d+$/.test(value)
    || /^(?:0(?:2\d|[34679])|\+64[ -](?:2\d|[34679]))[ -]\d{3,4}[ -]\d{3,4}$/.test(value)
    || /^\(0(?:2\d|[34679])\)[ -]\d{3,4}[ -]\d{3,4}$/.test(value);
}

export function validateInput(name, rawValue) {
  const value = normalized(rawValue);
  if (name === "name") {
    if (!value) return "Enter your full name.";
    if (value.length > applicationInputLimits.name) return "Use 100 characters or fewer.";
    return namePattern.test(value) ? null : "Use letters, spaces, apostrophes, hyphens or periods only.";
  }
  if (name === "mobile") {
    if (!value) return "Enter your phone number.";
    if (value.length > applicationInputLimits.mobile) return "Use 25 characters or fewer.";
    return validNzPhone(value) ? null : "Enter a valid NZ mobile or landline number.";
  }
  if (name === "email") {
    if (!value) return "Enter your email address.";
    if (value.length > applicationInputLimits.email) return "Use 320 characters or fewer.";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : "Enter a valid email address.";
  }
  if (name === "address") {
    if (!value) return "Enter the job address.";
    if (value.length > applicationInputLimits.address) return "Use 250 characters or fewer.";
    return addressPattern.test(value) ? null : "Use letters, numbers and normal address punctuation only.";
  }
  if (name === "buildingConsentNumber" || name === "resourceConsentNumber") {
    if (!value) return null;
    if (value.length > applicationInputLimits.consentNumber) return "Use 50 characters or fewer.";
    return consentPattern.test(value) ? null : "Use letters, numbers, spaces, hyphens, slashes or periods only.";
  }
  if (name === "otherLocation") {
    if (!value) return "Describe the other location.";
    if (value.length > applicationInputLimits.otherLocation) return "Use 200 characters or fewer.";
    return otherPattern.test(value) ? null : "Use ordinary words, numbers and punctuation only.";
  }
  return "Check this value.";
}

export function nextLocationTypes(current, type) {
  if (type === "pool-area") return current.includes(type) ? [] : [type];
  const withoutPool = current.filter((entry) => entry !== "pool-area");
  if (withoutPool.includes(type)) return withoutPool.filter((entry) => entry !== type);
  return withoutPool.length >= 3 ? withoutPool : [...withoutPool, type];
}

export function uploadRemovalDisabled(status) {
  return status === "uploading" || status === "removing";
}

function decisionMakerForRole(state) {
  if (state.applicant.role !== "architect" && state.applicant.role !== "builder") return undefined;
  return {
    name: normalized(state.applicant.decisionMaker.name),
    mobile: normalized(state.applicant.decisionMaker.mobile),
    email: normalized(state.applicant.decisionMaker.email),
  };
}

export function buildDraftPayload(state) {
  const decisionMaker = decisionMakerForRole(state);
  return {
    need: state.need,
    applicant: {
      name: normalized(state.applicant.name),
      mobile: normalized(state.applicant.mobile),
      email: normalized(state.applicant.email),
      role: state.applicant.role || undefined,
      ...(decisionMaker ? { decisionMaker } : {}),
    },
    project: {
      address: normalized(state.project.address),
      buildingConsentNumber: normalized(state.project.buildingConsentNumber).toUpperCase(),
      resourceConsentNumber: normalized(state.project.resourceConsentNumber).toUpperCase(),
      estimatedInstallation: state.project.estimatedInstallation,
      stage: state.project.stage || undefined,
    },
    design: { family: state.design.family || undefined, system: state.design.system },
    site: {
      substrate: state.site.substrate,
      locations: state.site.locations.map((location) => ({
        types: [...location.types],
        environment: location.environment || undefined,
        other: normalized(location.other),
      })),
    },
  };
}

export function applicantDetailsError(state) {
  for (const [name, value] of [["name", state.applicant.name], ["mobile", state.applicant.mobile], ["email", state.applicant.email]]) {
    const error = validateInput(name, value);
    if (error) return error;
  }
  const decisionMaker = decisionMakerForRole(state);
  if (decisionMaker) {
    for (const [name, value] of [["name", decisionMaker.name], ["mobile", decisionMaker.mobile], ["email", decisionMaker.email]]) {
      const error = validateInput(name, value);
      if (error) return `Homeowner or decision-maker: ${error}`;
    }
  }
  return null;
}

export function buildSubmissionPayload(state) {
  if (!state.acknowledgement) throw new Error("Confirm the application before submitting it.");
  if (!state.applicant.role) throw new Error("Select your role in the project before submitting.");
  const applicantError = applicantDetailsError(state);
  if (applicantError) throw new Error(applicantError);
  const draft = buildDraftPayload(state);
  return {
    ...draft,
    applicant: { ...draft.applicant, role: state.applicant.role },
    project: { ...draft.project, stage: state.project.stage || undefined },
    design: { family: state.design.family || "not_sure", system: state.design.system },
    site: {
      ...draft.site,
      locations: draft.site.locations.map((location) => {
        if (!location.environment) throw new Error("Choose internal or external for every area.");
        return { ...location, environment: location.environment };
      }),
    },
    acknowledgement: { accepted: true },
  };
}

export function validateUpload(file) {
  if (Number(file.size) > 10 * 1024 * 1024) return "This file is too large. The maximum file size is 10 MB.";
  const extension = String(file.name ?? "").toLowerCase().split(".").pop();
  const expected = allowedUploads[extension] ?? null;
  const supplied = String(file.type ?? "").toLowerCase();
  const dwgTypes = new Set(["application/dwg", "application/acad", "application/x-acad", "image/vnd.dwg", "application/octet-stream"]);
  const typeMatches = expected === "application/dwg" ? dwgTypes.has(supplied || "application/octet-stream") : supplied === expected;
  return expected && typeMatches ? null : "Use a PDF, JPG, PNG or DWG file.";
}

export function stateFromDraft(payload) {
  const state = structuredClone(initialJourneyState);
  return {
    ...state,
    need: payload?.need ?? state.need,
    applicant: {
      ...state.applicant,
      ...(payload?.applicant ?? {}),
      decisionMaker: { ...state.applicant.decisionMaker, ...(payload?.applicant?.decisionMaker ?? {}) },
    },
    project: { ...state.project, ...(payload?.project ?? {}) },
    design: { ...state.design, ...(payload?.design ?? {}) },
    site: {
      ...state.site,
      ...(payload?.site ?? {}),
      locations: (payload?.site?.locations ?? []).map((location) => ({
        types: [...(location.types ?? [])],
        environment: location.environment ?? "",
        other: location.other ?? "",
      })),
    },
    acknowledgement: false,
  };
}
