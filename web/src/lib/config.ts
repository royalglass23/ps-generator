import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();

const databaseConfigSchema = z.object({
  DATABASE_URL_PROD: z.string().url().startsWith("postgresql://"),
});

const r2ConfigSchema = z.object({
  R2_BUCKET_NAME_PS1: z.string().min(1),
  R2_ENDPOINT_PS1: z.string().url().startsWith("https://"),
  R2_ACCESS_KEY_ID_PS1: z.string().min(1),
  R2_SECRET_ACCESS_KEY_PS1: z.string().min(1),
  R2_REGION: z.string().min(1).default("auto"),
});

const emailConfigSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  INTERNAL_EMAIL_FROM: z.string().min(1),
  APPLICANT_EMAIL_FROM: z.string().min(1),
  SUPPORT_EMAIL: z.email(),
  SERVICEM8_INBOX_EMAIL: z.email(),
});

const applicationConfigSchema = z.object({
  APP_BASE_URL: z.string().url(),
});

const cronConfigSchema = z.object({
  CRON_SECRET: z.string().min(24),
});

const abuseConfigSchema = z.object({
  TURNSTILE_SECRET_KEY: z.string().min(20),
  RATE_LIMIT_SECRET: z.string().min(32),
  DRAFT_RATE_LIMIT_PER_HOUR: positiveInteger.default(5),
  UPLOAD_RATE_LIMIT_PER_HOUR: positiveInteger.default(10),
});

function parse<T>(schema: z.ZodType<T>, values: Record<string, string | undefined>, name: string): T {
  const result = schema.safeParse(values);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid ${name} configuration: ${fields}`);
  }
  return result.data;
}

export function getDatabaseConfig() {
  return parse(databaseConfigSchema, process.env, "database");
}

export function getR2Config() {
  return parse(r2ConfigSchema, process.env, "R2");
}

export function getEmailConfig() {
  return parse(emailConfigSchema, process.env, "email");
}

export function getApplicationConfig() {
  return parse(applicationConfigSchema, process.env, "application");
}

export function getCronConfig() {
  return parse(cronConfigSchema, process.env, "cron");
}

export function getAbuseConfig() {
  return parse(abuseConfigSchema, process.env, "abuse protection");
}
