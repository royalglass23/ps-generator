"use client";

import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  createDraftSession,
  initialJourneyState,
  loadDraft,
  removeApplicationUpload,
  applicantDetailsError,
  saveDraft,
  submitApplication,
  uploadApplicationFile,
  type DraftSession,
  type JourneyState,
  type UploadedFile,
} from "@/modules/applications/public-journey";
import { nextLocationTypes } from "@/modules/applications/location-types";
import {
  applicationInputError,
  applicationInputLimits,
  type ApplicationInputName,
  type LocationType,
} from "@/modules/applications/schemas";
import { persistSubmissionReceipt } from "./submission-receipt";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    google?: {
      maps: {
        importLibrary: (name: string) => Promise<unknown>;
      };
    };
  }
}

export const applicationStepLabels = [
  "What you need",
  "Project details",
  "Design",
  "Site conditions",
  "Documents & images",
  "Applicant details",
];
const stepLabels = applicationStepLabels;

const systems = [
  ["double-disc", "Double Disc"], ["hidden", "Hidden Face"], ["jh-clamp", "JH Clamp"],
  ["juralco-canopy", "Juralco EDGE Canopy"], ["lugano", "Lugano"], ["mini-post", "Mini Post"],
  ["mp-sp14", "Mini Post SP14"], ["side-channel", "Side Mount Channel"],
  ["top-channel", "Top Mount Channel"], ["unex-ascot", "Unex Ascot"],
  ["unex-metropolis", "Unex Metropolis"], ["viking-aluminium", "Viking Aluminium"],
  ["viking-glass", "Viking Glass"], ["vista", "Vista"], ["not-sure", "Not sure"],
] as const;

type SystemId = (typeof systems)[number][0];
type DesignFamily = JourneyState["design"]["family"];

type UploadItem = {
  clientId: string;
  file: File;
  status: "preparing" | "uploading" | "uploaded" | "failed" | "removing";
  uploaded?: UploadedFile;
};

const systemReferenceImages: Record<SystemId, { balustrade?: string; pool?: string; canopy?: readonly string[] }> = {
  "double-disc": { balustrade: "/assets/systems/ai/double-disc-balustrade-v1.png", pool: "/assets/systems/ai/double-disc-pool-v1.png" },
  hidden: { balustrade: "/assets/systems/ai/hidden-face-balustrade-v1.png", pool: "/assets/systems/ai/hidden-face-pool-v1.png" },
  "jh-clamp": { balustrade: "/assets/systems/ai/jh-clamp-balustrade-v1.png", pool: "/assets/systems/ai/jh-clamp-pool-v1.png" },
  "juralco-canopy": { canopy: ["/assets/systems/ai/juralco-canopy-commercial-v1.png"] },
  lugano: { balustrade: "/assets/systems/ai/lugano-balustrade-v1.png", pool: "/assets/systems/ai/lugano-pool-v1.png" },
  "mini-post": { balustrade: "/assets/systems/ai/mini-post-balustrade-v1.png", pool: "/assets/systems/ai/mini-post-pool-v1.png" },
  "mp-sp14": { balustrade: "/assets/systems/ai/mini-post-sp14-balustrade-v1.png", pool: "/assets/systems/ai/mini-post-sp14-pool-v1.png" },
  "side-channel": { balustrade: "/assets/systems/ai/side-mount-channel-balustrade-v1.png", pool: "/assets/systems/ai/side-mount-channel-pool-v1.png" },
  "top-channel": { balustrade: "/assets/systems/ai/top-mount-channel-balustrade-v1.png", pool: "/assets/systems/ai/top-mount-channel-pool-v1.png" },
  "unex-ascot": { balustrade: "/assets/systems/ai/unex-ascot-balustrade-v1.png", pool: "/assets/systems/ai/unex-ascot-pool-v1.png" },
  "unex-metropolis": { balustrade: "/assets/systems/ai/unex-metropolis-balustrade-v1.png", pool: "/assets/systems/ai/unex-metropolis-pool-v1.png" },
  "viking-aluminium": { balustrade: "/assets/systems/ai/viking-aluminium-balustrade-v1.png", pool: "/assets/systems/ai/viking-aluminium-pool-v1.png" },
  "viking-glass": { balustrade: "/assets/systems/ai/viking-glass-balustrade-v1.png", pool: "/assets/systems/ai/viking-glass-pool-v1.png" },
  vista: { balustrade: "/assets/systems/ai/vista-balustrade-v1.png", pool: "/assets/systems/ai/vista-pool-v1.png" },
  "not-sure": { balustrade: "/assets/systems/ai/not-sure-balustrade-v1.png", pool: "/assets/systems/ai/not-sure-pool-v1.png" },
};

