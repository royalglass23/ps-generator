import type { SubmissionPayload } from "./schemas";

const roleLabels: Record<SubmissionPayload["applicant"]["role"], string> = {
  architect: "Architect / Designer",
  builder: "Builder",
  developer: "Developer",
  homeowner: "Homeowner",
  other: "Other",
};

const installationLabels: Record<SubmissionPayload["project"]["estimatedInstallation"], string> = {
  asap: "ASAP",
  "3_months": "Within 3 months",
  "6_months": "Within 6 months",
  "1_year": "Within 1 year",
  "2_years": "Within 2 years",
  not_sure: "Not sure",
};

const stageLabels: Record<NonNullable<SubmissionPayload["project"]["stage"]>, string> = {
  concept: "Concept / Early Design",
  developed: "Developed Design",
  preparing_consent: "Preparing Building Consent",
  consent_lodged: "Building Consent lodged",
  council_rfi: "Council RFI received",
  consent_approved: "Building Consent approved",
  construction: "Construction underway",
  existing: "Existing building / alteration",
  other: "Other",
};

const needLabels: Record<SubmissionPayload["need"], string> = {
  ps1: "I need a PS1",
  quote: "I need a quotation first",
  unsure: "I’m not sure whether I need a PS1",
};

const familyLabels: Record<SubmissionPayload["design"]["family"], string> = {
  balustrade: "Glass balustrade",
  pool: "Pool fence",
  aluminium: "Aluminium balustrade",
  canopy: "Canopy",
  not_sure: "Not sure",
};

const systemLabels: Record<string, string> = {
  "double-disc": "Double Disc",
  hidden: "Hidden Face",
  "jh-clamp": "JH Clamp",
  "juralco-canopy": "Juralco EDGE Canopy",
  lugano: "Lugano",
  "mini-post": "Mini Post",
  "mp-sp14": "Mini Post SP14",
  "side-channel": "Side Mount Channel",
  "top-channel": "Top Mount Channel",
  "unex-ascot": "Unex Ascot",
  "unex-metropolis": "Unex Metropolis",
  "viking-aluminium": "Viking Aluminium",
  "viking-glass": "Viking Glass",
  vista: "Vista",
  "not-sure": "Not sure",
};

const substrateLabels: Record<SubmissionPayload["site"]["substrate"], string> = {
  timber: "Timber",
  concrete: "Concrete",
  steel: "Steel",
  "tile-concrete": "Tile over concrete",
  not_sure: "Not sure",
};

const locationLabels: Record<string, string> = {
  deck: "Deck",
  balcony: "Balcony",
  stair: "Stair",
  landing: "Landing",
  "juliet-window": "Juliet window",
  "entrance-facade": "Entrance facade",
  "pool-area": "Pool area",
  other: "Other",
};

const environmentLabels: Record<SubmissionPayload["site"]["locations"][number]["environment"], string> = {
  internal: "Internal",
  external: "External",
};

function labelKnownValue(labels: Record<string, string>, value: string): string {
  const knownLabel = labels[value];
  if (knownLabel) return knownLabel;

  const readableValue = value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return readableValue ? readableValue[0].toUpperCase() + readableValue.slice(1) : value;
}

export function buildApplicationSummary(
  payload: SubmissionPayload,
  uploadNames: string[],
): string {
  const locations = payload.site.locations.length
    ? payload.site.locations
        .map(
          (location, index) =>
            `Area ${index + 1}: ${location.types.map((type) => labelKnownValue(locationLabels, type)).join(", ")} (${environmentLabels[location.environment]})${location.other ? ` - ${location.other}` : ""}`,
        )
        .join("\n")
    : "Locations: Not provided";

  return [
    `Applicant: ${payload.applicant.name}`,
    `Email: ${payload.applicant.email}`,
    `Mobile: ${payload.applicant.mobile}`,
    `Role: ${roleLabels[payload.applicant.role]}`,
    `Project address: ${payload.project.address}`,
    `Building Consent number: ${payload.project.buildingConsentNumber || "Not provided"}`,
    `Resource Consent number: ${payload.project.resourceConsentNumber || "Not provided"}`,
    `Estimated installation: ${installationLabels[payload.project.estimatedInstallation]}`,
    `Project stage: ${payload.project.stage ? stageLabels[payload.project.stage] : "Not provided"}`,
    `Request: ${needLabels[payload.need]}`,
    `Barrier type: ${familyLabels[payload.design.family]}`,
    `System: ${labelKnownValue(systemLabels, payload.design.system)}`,
    `Fixing substrate: ${substrateLabels[payload.site.substrate]}`,
    locations,
    `Uploaded files: ${uploadNames.length ? uploadNames.join(", ") : "None"}`,
    `Application acknowledgement: Confirmed by ${payload.applicant.name}`,
  ].join("\n");
}
