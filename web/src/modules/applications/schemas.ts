import { z } from "zod";

export const applicationNeeds = ["ps1", "quote", "unsure"] as const;
export const applicantRoles = [
  "architect",
  "builder",
  "developer",
  "homeowner",
  "other",
] as const;
export const projectStages = [
  "concept",
  "developed",
  "preparing_consent",
  "consent_lodged",
  "council_rfi",
  "consent_approved",
  "construction",
  "existing",
  "other",
] as const;
export const installationWindows = ["asap", "3_months", "6_months", "1_year", "2_years", "not_sure"] as const;
export const designFamilies = ["balustrade", "pool", "not_sure"] as const;
export const substrates = ["timber", "concrete", "steel", "tile-concrete", "not_sure"] as const;
export const environments = ["internal", "external"] as const;

const applicantDraftSchema = z
  .object({
    name: z.string().max(200).optional(),
    mobile: z.string().max(50).optional(),
    email: z.string().max(320).optional(),
    role: z.enum(applicantRoles).optional(),
  })
  .strict();

const projectDraftSchema = z
  .object({
    address: z.string().max(500).optional(),
    city: z.string().max(120).optional(),
    postalCode: z.string().max(20).optional(),
    buildingConsentNumber: z.string().max(100).optional(),
    resourceConsentNumber: z.string().max(100).optional(),
    estimatedInstallation: z.enum(installationWindows).optional(),
    stage: z.enum(projectStages).optional(),
  })
  .strict();

const designDraftSchema = z
  .object({
    family: z.enum(designFamilies).optional(),
    system: z.string().max(100).optional(),
  })
  .strict();

const locationDraftSchema = z
  .object({
    types: z.array(z.string().min(1).max(80)).max(3).optional(),
    environment: z.enum(environments).optional(),
    other: z.string().max(500).optional(),
  })
  .strict();

const siteDraftSchema = z
  .object({
    substrate: z.enum(substrates).optional(),
    locations: z.array(locationDraftSchema).max(3).optional(),
  })
  .strict();

export const draftPayloadSchema = z
  .object({
    need: z.enum(applicationNeeds).optional(),
    applicant: applicantDraftSchema.optional(),
    project: projectDraftSchema.optional(),
    design: designDraftSchema.optional(),
    site: siteDraftSchema.optional(),
  })
  .strict();

const locationSubmissionSchema = z
  .object({
    types: z.array(z.string().trim().min(1).max(80)).min(1).max(3),
    environment: z.enum(environments),
    other: z.string().trim().max(500).default(""),
  })
  .strict()
  .superRefine((location, context) => {
    if (location.types.includes("other") && !location.other) {
      context.addIssue({
        code: "custom",
        path: ["other"],
        message: "Describe the location when Other is selected.",
      });
    }
    if (location.types.includes("pool-area") && location.types.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["types"],
        message: "Pool Area must be the only location type.",
      });
    }
  });

export const submissionPayloadSchema = z
  .object({
    need: z.enum(applicationNeeds),
    applicant: z
      .object({
        name: z.string().trim().min(1).max(200),
        mobile: z.string().trim().min(1).max(50),
        email: z.email().max(320),
        role: z.enum(applicantRoles),
      })
      .strict(),
    project: z
      .object({
        address: z.string().trim().min(1).max(500),
        city: z.string().trim().max(120).default(""),
        postalCode: z.string().trim().max(20).default(""),
        buildingConsentNumber: z.string().trim().max(100).default(""),
        resourceConsentNumber: z.string().trim().max(100).default(""),
        estimatedInstallation: z.enum(installationWindows),
        stage: z.enum(projectStages).optional(),
      })
      .strict(),
    design: z
      .object({
        family: z.enum(designFamilies),
        system: z.string().trim().min(1).max(100),
      })
      .strict(),
    site: z
      .object({
        substrate: z.enum(substrates),
        locations: z.array(locationSubmissionSchema).max(3).default([]),
      })
      .strict()
      .superRefine((site, context) => {
        const poolLocations = site.locations.filter((location) =>
          location.types.includes("pool-area"),
        );
        if (poolLocations.length && site.locations.length !== 1) {
          context.addIssue({
            code: "custom",
            path: ["locations"],
            message: "Pool Area must be the only area.",
          });
        }
      }),
    acknowledgement: z
      .object({
        accepted: z.literal(true),
      })
      .strict(),
  })
  .strict();

export type DraftPayload = z.infer<typeof draftPayloadSchema>;
export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;