const systemsByFamily: Record<Exclude<DesignFamily, "not_sure" | "">, readonly SystemId[]> = {
  balustrade: ["double-disc", "hidden", "jh-clamp", "lugano", "mini-post", "mp-sp14", "side-channel", "top-channel", "unex-metropolis", "viking-glass", "vista"],
  pool: ["double-disc", "hidden", "jh-clamp", "lugano", "mini-post", "mp-sp14", "side-channel", "top-channel", "unex-ascot", "unex-metropolis", "viking-aluminium", "viking-glass", "vista"],
  aluminium: ["unex-ascot", "viking-aluminium"],
  canopy: ["juralco-canopy"],
};

export function getSystemsForFamily(family: DesignFamily): readonly SystemId[] {
  if (!family || family === "not_sure") return [];
  return systemsByFamily[family];
}

export function getSystemReferenceImages(system: SystemId, family: DesignFamily): readonly string[] {
  const references = systemReferenceImages[system];
  if (family === "canopy") return references.canopy ?? [];
  if (family === "pool") return references.pool ? [references.pool] : [];
  return references.balustrade ? [references.balustrade] : [];
}

const locationOptions = [
  ["deck", "Deck"], ["balcony", "Balcony"], ["stair", "Stair"], ["landing", "Landing"],
  ["juliet-window", "Juliet window"], ["entrance-facade", "Entrance facade"],
  ["pool-area", "Pool area"], ["other", "Other"],
] as const;

function cloneInitialState(): JourneyState {
  return structuredClone(initialJourneyState);
}

function stepIsValid(state: JourneyState, step: number): boolean {
  if (step === 0) return Boolean(state.need);
  if (step === 1) return !applicationInputError("address", state.project.address)
    && !applicationInputError("buildingConsentNumber", state.project.buildingConsentNumber)
    && !applicationInputError("resourceConsentNumber", state.project.resourceConsentNumber);
  if (step === 2) return Boolean(state.design.family && state.design.system);
  if (step === 3) return Boolean(state.site.substrate) && state.site.locations.every((location) =>
    location.types.length > 0 && location.environment
      && (!location.types.includes("other") || !applicationInputError("otherLocation", location.other)),
  );
  if (step === 5) return applicantDetailsError(state) === null && Boolean(state.applicant.role);
  return true;
}

export function Field({ label, value, onChange, validationName, type = "text", required = false, placeholder = "", autoComplete, maxLength, inputMode }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  validationName: ApplicationInputName;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  inputMode?: "email" | "search" | "tel" | "text" | "url" | "none" | "numeric" | "decimal";
}) {
  const [touchedName, setTouchedName] = useState<ApplicationInputName | null>(null);
  const error = touchedName === validationName ? applicationInputError(validationName, value) : null;
  const errorId = useId();
  return <label className={`field ${error ? "field-invalid" : ""}`}><span>{label}{required ? " *" : ""}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => setTouchedName(validationName)} placeholder={placeholder} required={required} autoComplete={autoComplete} maxLength={maxLength} inputMode={inputMode} aria-invalid={error ? "true" : "false"} aria-describedby={error ? errorId : undefined} />{error ? <small id={errorId} className="field-warning" role="alert">{error}</small> : null}</label>;
}

type AddressValue = { address: string };
type GooglePlace = {
  formattedAddress?: string;
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};
type GoogleAutocompleteElement = HTMLElement & { value?: string };

function JobAddressField({ value, googleReady, googleEnabled, onChange }: {
  value: string;
  googleReady: boolean;
  googleEnabled: boolean;
  onChange: (value: AddressValue) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [manual, setManual] = useState(!googleEnabled);
  const [loadFailed, setLoadFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  const errorId = useId();
  const error = touched ? applicationInputError("address", value) : null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!googleEnabled || !googleReady || manual || !container.current || !window.google) return;
    let disposed = false;
    let autocomplete: GoogleAutocompleteElement | null = null;

    void window.google.maps.importLibrary("places").then((library) => {
      if (disposed || !container.current) return;
      const { PlaceAutocompleteElement } = library as {
        PlaceAutocompleteElement: new (options?: Record<string, unknown>) => GoogleAutocompleteElement;
      };
      autocomplete = new PlaceAutocompleteElement({
        includedRegionCodes: ["nz"],
        placeholder: "Start typing the job address",
      });
      autocomplete.className = "google-address-control";
      autocomplete.setAttribute("aria-label", "Job address");
      if (value) autocomplete.value = value;
      autocomplete.addEventListener("gmp-select", ((event: Event) => {
        const selection = event as Event & { placePrediction?: { toPlace: () => GooglePlace } };
        const place = selection.placePrediction?.toPlace();
        if (!place) return;
        void place.fetchFields({ fields: ["formattedAddress"] }).then(() => {
          onChangeRef.current({ address: place.formattedAddress ?? "" });
        });
      }) as EventListener);
      container.current.replaceChildren(autocomplete);
    }).catch(() => {
      if (!disposed) {
        setLoadFailed(true);
        setManual(true);
      }
    });

    return () => {
      disposed = true;
      autocomplete?.remove();
    };
  }, [googleEnabled, googleReady, manual, value]);

  if (manual) {
    return <div className="address-field"><Field label="Job address" required value={value} validationName="address" maxLength={applicationInputLimits.address} onChange={(address) => onChange({ address })} placeholder="Street address" autoComplete="street-address" />{loadFailed ? <p className="field-hint">Address suggestions are unavailable. You can still enter the address manually.</p> : null}</div>;
  }

  return <div className={`field full address-field ${error ? "field-invalid" : ""}`} onBlurCapture={() => setTouched(true)}><span>Job address *</span><div ref={container} className="google-address-host" aria-invalid={error ? "true" : "false"} aria-describedby={error ? errorId : undefined}>{!googleReady ? <span className="field-loading">Loading address suggestions…</span> : null}</div>{error ? <small id={errorId} className="field-warning" role="alert">{error}</small> : null}<button type="button" className="text-action" onClick={() => setManual(true)}>Enter address manually</button></div>;
}

