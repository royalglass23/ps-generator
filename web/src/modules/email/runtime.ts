import { getDatabase } from "@/lib/db/client";

import { DrizzleOutboxRepository } from "./drizzle-outbox-repository";
import { persistAndDispatchOutbox } from "./immediate-outbox-delivery";
import { OutboxDispatcher } from "./outbox-dispatcher";
import { sendEmail } from "./resend-sender";

let outboxDispatcher: OutboxDispatcher | undefined;

export function getEmailOutboxDispatcher(): OutboxDispatcher {
  if (!outboxDispatcher) {
    outboxDispatcher = new OutboxDispatcher({
      repository: new DrizzleOutboxRepository(getDatabase()),
      send: sendEmail,
    });
  }
  return outboxDispatcher;
}

export async function dispatchEmailOutboxSafely(): Promise<void> {
  try {
    await getEmailOutboxDispatcher().run();
  } catch (error) {
    console.error("Asynchronous email delivery failed; queued messages remain available for retry.", error);
  }
}

export function persistWithImmediateEmailDispatch<T>(persist: () => Promise<T>): Promise<T> {
  return persistAndDispatchOutbox({
    persist,
    dispatch: () => getEmailOutboxDispatcher().run(),
    onDispatchError: (error) => {
      console.error("Immediate email delivery failed; queued messages remain available for retry.", error);
    },
  });
}
