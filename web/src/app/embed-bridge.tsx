"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

export const embedResizeMessage = (height: number) => ({
  type: "royal-glass-ps1:resize" as const,
  height: Math.ceil(height),
});

export const embedResumeMessage = (applicationId: string) => ({
  type: "royal-glass-ps1:resume" as const,
  applicationId,
});

export const embedCompleteMessage = () => ({ type: "royal-glass-ps1:complete" as const });

export const embedReadyMessage = (applicationId: string) => ({
  type: "royal-glass-ps1:ready" as const,
  applicationId,
});

export function embedContentHeight(boundary: { scrollHeight: number }): number {
  return Math.ceil(boundary.scrollHeight);
}

function canMessageParent(parentOrigin: string): boolean {
  return Boolean(parentOrigin) && window.parent !== window;
}

export function postEmbedResumeMessage(
  parentOrigin: string,
  applicationId: string,
): void {
  if (!canMessageParent(parentOrigin)) return;
  window.parent.postMessage(embedResumeMessage(applicationId), parentOrigin);
}

export function postEmbedCompleteMessage(parentOrigin: string): void {
  if (!canMessageParent(parentOrigin)) return;
  window.parent.postMessage(embedCompleteMessage(), parentOrigin);
}

interface ResumeTokenEvent {
  origin: string;
  source: unknown;
  data: unknown;
}

export function isEmbedResumeTokenEvent(
  event: ResumeTokenEvent,
  parentOrigin: string,
  parentWindow: unknown,
  applicationId: string,
): event is ResumeTokenEvent & { data: { token: string } } {
  if (event.origin !== parentOrigin || event.source !== parentWindow) return false;
  if (!event.data || typeof event.data !== "object") return false;
  const data = event.data as Record<string, unknown>;
  return data.type === "royal-glass-ps1:resume-token"
    && data.applicationId === applicationId
    && typeof data.token === "string"
    && data.token.length >= 1
    && data.token.length <= 1024;
}

export function requestEmbedResumeToken(
  parentOrigin: string,
  applicationId: string,
): Promise<string | null> {
  if (!canMessageParent(parentOrigin)) return Promise.resolve(null);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => finish(null), 5_000);
    const onMessage = (event: MessageEvent) => {
      if (isEmbedResumeTokenEvent(event, parentOrigin, window.parent, applicationId)) {
        finish(event.data.token);
      }
    };
    const finish = (token: string | null) => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(token);
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage(embedReadyMessage(applicationId), parentOrigin);
  });
}

export function useEmbedFrameReporter(
  parentOrigin: string,
  boundaryRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const boundary = boundaryRef.current;
    if (!canMessageParent(parentOrigin) || !boundary) return;

    const reportHeight = () => {
      window.parent.postMessage(embedResizeMessage(embedContentHeight(boundary)), parentOrigin);
    };

    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(boundary);
    window.addEventListener("load", reportHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("load", reportHeight);
    };
  }, [boundaryRef, parentOrigin]);
}

export function EmbedFrameBoundary({ parentOrigin, children }: {
  parentOrigin: string;
  children: ReactNode;
}) {
  const boundaryRef = useRef<HTMLDivElement>(null);
  useEmbedFrameReporter(parentOrigin, boundaryRef);
  return (
    <div ref={boundaryRef} className={parentOrigin ? "rg-ps1-embed-boundary" : undefined}>
      {children}
    </div>
  );
}
