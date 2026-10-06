import { z } from "zod";

export const applicationNeeds = ["ps1", "quote", "unsure"] as const;
export const applicantRoles = ["architect", "builder", "developer", "homeowner", "other"] as const;
export const projectStages = [
  "concept", "developed", "preparing_consent", "consent_lodged", "council_rfi",
  "consent_approved", "construction", "existing", "other",
] as const;
export const installationWindows = ["asap", "3_months", "6_months", "1_year", "2_years", "not_sure"] as const;
export const designFamilies = ["balustrade", "pool", "aluminium", "canopy", "not_sure"] as const;
export const applicationSystems = [
  "double-disc", "hidden", "jh-clamp", "juralco-canopy", "lugano", "mini-post",
  "mp-sp14", "side-channel", "top-channel", "unex-ascot", "unex-metropolis",
  "viking-aluminium", "viking-glass", "vista", "not-sure",
] as const;
export const substrates = ["timber", "concrete", "steel", "tile-concrete", "not_sure"] as const;
export const environments = ["internal", "external"] as const;
export const locationTypes = [
  "deck", "balcony", "stair", "landing", "juliet-window", "entrance-facade", "pool-area", "other",
] as const;
export type LocationType = (typeof locationTypes)[number];

export const applicationInputLimits = {
  name: 100,
  mobile: 25,
  email: 320,
  address: 250,
  consentNumber: 50,
  otherLocation: 200,
} as const;

const nameCharacters = /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u;
const addressCharacters = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ,.'’\-\/#&()]*$/u;
const consentNumberCharacters = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/;
const otherLocationCharacters = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ,.?!"“”'’\-\/()&:]*$/u;
const forbiddenControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

function normalizedText(maximumInputLength: number) {
  return z.string().max(maximumInputLength).transform((value) => value.normalize("NFC").trim());
}

function emptyOr<T extends z.ZodType<string>>(schema: T) {
  return z.union([z.literal(""), schema]);
}

function isNzPhone(value: string): boolean {
  if (!/^[+0-9 ()-]+$/.test(value)) return false;
  const compact = value.replace(/[ ()-]/g, "");
  const nationalNumber = compact.startsWith("+64") ? compact.slice(3) : compact.slice(1);
  if (!/^(?:2\d{7,9}|[34679]\d{7})$/.test(nationalNumber)) return false;
  if (/^(?:\+64|0)\d+$/.test(value)) return true;
  return /^(?:0(?:2\d|[34679])|\+64[ -](?:2\d|[34679]))[ -]\d{3,4}[ -]\d{3,4}$/.test(value)
    || /^\(0(?:2\d|[34679])\)[ -]\d{3,4}[ -]\d{3,4}$/.test(value);
}

export const applicantNameSchema = normalizedText(200).pipe(
  z.string()
    .min(1, "Enter your full name.")
    .max(applicationInputLimits.name, `Use ${applicationInputLimits.name} characters or fewer.`)
    .regex(nameCharacters, "Use letters, spaces, apostrophes, hyphens or periods only."),
);

export const nzPhoneSchema = normalizedText(50).pipe(
  z.string()
    .min(1, "Enter your phone number.")
    .max(applicationInputLimits.mobile, `Use ${applicationInputLimits.mobile} characters or fewer.`)
    .refine(isNzPhone, "Enter a valid NZ mobile or landline number."),
);

export const applicantEmailSchema = normalizedText(400).pipe(
  z.email("Enter a valid email address.")
    .max(applicationInputLimits.email, `Use ${applicationInputLimits.email} characters or fewer.`),
).transform((value) => {
  const separator = value.lastIndexOf("@");
  return `${value.slice(0, separator + 1)}${value.slice(separator + 1).toLowerCase()}`;
});

export const addressSchema = normalizedText(500).pipe(
  z.string()
    .min(1, "Enter the job address.")
    .max(applicationInputLimits.address, `Use ${applicationInputLimits.address} characters or fewer.`)
    .regex(addressCharacters, "Use letters, numbers and normal address punctuation only."),
);

export const optionalConsentNumberSchema = normalizedText(100)
  .pipe(emptyOr(
    z.string()
      .max(applicationInputLimits.consentNumber, `Use ${applicationInputLimits.consentNumber} characters or fewer.`)
      .regex(consentNumberCharacters, "Use letters, numbers, spaces, hyphens, slashes or periods only."),
  ))
  .transform((value) => value.toUpperCase());

export const otherLocationSchema = normalizedText(500).pipe(
  z.string()
    .min(1, "Describe the other location.")
    .max(applicationInputLimits.otherLocation, `Use ${applicationInputLimits.otherLocation} characters or fewer.`)
    .regex(otherLocationCharacters, "Use ordinary words, numbers and punctuation only."),
);

