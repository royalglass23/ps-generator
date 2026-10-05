"use client";

import { useMemo, useSyncExternalStore } from "react";

import { ApplicationReceiptUnavailable, ApplicationSuccess } from "./application-form";
import {
  getSubmissionReceiptSnapshot,
  parseSubmissionReceipt,
} from "./submission-receipt";

const subscribeToStaticReceipt = () => () => undefined;
const serverReceiptSnapshot = "__server_receipt_pending__";
const getServerReceiptSnapshot = () => serverReceiptSnapshot;
const getBrowserReceiptSnapshot = () => getSubmissionReceiptSnapshot(window.sessionStorage);

export function SubmittedReceipt() {
  const serializedReceipt = useSyncExternalStore(
    subscribeToStaticReceipt,
    getBrowserReceiptSnapshot,
    getServerReceiptSnapshot,
  );
  const receipt = useMemo(
    () => serializedReceipt === serverReceiptSnapshot
      ? null
      : parseSubmissionReceipt(serializedReceipt),
    [serializedReceipt],
  );

  if (serializedReceipt === serverReceiptSnapshot) return null;
  if (!receipt) return <ApplicationReceiptUnavailable />;

  return (
    <ApplicationSuccess
      reference={receipt.reference}
      email={receipt.email}
    />
  );
}