function CheckIcon({ className = "" }: { className?: string }) {
  return <svg className={`check-icon ${className}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.25 6.35 11.5 13 4.75" /></svg>;
}

function Choice({ selected, title, description, onClick, image }: { selected: boolean; title: string; description?: string; onClick: () => void; image?: string }) {
  return <button type="button" className={`choice ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}>
    {image ? <span className="choice-image"><Image src={image} alt="" fill sizes="(max-width: 560px) calc(100vw - 3.3rem), (max-width: 850px) calc((100vw - 4.5rem) / 2), 260px" /></span> : null}<span><strong>{title}{selected ? <CheckIcon /> : null}</strong>{description ? <small>{description}</small> : null}</span>
  </button>;
}

type SiteLocation = JourneyState["site"]["locations"][number];

function locationTypesSummary(types: string[]): string {
  if (types.length === 0) return "Select one or more areas";
  const labels = types.map((type) => locationOptions.find(([value]) => value === type)?.[1] ?? type);
  return labels.length <= 2 ? labels.join(", ") : `${labels.length} areas selected`;
}

export function LocationAreaFields({ index, location, onChange, onToggle }: {
  index: number;
  location: SiteLocation;
  onChange: (value: Partial<SiteLocation>) => void;
  onToggle: (type: LocationType) => void;
}) {
  return <div className="area-fields">
    <div className="radio-row area-environment">
      <span>Is this area internal or external? *</span>
      <label><input type="radio" name={`environment-${index}`} checked={location.environment === "internal"} onChange={() => onChange({ environment: "internal" })} /> Internal</label>
      <label><input type="radio" name={`environment-${index}`} checked={location.environment === "external"} onChange={() => onChange({ environment: "external" })} /> External</label>
    </div>
    <details className="multi-select">
      <summary><span><strong>Area type *</strong><small>{locationTypesSummary(location.types)}</small></span></summary>
      <div className="multi-select-options" role="group" aria-label={`Area ${index + 1} types`}>
        {locationOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={location.types.includes(value)} onChange={() => onToggle(value)} /><span>{label}</span></label>)}
      </div>
    </details>
    {location.types.includes("other") ? <Field label="Describe other location" required value={location.other} validationName="otherLocation" maxLength={applicationInputLimits.otherLocation} onChange={(other) => onChange({ other })} /> : null}
  </div>;
}

export function SystemReferenceCard({ system, family }: {
  system: SystemId;
  family: DesignFamily;
}) {
  const selectedSystem = systems.find(([value]) => value === system);
  const images = getSystemReferenceImages(system, family);

  if (!selectedSystem || images.length === 0) return null;

  return <figure className="system-reference-card">
    <span className="system-reference-image">
      <Image src={images[0]} alt={`Visual guide for the ${selectedSystem[1]} system`} fill sizes="(max-width: 560px) calc(100vw - 3.3rem), (max-width: 850px) calc(100vw - 6rem), 820px" />
    </span>
    <figcaption><strong>{selectedSystem[1]}</strong><span>Visual guide only — our team will confirm the final system.</span></figcaption>
  </figure>;
}

