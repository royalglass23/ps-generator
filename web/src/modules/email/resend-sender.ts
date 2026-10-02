import { Resend } from "resend";

import { getEmailConfig } from "@/lib/config";
import { r2ObjectStore } from "@/modules/uploads/r2-object-store";
import type { EmailMessage } from "./types";

let resend: Resend | undefined;

export async function sendEmail(message: EmailMessage): Promise<string> {
  const { RESEND_API_KEY } = getEmailConfig();
  resend ??= new Resend(RESEND_API_KEY);
  const attachments = await Promise.all(
    (message.attachments ?? []).map(async (attachment) => ({
      path: await r2ObjectStore.temporaryDownloadUrl(attachment.objectKey),
      filename: attachment.filename,
    })),
  );
  const result = await resend.emails.send(
    {
      from: message.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments,
    },
    message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
  );
  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message ?? "Resend did not return a message ID.");
  }
  return result.data.id;
}
