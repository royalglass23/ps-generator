import { randomUUID } from "node:crypto";

import { getApplicationConfig, getEmailConfig } from "@/lib/config";
import { getDatabase } from "@/lib/db/client";
import { DrizzleUploadRepository } from "@/modules/uploads/drizzle-upload-repository";
import { r2ObjectStore } from "@/modules/uploads/r2-object-store";
import { UploadService } from "@/modules/uploads/upload-service";

import { ApplicationService } from "./application-service";
import { DrizzleApplicationRepository } from "./drizzle-application-repository";

let applicationService: ApplicationService | undefined;
let uploadService: UploadService | undefined;

export function getApplicationService(): ApplicationService {
  if (!applicationService) {
    const applicationConfig = getApplicationConfig();
    applicationService = new ApplicationService({
      repository: new DrizzleApplicationRepository(getDatabase()),
      applicationBaseUrl: applicationConfig.APP_BASE_URL,
      email: () => {
        const emailConfig = getEmailConfig();
        return {
          supportEmail: emailConfig.SUPPORT_EMAIL,
          serviceM8Email: emailConfig.SERVICEM8_INBOX_EMAIL,
          internalFromEmail: emailConfig.INTERNAL_EMAIL_FROM,
          applicantFromEmail: emailConfig.APPLICANT_EMAIL_FROM,
        };
      },
    });
  }
  return applicationService;
}

export function getUploadService(): UploadService {
  if (!uploadService) {
    const repository = new DrizzleUploadRepository(getDatabase());
    uploadService = new UploadService({
      authorize: (applicationId, resumeToken, requestId) =>
        getApplicationService().authorizeForUpload(applicationId, resumeToken, requestId),
      createId: randomUUID,
      objectStore: r2ObjectStore,
      repository,
    });
  }
  return uploadService;
}