export function ApplicationSuccess({ reference, email }: { reference?: string; email?: string }) {
  return (
    <div className="rg-ps1">
      <div className="portal-shell">
        <header className="portal-masthead success-masthead">
          <div className="masthead-shade" />
          <div className="masthead-content">
            <Image className="brand-logo" src="/assets/brand/royal-glass-logo-white.png" alt="Royal Glass" width={150} height={72} priority />
            <div className="success-heading">
              <span className="success-icon"><CheckIcon className="success-check" /></span>
              <h1>Thank you. Your application is with Royal Glass.</h1>
            </div>
            <p>Our team has received your application and will begin reviewing it.</p>
          </div>
        </header>
        <main className="success-card">
          <p className="success-label">Application received</p>
          {reference ? <div className="reference-panel"><span>Application reference</span><strong>{reference}</strong></div> : null}
          {email ? <div className="email-confirmation">
            <CheckIcon className="email-confirmation-icon" />
            <span><strong>A confirmation email will be sent to</strong><small>{email}</small></span>
          </div> : null}
          {email ? <p className="email-hint">Check your junk folder if it does not arrive within a few minutes.</p> : null}
          <div className="success-actions"><Link className="button primary" href="/">Back to homepage</Link></div>
        </main>
      </div>
    </div>
  );
}

export function ApplicationReceiptUnavailable() {
  return (
    <div className="rg-ps1">
      <div className="portal-shell">
        <header className="portal-masthead success-masthead">
          <div className="masthead-shade" />
          <div className="masthead-content">
            <Image className="brand-logo" src="/assets/brand/royal-glass-logo-white.png" alt="Royal Glass" width={150} height={72} priority />
            <h1>Receipt unavailable</h1>
            <p>This browser does not have a submitted application receipt to display.</p>
          </div>
        </header>
        <main className="success-card">
          <p className="success-label">Return to the homepage to start or continue an application.</p>
          <div className="success-actions"><Link className="button primary" href="/">Back to homepage</Link></div>
        </main>
      </div>
    </div>
  );
}

