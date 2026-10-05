// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationForm } from "../application-form";

vi.mock("next/script", async () => {
  const React = await import("react");
  return {
    default: function MockScript({ onReady }: { onReady?: () => void }) {
      const onReadyRef = React.useRef(onReady);
      React.useEffect(() => onReadyRef.current?.(), []);
      return null;
    },
  };
});

const validDraftPayload = {
  need: "ps1",
  applicant: {
    name: "Jordan Applicant",
    mobile: "021 555 0101",
    email: "jordan@example.test",
    role: "homeowner",
  },
  project: {
    address: "13 Example Street, Auckland",
    buildingConsentNumber: "",
    resourceConsentNumber: "",
    estimatedInstallation: "not_sure",
  },
  design: { family: "balustrade", system: "double-disc" },
  site: { substrate: "timber", locations: [] },
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await settle();
    }
  }
  throw lastError;
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function callsTo(fetcher: ReturnType<typeof vi.fn>, matcher: (url: string, init?: RequestInit) => boolean) {
  return fetcher.mock.calls.filter(([input, init]) => matcher(String(input), init as RequestInit | undefined));
}

function selectFiles(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("File input not found");
  Object.defineProperty(input, "files", { configurable: true, value: files });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setControlValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(control, value);
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

async function goToDocuments() {
  for (let step = 0; step < 4; step += 1) {
    await act(async () => button("Continue").click());
    await settle();
  }
  expect(document.body.textContent).toContain("Documents & images");
}

async function goToFreshDocuments() {
  await act(async () => button("Continue").click());
  await settle();
  const address = document.querySelector<HTMLInputElement>('input[placeholder="Street address"]');
  expect(address).not.toBeNull();
  await act(async () => setControlValue(address!, "13 Example Street, Auckland"));
  await act(async () => button("Continue").click());
  await settle();
  const system = document.querySelector<HTMLSelectElement>("select");
  expect(system).not.toBeNull();
  await act(async () => setControlValue(system!, "double-disc"));
  await act(async () => button("Continue").click());
  await settle();
  await act(async () => button("Continue").click());
  await settle();
  expect(document.body.textContent).toContain("Documents & images");
}

function standardFetcher(options: {
  directUploads?: Array<Promise<Response>>;
  failFirstDirectUpload?: boolean;
  failFirstDraftCreate?: boolean;
  failFirstDelete?: boolean;
} = {}) {
  let reservation = 0;
  let directUpload = 0;
  let draftCreate = 0;
  let deletion = 0;
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!init?.method) return Response.json({ payload: validDraftPayload });
    if (init.method === "PUT" && url.startsWith("https://r2.example.test/")) {
      const index = directUpload;
      directUpload += 1;
      if (options.failFirstDirectUpload && index === 0) return new Response(null, { status: 500 });
      return options.directUploads?.[index] ?? new Response(null, { status: 200 });
    }
    if (init.method === "POST" && url === "/api/applications/drafts") {
      draftCreate += 1;
      if (options.failFirstDraftCreate && draftCreate === 1) {
        return Response.json({ message: "The secure draft could not be created." }, { status: 500 });
      }
      return Response.json({
        id: "draft-1",
        resumeToken: "resume-secret",
        expiresAt: "2026-10-09T00:00:00.000Z",
        resumeUrl: "https://example.test/application/draft-1#token=resume-secret",
      }, { status: 201 });
    }
    if (init.method === "POST" && url.endsWith("/uploads")) {
      reservation += 1;
      return Response.json({
        id: `upload-${reservation}`,
        uploadUrl: `https://r2.example.test/upload-${reservation}`,
        headers: { "Content-Type": "application/pdf" },
      });
    }
    if (init.method === "POST" && url.endsWith("/complete")) {
      return Response.json({ status: "ready" });
    }
    if (init.method === "DELETE") {
      deletion += 1;
      if (options.failFirstDelete && deletion === 1) {
        return Response.json({ message: "The file could not be removed." }, { status: 500 });
      }
      return new Response(null, { status: 204 });
    }
    if (init.method === "PUT") return Response.json({ status: "draft" });
    if (init.method === "POST" && url.endsWith("/resume-link")) {
      return Response.json({
        email: validDraftPayload.applicant.email,
        resumeUrl: "https://example.test/application/draft-1#token=resume-secret",
      });
    }
    if (init.method === "POST" && url.endsWith("/submit")) {
      return Response.json({
        reference: "PS1-2026-ABC12345",
        submittedAt: "2026-10-05T01:23:45.000Z",
      });
    }
    throw new Error(`Unexpected fetch: ${init.method} ${url}`);
  });
}