export const informationResponseSchema = normalizedText(5_100).pipe(
  z.string()
    .min(1, "Enter a response.")
    .max(5_000, "Use 5000 characters or fewer.")
    .refine((value) => !forbiddenControls.test(value), "Remove unsupported control characters."),
);

export const applicationInputSchemas = {
  name: applicantNameSchema,
  mobile: nzPhoneSchema,
  email: applicantEmailSchema,
  address: addressSchema,
  buildingConsentNumber: optionalConsentNumberSchema,
  resourceConsentNumber: optionalConsentNumberSchema,
  otherLocation: otherLocationSchema,
} as const;

export type ApplicationInputName = keyof typeof applicationInputSchemas;

export function applicationInputError(name: ApplicationInputName, value: string): string | null {
  const result = applicationInputSchemas[name].safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Check this value.");
}

const applicantDraftSchema = z.object({
  name: normalizedText(200).pipe(emptyOr(applicantNameSchema)).optional(),
  mobile: normalizedText(50).pipe(emptyOr(nzPhoneSchema)).optional(),
  email: normalizedText(400).pipe(emptyOr(applicantEmailSchema)).optional(),
  role: z.enum(applicantRoles).optional(),
}).strict();

const projectDraftSchema = z.object({
  address: normalizedText(500).pipe(emptyOr(addressSchema)).optional(),
  buildingConsentNumber: optionalConsentNumberSchema.optional(),
  resourceConsentNumber: optionalConsentNumberSchema.optional(),
  estimatedInstallation: z.enum(installationWindows).optional(),
  stage: z.enum(projectStages).optional(),
}).strict();

const designDraftSchema = z.object({
  family: z.enum(designFamilies).optional(),
  system: z.union([z.literal(""), z.enum(applicationSystems)]).optional(),
}).strict();

const locationDraftSchema = z.object({
  types: z.array(z.enum(locationTypes)).max(3).optional(),
  environment: z.enum(environments).optional(),
  other: normalizedText(500).pipe(emptyOr(otherLocationSchema)).optional(),
}).strict();

const siteDraftSchema = z.object({
  substrate: z.enum(substrates).optional(),
  locations: z.array(locationDraftSchema).max(3).optional(),
}).strict();

export const draftPayloadSchema = z.object({
  need: z.enum(applicationNeeds).optional(),
  applicant: applicantDraftSchema.optional(),
  project: projectDraftSchema.optional(),
  design: designDraftSchema.optional(),
  site: siteDraftSchema.optional(),
}).strict();

const locationSubmissionSchema = z.object({
  types: z.array(z.enum(locationTypes)).min(1).max(3),
  environment: z.enum(environments),
  other: normalizedText(500).pipe(emptyOr(otherLocationSchema)).default(""),
}).strict().superRefine((location, context) => {
  if (location.types.includes("other") && !location.other) {
    context.addIssue({
      code: "custom", path: ["other"], message: "Describe the location when Other is selected.",
    });
  }
  if (location.types.includes("pool-area") && location.types.length !== 1) {
    context.addIssue({
      code: "custom", path: ["types"], message: "Pool Area must be the only location type.",
    });
  }
});

export const submissionPayloadSchema = z.object({
  need: z.enum(applicationNeeds),
  applicant: z.object({
    name: applicantNameSchema,
    mobile: nzPhoneSchema,
    email: applicantEmailSchema,
    role: z.enum(applicantRoles),
  }).strict(),
  project: z.object({
    address: addressSchema,
    buildingConsentNumber: optionalConsentNumberSchema.default(""),
    resourceConsentNumber: optionalConsentNumberSchema.default(""),
    estimatedInstallation: z.enum(installationWindows),
    stage: z.enum(projectStages).optional(),
  }).strict(),
  design: z.object({
    family: z.enum(designFamilies),
    system: z.enum(applicationSystems),
  }).strict(),
  site: z.object({
    substrate: z.enum(substrates),
    locations: z.array(locationSubmissionSchema).max(3).default([]),
  }).strict().superRefine((site, context) => {
    const poolLocations = site.locations.filter((location) => location.types.includes("pool-area"));
    if (poolLocations.length && site.locations.length !== 1) {
      context.addIssue({
        code: "custom", path: ["locations"], message: "Pool Area must be the only area.",
      });
    }
  }),
  acknowledgement: z.object({ accepted: z.literal(true) }).strict(),
}).strict();

export type DraftPayload = z.infer<typeof draftPayloadSchema>;
export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;