export function ApplicationForm({ siteKey, googleMapsApiKey, draftId }: { siteKey: string; googleMapsApiKey: string; draftId?: string }) {
  const [state, setState] = useState<JourneyState>(cloneInitialState);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [session, setSession] = useState<DraftSession | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [googleMapsFailed, setGoogleMapsFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ reference: string; submittedAt: string } | null>(null);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const sessionPromise = useRef<Promise<DraftSession> | null>(null);
  const sessionRef = useRef<DraftSession | null>(null);
  const uploadItemsRef = useRef<UploadItem[]>([]);
  const activeUploads = useRef(0);
  const removedUploadItems = useRef(new Set<string>());
  const nextUploadItemId = useRef(0);

  useEffect(() => {
    if (!draftId) return;
    async function restoreDraft() {
      await Promise.resolve();
      const token = decodeURIComponent(location.hash.replace(/^#token=/, ""));
      if (!token) throw new Error("This resume link is incomplete. Open the full link from your saved copy.");
      setBusy(true);
      const loaded = await loadDraft(draftId!, token);
        setState(loaded);
        const restoredSession = { id: draftId!, resumeToken: token, expiresAt: "", resumeUrl: location.href };
        sessionRef.current = restoredSession;
        setSession(restoredSession);
        setStatus("Saved application restored");
    }
    void restoreDraft().catch((reason: Error) => setError(reason.message)).finally(() => setBusy(false));
  }, [draftId]);

  useEffect(() => {
    if (step !== 4 && step !== stepLabels.length - 1) return;
    if (!turnstileReady || !siteKey || session || turnstileToken || widgetId.current || !turnstileContainer.current || !window.turnstile) return;
    const renderedWidgetId = window.turnstile.render(turnstileContainer.current, {
      sitekey: siteKey,
      theme: "light",
      callback: (token: string) => { setTurnstileToken(token); setError(""); },
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setError("The security check could not load. Refresh the page and try again."),
    });
    widgetId.current = renderedWidgetId;
    return () => {
      if (widgetId.current === renderedWidgetId) {
        window.turnstile?.remove(renderedWidgetId);
        widgetId.current = null;
      }
    };
  }, [turnstileReady, siteKey, session, step, turnstileToken]);

  const allRequiredValid = useMemo(() => [0, 1, 2, 3, 4, 5].every((index) => stepIsValid(state, index)), [state]);
  const uploadActive = uploadItems.some((item) => item.status === "preparing" || item.status === "uploading" || item.status === "removing");

  function patch<K extends keyof JourneyState>(key: K, value: JourneyState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    setStatus("");
  }

  async function ensureSession(): Promise<DraftSession> {
    if (sessionRef.current) return sessionRef.current;
    if (sessionPromise.current) return sessionPromise.current;
    if (!siteKey) throw new Error("The security check is not configured yet.");
    if (!turnstileToken) throw new Error("Complete the security check before saving.");
    const creating = createDraftSession(turnstileToken).then((created) => {
      sessionRef.current = created;
      setSession(created);
      history.replaceState({}, "", `/application/${created.id}#token=${encodeURIComponent(created.resumeToken)}`);
      return created;
    }).catch((reason) => {
      setTurnstileToken("");
      throw reason;
    }).finally(() => {
      sessionPromise.current = null;
    });
    sessionPromise.current = creating;
    return creating;
  }

  function replaceUploadItems(next: UploadItem[]) {
    uploadItemsRef.current = next;
    setUploadItems(next);
  }

  function updateUploadItem(clientId: string, update: Partial<UploadItem>) {
    replaceUploadItems(uploadItemsRef.current.map((item) =>
      item.clientId === clientId ? { ...item, ...update } : item,
    ));
  }

  async function runUpload(item: UploadItem) {
    let uploaded: UploadedFile;
    try {
      const activeSession = await ensureSession();
      uploaded = await uploadApplicationFile(activeSession, item.file);
    } catch (reason) {
      if (removedUploadItems.current.delete(item.clientId)) {
        replaceUploadItems(uploadItemsRef.current.filter((candidate) => candidate.clientId !== item.clientId));
      } else {
        updateUploadItem(item.clientId, { status: "failed" });
        setError(reason instanceof Error ? reason.message : "The file could not be uploaded. Try again.");
      }
      activeUploads.current -= 1;
      pumpUploads();
      return;
    }

    if (removedUploadItems.current.delete(item.clientId)) {
      try {
        const activeSession = await ensureSession();
        await removeApplicationUpload(activeSession, uploaded.id);
        replaceUploadItems(uploadItemsRef.current.filter((candidate) => candidate.clientId !== item.clientId));
      } catch (reason) {
        updateUploadItem(item.clientId, { status: "uploaded", uploaded });
        setError(reason instanceof Error ? reason.message : "The file could not be removed. Try again.");
      }
    } else {
      updateUploadItem(item.clientId, { status: "uploaded", uploaded });
    }
    activeUploads.current -= 1;
    pumpUploads();
  }

  function pumpUploads() {
    while (activeUploads.current < 2) {
      const item = uploadItemsRef.current.find((candidate) => candidate.status === "preparing");
      if (!item) break;
      updateUploadItem(item.clientId, { status: "uploading" });
      activeUploads.current += 1;
      void runUpload(item);
    }
  }

  async function persist(message: string): Promise<DraftSession | null> {
    setBusy(true); setError(""); setStatus("");
    try {
      const activeSession = await ensureSession();
      await saveDraft(activeSession, state);
      setStatus(message);
      return activeSession;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The application could not be saved.");
      return null;
    } finally { setBusy(false); }
  }

  async function continueForward() {
    if (!stepIsValid(state, step)) { setError("Complete the required information on this step."); return; }
    if (session) {
      const saved = await persist("Draft saved");
      if (!saved) return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
    setFurthestStep((current) => Math.max(current, step + 1));
  }

  function addFiles(selected: FileList | null) {
    if (!selected?.length) return;
    const available = 5 - uploadItemsRef.current.length;
    const nextFiles = Array.from(selected).slice(0, available);
    const nextItems = nextFiles.map((file) => ({
      clientId: `file-${nextUploadItemId.current += 1}`,
      file,
      status: "preparing" as const,
    }));
    replaceUploadItems([...uploadItemsRef.current, ...nextItems]);
    setStatus("");
    setError("");
    pumpUploads();
  }

  function retryUpload(clientId: string) {
    setError("");
    updateUploadItem(clientId, { status: "preparing" });
    pumpUploads();
  }

  async function removeUpload(item: UploadItem) {
    if (item.status === "uploading" || item.status === "removing") {
      removedUploadItems.current.add(item.clientId);
      updateUploadItem(item.clientId, { status: "removing" });
      return;
    }
    if (item.status !== "uploaded" || !item.uploaded) {
      replaceUploadItems(uploadItemsRef.current.filter((candidate) => candidate.clientId !== item.clientId));
      return;
    }
    updateUploadItem(item.clientId, { status: "removing" });
    try {
      const activeSession = await ensureSession();
      await removeApplicationUpload(activeSession, item.uploaded.id);
      replaceUploadItems(uploadItemsRef.current.filter((candidate) => candidate.clientId !== item.clientId));
    } catch (reason) {
      updateUploadItem(item.clientId, { status: "uploaded" });
      setError(reason instanceof Error ? reason.message : "The file could not be removed. Try again.");
    }
  }

  async function submit() {
    if (!allRequiredValid || !state.acknowledgement) { setError("Complete the required information and confirm the application."); return; }
    setBusy(true); setError("");
    try {
      if (uploadItemsRef.current.some((item) => item.status === "preparing" || item.status === "uploading" || item.status === "removing")) {
        throw new Error("Wait for all uploads to finish before submitting.");
      }
      const activeSession = await ensureSession();
      await saveDraft(activeSession, state);
      const receipt = await submitApplication(activeSession, state);
      persistSubmissionReceipt({ ...receipt, email: state.applicant.email });
      setSubmitted(receipt);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The application could not be submitted."); }
    finally { setBusy(false); }
  }

  function needStep() {
    const needs = [
      ["ps1", "I need a PS1", "I am preparing or responding to a Building Consent application."],
      ["quote", "I need a quotation first", "I want pricing before deciding whether to proceed with a PS1."],
      ["unsure", "I’m not sure whether I need a PS1", "Royal Glass can review the project and advise the appropriate next step."],
    ] as const;
    return <><h3>What do you need?</h3><div className="choice-stack">{needs.map(([value, title, description]) => <Choice key={value} selected={state.need === value} title={title} description={description} onClick={() => patch("need", value)} />)}</div></>;
  }

  function projectStep() {
    const project = state.project;
    const update = (value: Partial<JourneyState["project"]>) => patch("project", { ...project, ...value });
    return <><h3>Tell us about the project</h3><JobAddressField value={project.address} googleReady={googleMapsReady && !googleMapsFailed} googleEnabled={Boolean(googleMapsApiKey) && !googleMapsFailed} onChange={({ address }) => update({ address })} /><div className="field-grid project-fields"><Field label="Building Consent number (BC)" value={project.buildingConsentNumber} validationName="buildingConsentNumber" maxLength={applicationInputLimits.consentNumber} onChange={(buildingConsentNumber) => update({ buildingConsentNumber })} placeholder="If available" /><Field label="Resource Consent number (RC)" value={project.resourceConsentNumber} validationName="resourceConsentNumber" maxLength={applicationInputLimits.consentNumber} onChange={(resourceConsentNumber) => update({ resourceConsentNumber })} placeholder="If applicable" />
      <label className="field"><span>Estimated installation date</span><select value={project.estimatedInstallation} onChange={(event) => update({ estimatedInstallation: event.target.value as JourneyState["project"]["estimatedInstallation"] })}><option value="not_sure">Not sure</option><option value="asap">ASAP</option><option value="3_months">Within 3 months</option><option value="6_months">Within 6 months</option><option value="1_year">Within 1 year</option><option value="2_years">Within 2 years</option></select></label>
      <label className="field"><span>What stage is the project at? <small>Optional</small></span><select value={project.stage} onChange={(event) => update({ stage: event.target.value as JourneyState["project"]["stage"] })}><option value="">Select if known</option><option value="concept">Concept / Early Design</option><option value="developed">Developed Design</option><option value="preparing_consent">Preparing Building Consent</option><option value="consent_lodged">Building Consent lodged</option><option value="council_rfi">Council RFI received</option><option value="consent_approved">Building Consent approved</option><option value="construction">Construction underway</option><option value="existing">Existing building / alteration</option><option value="other">Other</option></select></label></div></>;
  }

  function designStep() {
    const familyChoices = [
      ["balustrade", "Glass balustrade", "Decks, balconies, stairs, landings and other barriers.", "/assets/systems/ai/double-disc-balustrade-v1.png"],
      ["pool", "Pool fence", "Glass or aluminium fencing around a swimming pool.", "/assets/systems/ai/double-disc-pool-v1.png"],
      ["aluminium", "Aluminium balustrade", "Framed aluminium barriers for decks and balconies.", "/assets/systems/ai/viking-aluminium-balustrade-v1.png"],
      ["canopy", "Canopy", "Juralco EDGE glass canopy.", "/assets/systems/ai/juralco-canopy-commercial-v1.png"],
      ["not_sure", "Not sure", "Royal Glass can identify the right project type.", "/assets/systems/ai/not-sure-balustrade-v1.png"],
    ] as const;
    const availableSystems = getSystemsForFamily(state.design.family);

    return <><h3>What type of system is this?</h3><p className="section-intro">Choose the closest application, then select the system name if you know it.</p><div className="design-family-grid">{familyChoices.map(([family, title, description, image]) => <Choice key={family} selected={state.design.family === family} title={title} description={description} image={image} onClick={() => patch("design", { family, system: family === "canopy" ? "juralco-canopy" : family === "not_sure" ? "not-sure" : "" })} />)}</div>{availableSystems.length > 1 ? <label className="field full system-select"><span>Royal Glass system *</span><select value={state.design.system} onChange={(event) => patch("design", { ...state.design, system: event.target.value as JourneyState["design"]["system"] })}><option value="">Select a system</option>{availableSystems.map((value) => <option key={value} value={value}>{systems.find(([system]) => system === value)?.[1]}</option>)}</select></label> : null}{state.design.system && state.design.system !== "not-sure" ? <SystemReferenceCard system={state.design.system as SystemId} family={state.design.family} /> : null}{state.design.system === "not-sure" ? <div className="notice">No problem. Add a photo, drawing, sketch or inspiration image in the documents section if you have one.</div> : null}</>;
  }

  function siteStep() {
    const substrates = [["timber", "Timber", "substrate-timber.jpg", undefined], ["concrete", "Concrete", "substrate-concrete.jpg", undefined], ["steel", "Steel", "substrate-steel.jpg", undefined], ["tile-concrete", "Tile over concrete", "substrate-tile.jpg", undefined], ["not_sure", "Not Sure", undefined, "Don’t worry, our team will help you."]] as const;
    function updateLocation(index: number, value: Partial<JourneyState["site"]["locations"][number]>) {
      const locations = state.site.locations.map((location, current) => current === index ? { ...location, ...value } : location);
      patch("site", { ...state.site, locations });
    }
    function toggleLocation(index: number, type: LocationType) {
      const location = state.site.locations[index];
      if (type === "pool-area" && !location.types.includes(type)) { patch("site", { ...state.site, locations: [{ ...location, types: [type], other: "" }] }); return; }
      const types = nextLocationTypes(location.types, type);
      updateLocation(index, { types, other: types.includes("other") ? location.other : "" });
    }
    return <><h3>What will the glass system be fixed to?</h3><div className="image-grid four substrate-grid">{substrates.map(([value, title, image, description]) => <Choice key={value} selected={state.site.substrate === value} title={title} description={description} image={image ? `/assets/${image}` : undefined} onClick={() => patch("site", { ...state.site, substrate: value })} />)}</div><div className="section-head"><div><h3>Locations <small>Optional</small></h3><p>Add up to three areas if you know them. Pool area must be the only area.</p></div><button type="button" className="button secondary" disabled={state.site.locations.length >= 3 || state.site.locations.some((location) => location.types.includes("pool-area"))} onClick={() => patch("site", { ...state.site, locations: [...state.site.locations, { types: [], environment: "", other: "" }] })}>Add location</button></div>
      <div className="areas">{state.site.locations.map((location, index) => <fieldset key={index} className="area"><legend>Area {index + 1}</legend>{state.site.locations.length > 1 ? <button type="button" className="text-button" onClick={() => patch("site", { ...state.site, locations: state.site.locations.filter((_, current) => current !== index) })}>Remove</button> : null}<LocationAreaFields index={index} location={location} onChange={(value) => updateLocation(index, value)} onToggle={(type) => toggleLocation(index, type)} /></fieldset>)}</div></>;
  }

  function documentsStep() {
    const fileCount = uploadItems.length;
    const uploadEnabled = Boolean(session || turnstileToken);
    return <><p className="section-intro">Add anything you already have. This section is optional.</p>{!session ? <div className="security-box"><strong>Security check</strong><p>Complete this quick check before selecting files. It protects uploads from automated abuse.</p>{turnstileToken ? <p className="security-complete"><CheckIcon /> Security check complete</p> : siteKey ? <div ref={turnstileContainer} /> : <p className="error-text">Security check configuration is required before files can upload.</p>}</div> : null}<label className={`upload-zone ${fileCount >= 5 || !uploadEnabled ? "disabled" : ""}`}><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg" disabled={busy || fileCount >= 5 || !uploadEnabled} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /><strong>{fileCount >= 5 ? "Maximum of 5 files reached" : uploadEnabled ? "Select drawings, documents or photos" : "Complete the security check to add files"}</strong><span>PDF, JPG, PNG or DWG · up to 10 MB each</span></label><div className="file-list">{uploadItems.map((item) => <div key={item.clientId}><span><strong>{item.file.name}</strong><small>{Math.ceil(item.file.size / 1024)} KB</small></span><span className="file-actions">{item.status === "failed" ? <button type="button" className="text-button upload-retry" onClick={() => retryUpload(item.clientId)}>Upload failed — Retry</button> : <b className={`upload-status ${item.status}`}>{item.status === "preparing" ? "Ready/preparing" : item.status === "uploading" ? "Uploading…" : item.status === "uploaded" ? "Uploaded" : "Removing…"}</b>}<button type="button" className="text-button" onClick={() => void removeUpload(item)} aria-label={`Remove ${item.file.name}`}>Remove</button></span></div>)}</div><div className="notice">Don’t have everything yet? Submit what you have. You can send additional drawings, photos, or details afterward using your application reference.</div></>;
  }

  function applicantStep() {
    return <><h3>Your contact details</h3><p className="section-intro">We need these details so our team can review the project and contact you.</p><div className="field-grid"><Field label="Full name" value={state.applicant.name} validationName="name" maxLength={applicationInputLimits.name} required autoComplete="name" onChange={(name) => patch("applicant", { ...state.applicant, name })} /><Field label="NZ mobile or landline" type="tel" value={state.applicant.mobile} validationName="mobile" maxLength={applicationInputLimits.mobile} inputMode="tel" required autoComplete="tel" onChange={(mobile) => patch("applicant", { ...state.applicant, mobile })} /><Field label="Email" type="email" value={state.applicant.email} validationName="email" maxLength={applicationInputLimits.email} inputMode="email" required autoComplete="email" onChange={(email) => patch("applicant", { ...state.applicant, email })} /><label className="field"><span>Role *</span><select required value={state.applicant.role} onChange={(event) => patch("applicant", { ...state.applicant, role: event.target.value as JourneyState["applicant"]["role"] })}><option value="">Select your role</option><option value="architect">Architect / Designer</option><option value="builder">Builder</option><option value="developer">Developer</option><option value="homeowner">Homeowner</option><option value="other">Other</option></select></label></div>
      {!session ? <div className="security-box"><strong>Security check</strong><p>Complete this quick check before submitting. It protects the form from automated spam.</p>{turnstileToken ? <p className="security-complete"><CheckIcon /> Security check complete</p> : siteKey ? <div ref={turnstileContainer} /> : <p className="error-text">Security check configuration is required before this form can submit.</p>}</div> : null}
      <label className="confirm"><input type="checkbox" checked={state.acknowledgement} onChange={(event) => patch("acknowledgement", event.target.checked)} /><span>I confirm the information is accurate to the best of my knowledge and may be submitted to Royal Glass for review.</span></label><div className="notice amber"><strong>What happens next</strong><p>Royal Glass reviews the project information and contacts you if anything else is needed. Submission does not automatically confirm that a PS1 will be issued.</p></div></>;
  }

  const content = [needStep, projectStep, designStep, siteStep, documentsStep, applicantStep][step]();
  const saveState = status || (session ? "Draft active" : "Not saved yet");

  if (submitted) return <ApplicationSuccess reference={submitted.reference} email={state.applicant.email} />;

  return (
    <div className="rg-ps1">
      <div className="portal-shell">
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setTurnstileReady(true)} onError={() => setError("The security check could not load. Refresh the page and try again.")} />
        {googleMapsApiKey ? <Script src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&loading=async&v=weekly`} strategy="afterInteractive" onReady={() => setGoogleMapsReady(true)} onError={() => setGoogleMapsFailed(true)} /> : null}
        <header className="portal-masthead">
          <div className="masthead-shade" />
          <div className="masthead-content">
            <div className="masthead-meta">
              <Image className="brand-logo" src="/assets/brand/royal-glass-logo-white.png" alt="Royal Glass" width={150} height={72} priority />
              <p>Secure application <span aria-hidden="true">·</span> {saveState}</p>
            </div>
            <h1>Tell us about your project</h1>
            <p className="masthead-intro">This usually takes less than a minute. If you don’t know an answer, choose “Not sure” and our team will help.</p>
            <div className="hero-progress" aria-label={`Step ${step + 1} of ${stepLabels.length}: ${stepLabels[step]}`}>
              <div><span>Step {step + 1} of {stepLabels.length}</span><strong>{stepLabels[step]}</strong></div>
              <div className="hero-progress-track" aria-hidden="true"><span style={{ transform: `scaleX(${(step + 1) / stepLabels.length})` }} /></div>
            </div>
          </div>
        </header>
        <section className="primer" aria-label="Before you start">
          <div><strong>PS1 is for design</strong><span>Start before installation. A PS3 relates to completed work.</span></div>
          <div><strong>You can begin now</strong><span>Incomplete drawings are okay—upload what you already have.</span></div>
          <div><strong>Reviewed by people</strong><span>Royal Glass confirms the correct route after submission.</span></div>
        </section>
        <main className="application-layout">
          <aside className="step-rail">
            <h2>Your application</h2>
            <p>Complete each section in order.</p>
            <div className="step-list" data-step={step}>
              {stepLabels.map((label, index) => {
                const available = index <= furthestStep || index < step;
                const complete = index < step && stepIsValid(state, index);
                return <button type="button" key={label} disabled={!available} className={`${index === step ? "active" : ""} ${complete ? "complete" : ""}`} onClick={() => setStep(index)}><span>{complete ? <CheckIcon /> : index + 1}</span>{label}</button>;
              })}
            </div>
          </aside>
          <section className="form-card">
            <div className="step-heading"><span>{step + 1}</span><div><p className="step-progress-label">Step {step + 1} of {stepLabels.length}</p><h2>{stepLabels[step]}</h2></div></div>
            {content}
            {error ? <div className="form-error" role="alert">{error}</div> : null}
            {status ? <div className="form-status" role="status">{status}</div> : null}
            <div className="form-actions">
              <button type="button" className="button secondary" disabled={step === 0 || busy} onClick={() => setStep((current) => current - 1)}>Back</button>
              {step < stepLabels.length - 1 ? <button type="button" className="button primary" disabled={busy || !stepIsValid(state, step)} onClick={() => void continueForward()}>{busy ? "Saving…" : "Continue"}</button> : <button type="button" className="button primary" disabled={busy || uploadActive || !allRequiredValid || !state.acknowledgement} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit application"}</button>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