describe("application uploads", () => {
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, "", "/application/draft-1#token=resume-secret");
    window.turnstile = undefined;
    root = createRoot(document.querySelector("#root")!);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  async function renderWith(fetcher: ReturnType<typeof standardFetcher>) {
    vi.stubGlobal("fetch", fetcher);
    await act(async () => root.render(
      <ApplicationForm siteKey="" googleMapsApiKey="" draftId="draft-1" />,
    ));
    await settle();
  }

  async function renderFresh(fetcher: ReturnType<typeof standardFetcher>) {
    window.history.replaceState({}, "", "/");
    const render = vi.fn((_element: HTMLElement, options: Record<string, unknown>) => {
      const token = `turnstile-${render.mock.calls.length}`;
      queueMicrotask(() => (options.callback as (value: string) => void)(token));
      return `widget-${render.mock.calls.length}`;
    });
    window.turnstile = { render, remove: vi.fn(), reset: vi.fn() };
    vi.stubGlobal("fetch", fetcher);
    await act(async () => root.render(
      <ApplicationForm siteKey="turnstile-site-key" googleMapsApiKey="" />,
    ));
    await settle();
    return render;
  }

  it("starts uploading a selected file before final submission", async () => {
    const upload = deferred<Response>();
    const fetcher = standardFetcher({ directUploads: [upload.promise] });
    await renderWith(fetcher);
    await goToDocuments();

    await act(async () => selectFiles(new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" })));

    await waitFor(() => {
      expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url.endsWith("/uploads"))).toHaveLength(1);
      expect(document.body.textContent).toContain("Uploading…");
    });
    expect(callsTo(fetcher, (url) => url.endsWith("/submit"))).toHaveLength(0);
    upload.resolve(new Response(null, { status: 200 }));
    await waitFor(() => expect(document.body.textContent).toContain("Uploaded"));
  });

  it("does not upload an already uploaded file again during submit", async () => {
    const fetcher = standardFetcher();
    await renderWith(fetcher);
    await goToDocuments();
    await act(async () => selectFiles(new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" })));
    await waitFor(() => expect(document.body.textContent).toContain("Uploaded"));

    await act(async () => button("Continue").click());
    await settle();
    const acknowledgement = document.querySelector<HTMLInputElement>('.confirm input[type="checkbox"]')!;
    await act(async () => acknowledgement.click());
    await act(async () => button("Submit application").click());
    await settle();

    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url.endsWith("/uploads"))).toHaveLength(1);
    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url.endsWith("/submit"))).toHaveLength(1);
  });

  it("keeps final submission disabled while an upload is active", async () => {
    const upload = deferred<Response>();
    const fetcher = standardFetcher({ directUploads: [upload.promise] });
    await renderWith(fetcher);
    await goToDocuments();
    await act(async () => selectFiles(new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" })));
    await waitFor(() => expect(document.body.textContent).toContain("Uploading…"));

    await act(async () => button("Continue").click());
    await settle();
    const acknowledgement = document.querySelector<HTMLInputElement>('.confirm input[type="checkbox"]')!;
    await act(async () => acknowledgement.click());
    expect(button("Submit application").disabled).toBe(true);

    upload.resolve(new Response(null, { status: 200 }));
    await waitFor(() => expect(button("Submit application").disabled).toBe(false));
  });

  it("allows a failed upload to be retried", async () => {
    const fetcher = standardFetcher({ failFirstDirectUpload: true });
    await renderWith(fetcher);
    await goToDocuments();
    await act(async () => selectFiles(new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" })));
    await waitFor(() => expect(document.body.textContent).toContain("Upload failed — Retry"));

    await act(async () => button("Upload failed — Retry").click());
    await waitFor(() => expect(document.body.textContent).toContain("Uploaded"));

    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url.endsWith("/uploads"))).toHaveLength(2);
  });

  it("removes an uploaded file through the authorized cleanup endpoint", async () => {
    const fetcher = standardFetcher();
    await renderWith(fetcher);
    await goToDocuments();
    await act(async () => selectFiles(new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" })));
    await waitFor(() => expect(document.body.textContent).toContain("Uploaded"));

    const remove = document.querySelector<HTMLButtonElement>('button[aria-label="Remove drawing.pdf"]');
    expect(remove).not.toBeNull();
    await act(async () => remove!.click());
    await waitFor(() => expect(document.body.textContent).not.toContain("drawing.pdf"));

    expect(fetcher).toHaveBeenCalledWith(
      "/api/applications/drafts/draft-1/uploads/upload-1",
      { method: "DELETE", headers: { Authorization: "Bearer resume-secret" } },
    );
  });

  it("uploads at most two files at a time", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const third = deferred<Response>();
    const fetcher = standardFetcher({ directUploads: [first.promise, second.promise, third.promise] });
    await renderWith(fetcher);
    await goToDocuments();
    await act(async () => selectFiles(
      new File(["%PDF-1"], "one.pdf", { type: "application/pdf" }),
      new File(["%PDF-2"], "two.pdf", { type: "application/pdf" }),
      new File(["%PDF-3"], "three.pdf", { type: "application/pdf" }),
    ));

    await waitFor(() => {
      expect(callsTo(fetcher, (url, init) => init?.method === "PUT" && url.startsWith("https://r2.example.test/"))).toHaveLength(2);
    });
    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url.endsWith("/uploads"))).toHaveLength(2);

    first.resolve(new Response(null, { status: 200 }));
    await waitFor(() => {
      expect(callsTo(fetcher, (url, init) => init?.method === "PUT" && url.startsWith("https://r2.example.test/"))).toHaveLength(3);
    });
    second.resolve(new Response(null, { status: 200 }));
    third.resolve(new Response(null, { status: 200 }));
    await waitFor(() => expect(document.body.textContent?.match(/Uploaded/g)).toHaveLength(3));
  });

  it("removes a queued file before an upload reservation is created", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetcher = standardFetcher({ directUploads: [first.promise, second.promise] });
    await renderWith(fetcher);
    await goToDocuments();
    await act(async () => selectFiles(
      new File(["%PDF-1"], "one.pdf", { type: "application/pdf" }),
      new File(["%PDF-2"], "two.pdf", { type: "application/pdf" }),
      new File(["%PDF-3"], "three.pdf", { type: "application/pdf" }),
    ));
    await waitFor(() => expect(document.body.textContent).toContain("Ready/preparing"));

    const remove = document.querySelector<HTMLButtonElement>('button[aria-label="Remove three.pdf"]');
    expect(remove).not.toBeNull();
    await act(async () => remove!.click());

    expect(document.body.textContent).not.toContain("three.pdf");
    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url.endsWith("/uploads"))).toHaveLength(2);
    first.resolve(new Response(null, { status: 200 }));
    second.resolve(new Response(null, { status: 200 }));
    await waitFor(() => expect(document.body.textContent?.match(/Uploaded/g)).toHaveLength(2));
  });

  it("creates one secure draft for a fresh three-file queue", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const third = deferred<Response>();
    const fetcher = standardFetcher({ directUploads: [first.promise, second.promise, third.promise] });
    await renderFresh(fetcher);
    await goToFreshDocuments();
    await waitFor(() => expect(document.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(false));
    await act(async () => selectFiles(
      new File(["%PDF-1"], "one.pdf", { type: "application/pdf" }),
      new File(["%PDF-2"], "two.pdf", { type: "application/pdf" }),
      new File(["%PDF-3"], "three.pdf", { type: "application/pdf" }),
    ));

    await waitFor(() => expect(callsTo(fetcher, (url, init) => init?.method === "PUT" && url.startsWith("https://r2.example.test/"))).toHaveLength(2));
    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url === "/api/applications/drafts")).toHaveLength(1);
    first.resolve(new Response(null, { status: 200 }));
    await waitFor(() => expect(callsTo(fetcher, (url, init) => init?.method === "PUT" && url.startsWith("https://r2.example.test/"))).toHaveLength(3));
    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url === "/api/applications/drafts")).toHaveLength(1);
    second.resolve(new Response(null, { status: 200 }));
    third.resolve(new Response(null, { status: 200 }));
    await waitFor(() => expect(document.body.textContent?.match(/Uploaded/g)).toHaveLength(3));
  });

  it("renews Turnstile after secure draft creation fails", async () => {
    const fetcher = standardFetcher({ failFirstDraftCreate: true });
    const renderTurnstile = await renderFresh(fetcher);
    await goToFreshDocuments();
    await waitFor(() => expect(document.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(false));
    await act(async () => selectFiles(new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" })));
    await waitFor(() => {
      expect(document.body.textContent).toContain("Upload failed — Retry");
      expect(renderTurnstile.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    await act(async () => button("Upload failed — Retry").click());
    await waitFor(() => expect(document.body.textContent).toContain("Uploaded"));
    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url === "/api/applications/drafts")).toHaveLength(2);
  });

  it("retains an uploaded file for removal retry when post-upload cleanup fails", async () => {
    const directUpload = deferred<Response>();
    const fetcher = standardFetcher({ directUploads: [directUpload.promise], failFirstDelete: true });
    await renderWith(fetcher);
    await goToDocuments();
    await act(async () => selectFiles(new File(["%PDF-"], "drawing.pdf", { type: "application/pdf" })));
    await waitFor(() => expect(document.body.textContent).toContain("Uploading…"));
    const remove = document.querySelector<HTMLButtonElement>('button[aria-label="Remove drawing.pdf"]');
    await act(async () => remove!.click());
    directUpload.resolve(new Response(null, { status: 200 }));
    await waitFor(() => expect(document.body.textContent).toContain("Uploaded"));

    const retryRemove = document.querySelector<HTMLButtonElement>('button[aria-label="Remove drawing.pdf"]');
    await act(async () => retryRemove!.click());
    await waitFor(() => expect(document.body.textContent).not.toContain("drawing.pdf"));
    expect(callsTo(fetcher, (_url, init) => init?.method === "DELETE")).toHaveLength(2);
    expect(callsTo(fetcher, (url, init) => init?.method === "POST" && url.endsWith("/uploads"))).toHaveLength(1);
  });

  it("keeps missing documents from blocking submission without offering Save for later", async () => {
    await renderWith(standardFetcher());
    expect(document.body.textContent).not.toContain("Save for later");

    await goToDocuments();
    expect(document.body.textContent).toContain(
      "Don’t have everything yet? Submit what you have. You can send additional drawings, photos, or details afterward using your application reference.",
    );
    expect(document.body.textContent).not.toContain("Save for later");
  });
});
