"use client";

import Script from "next/script";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createDraftSession,
  initialJourneyState,
  loadDraft,
  saveForLaterError,
  saveDraft,
  sendDraftResumeLink,
  submitApplication,
  uploadApplicationFile,
  type DraftSession,
  type JourneyState,
  type UploadedFile,
} from "@/modules/applications/public-journey";
import { nextLocationTypes } from "@/modules/applications/location-types";
import { DraftSavedNotice } from "./draft-saved-notice";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
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
  ["juralco-canopy", "Juralco Canopy"], ["lugano", "Lugano"], ["mini-post", "Mini Post"],
  ["mp-sp14", "Mini Post SP14"], ["side-channel", "Side Mount Channel"],
  ["top-channel", "Top Mount Channel"], ["unex-ascot", "Unex Ascot"],
  ["unex-metropolis", "Unex Metropolis"], ["viking-aluminium", "Viking Aluminium"],
  ["viking-glass", "Viking Glass"], ["vista", "Vista"], ["not-sure", "Not sure"],
] as const;

type SystemId = (typeof systems)[number][0];

const systemReferenceImages: Partial<Record<SystemId, string>> = {
  "double-disc": "/assets/fix-standoff.jpg",
  hidden: "/assets/fix-standoff.jpg",
  "jh-clamp": "/assets/fix-standoff.jpg",
  "juralco-canopy": "/assets/not-sure.jpg",
  lugano: "/assets/fix-standoff.jpg",
  "mini-post": "/assets/fix-spigots.jpg",
  "mp-sp14": "/assets/fix-spigots.jpg",
  "side-channel": "/assets/fix-channel.jpg",
  "top-channel": "/assets/fix-channel.jpg",
  "unex-ascot": "/assets/not-sure.jpg",
  "unex-metropolis": "/assets/not-sure.jpg",
  "viking-aluminium": "/assets/not-sure.jpg",
  "viking-glass": "/assets/not-sure.jpg",
  vista: "/assets/not-sure.jpg",
};

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
  if (step === 1) return Boolean(state.project.address.trim());
  if (step === 2) return Boolean(state.design.family && state.design.system);
  if (step === 3) return Boolean(state.site.substrate) && state.site.locations.every((location) =>
    location.types.length > 0 && location.environment && (!location.types.includes("other") || location.other.trim()),
  );
  if (step === 5) return saveForLaterError(state) === null;
  return true;
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "", autoComplete }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; autoComplete?: string;
}) {
  return <label className="field"><span>{label}{required ? " *" : ""}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete} /></label>;
}

type AddressValue = { address: string; city: string; postalCode: string };
type GoogleAddressComponent = { longText?: string; types?: string[] };
type GooglePlace = {
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
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
        void place.fetchFields({ fields: ["formattedAddress", "addressComponents"] }).then(() => {
          const components = place.addressComponents ?? [];
          const component = (...types: string[]) => components.find((item) => item.types?.some((type) => types.includes(type)))?.longText ?? "";
          onChangeRef.current({
            address: place.formattedAddress ?? "",
            city: component("locality", "postal_town", "sublocality_level_1"),
            postalCode: component("postal_code"),
          });
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
    return <div className="address-field"><Field label="Job address" required value={value} onChange={(address) => onChange({ address, city: "", postalCode: "" })} placeholder="Street address" autoComplete="street-address" />{loadFailed ? <p className="field-hint">Address suggestions are unavailable. You can still enter the address manually.</p> : null}</div>;
  }

  return <div className="field full address-field"><span>Job address *</span><div ref={container} className="google-address-host">{!googleReady ? <span className="field-loading">Loading address suggestions…</span> : null}</div><button type="button" className="text-action" onClick={() => setManual(true)}>Enter address manually</button></div>;
}

function CheckIcon({ className = "" }: { className?: string }) {
  return <svg className={`check-icon ${className}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.25 6.35 11.5 13 4.75" /></svg>;
}

function Choice({ selected, title, description, onClick, image }: { selected: boolean; title: string; description?: string; onClick: () => void; image?: string }) {
  return <button type="button" className={`choice ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}>
    {image ? <span className="choice-image"><Image src={image} alt="" fill loading="eager" sizes="(max-width: 560px) calc(100vw - 4rem), (max-width: 850px) 45vw, 260px" /></span> : null}<span><strong>{title}{selected ? <CheckIcon /> : null}</strong>{description ? <small>{description}</small> : null}</span>
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
  onToggle: (type: string) => void;
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
    {location.types.includes("other") ? <Field label="Describe other location" required value={location.other} onChange={(other) => onChange({ other })} /> : null}
  </div>;
}

export function SystemReferenceCard({ system }: { system: string }) {
  const selectedSystem = systems.find(([value]) => value === system);
  const image = systemReferenceImages[system as SystemId];

  if (!selectedSystem || !image || system === "not-sure") return null;

  return <figure className="system-reference-card">
    <Image src={image} alt={`Reference view of the ${selectedSystem[1]} system`} width={1040} height={480} />
    <figcaption>
      <strong>{selectedSystem[1]}</strong>
      <span>Representative prototype image — replace with the approved system photo.</span>
    </figcaption>
  </figure>;
}

export function ApplicationForm({ siteKey, googleMapsApiKey, draftId }: { siteKey: string; googleMapsApiKey: string; draftId?: string }) {
  const [state, setState] = useState<JourneyState>(cloneInitialState);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [session, setSession] = useState<DraftSession | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [googleMapsFailed, setGoogleMapsFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [savedReceipt, setSavedReceipt] = useState<{ resumeUrl: string; email: string; emailed?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ reference: string; submittedAt: string } | null>(null);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    async function restoreDraft() {
      await Promise.resolve();
      const token = decodeURIComponent(location.hash.replace(/^#token=/, ""));
      if (!token) throw new Error("This resume link is incomplete. Open the full link from your saved copy.");
      setBusy(true);
      const loaded = await loadDraft(draftId!, token);
        setState(loaded);
        setSession({ id: draftId!, resumeToken: token, expiresAt: "", resumeUrl: location.href });
        setStatus("Saved application restored");
    }
    void restoreDraft().catch((reason: Error) => setError(reason.message)).finally(() => setBusy(false));
  }, [draftId]);

  useEffect(() => {
    if (step !== stepLabels.length - 1) {
      widgetId.current = null;
      return;
    }
    if (!turnstileReady || !siteKey || session || turnstileToken || widgetId.current || !turnstileContainer.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(turnstileContainer.current, {
      sitekey: siteKey,
      theme: "light",
      callback: (token: string) => { setTurnstileToken(token); setError(""); },
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setError("The security check could not load. Refresh the page and try again."),
    });
  }, [turnstileReady, siteKey, session, step, turnstileToken]);

  const allRequiredValid = useMemo(() => [0, 1, 2, 3, 4, 5].every((index) => stepIsValid(state, index)), [state]);

  function patch<K extends keyof JourneyState>(key: K, value: JourneyState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    setStatus("");
  }

  async function ensureSession(): Promise<DraftSession> {
    if (session) return session;
    if (!siteKey) throw new Error("The security check is not configured yet.");
    if (!turnstileToken) throw new Error("Complete the security check before saving.");
    const created = await createDraftSession(turnstileToken);
    setSession(created);
    history.replaceState({}, "", `/application/${created.id}#token=${encodeURIComponent(created.resumeToken)}`);
    return created;
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

  async function saveForLater() {
    const contactError = saveForLaterError(state);
    if (contactError) {
      setStatus("");
      setError(contactError);
      setStep(stepLabels.length - 1);
      return;
    }
    const activeSession = await persist("Draft saved");
    if (!activeSession) return;
    try {
      await uploadPendingFiles(activeSession);
      const receipt = await sendDraftResumeLink(activeSession);
      setSavedReceipt(receipt);
      setStatus("");
    } catch (reason) {
      setSavedReceipt({ resumeUrl: activeSession.resumeUrl, email: state.applicant.email, emailed: false });
      setStatus("Draft saved. The email could not be sent yet, so keep the link below.");
      setError(reason instanceof Error ? reason.message : "The resume email could not be sent.");
    }
  }

  function addFiles(selected: FileList | null) {
    if (!selected?.length) return;
    const available = 5 - files.length - pendingFiles.length;
    const nextFiles = Array.from(selected).slice(0, available);
    setPendingFiles((current) => [...current, ...nextFiles]);
    setStatus(`${nextFiles.length} file${nextFiles.length === 1 ? " is" : "s are"} ready to upload`);
  }

  async function uploadPendingFiles(activeSession: DraftSession) {
    if (!pendingFiles.length) return;
    const uploaded: UploadedFile[] = [];
    for (const file of pendingFiles) uploaded.push(await uploadApplicationFile(activeSession, file));
    setFiles((current) => [...current, ...uploaded]);
    setPendingFiles([]);
  }

  async function submit() {
    if (!allRequiredValid || !state.acknowledgement) { setError("Complete the required information and confirm the application."); return; }
    setBusy(true); setError("");
    try {
      const activeSession = await ensureSession();
      await saveDraft(activeSession, state);
      await uploadPendingFiles(activeSession);
      setSubmitted(await submitApplication(activeSession, state));
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
    return <><h3>Tell us about the project</h3><JobAddressField value={project.address} googleReady={googleMapsReady && !googleMapsFailed} googleEnabled={Boolean(googleMapsApiKey) && !googleMapsFailed} onChange={({ address, city, postalCode }) => update({ address, city, postalCode })} /><div className="field-grid project-fields"><Field label="Building Consent number (BC)" value={project.buildingConsentNumber} onChange={(buildingConsentNumber) => update({ buildingConsentNumber })} placeholder="If available" /><Field label="Resource Consent number (RC)" value={project.resourceConsentNumber} onChange={(resourceConsentNumber) => update({ resourceConsentNumber })} placeholder="If applicable" />
      <label className="field"><span>Estimated installation date</span><select value={project.estimatedInstallation} onChange={(event) => update({ estimatedInstallation: event.target.value as JourneyState["project"]["estimatedInstallation"] })}><option value="not_sure">Not sure</option><option value="asap">ASAP</option><option value="3_months">Within 3 months</option><option value="6_months">Within 6 months</option><option value="1_year">Within 1 year</option><option value="2_years">Within 2 years</option></select></label>
      <label className="field"><span>What stage is the project at? <small>Optional</small></span><select value={project.stage} onChange={(event) => update({ stage: event.target.value as JourneyState["project"]["stage"] })}><option value="">Select if known</option><option value="concept">Concept / Early Design</option><option value="developed">Developed Design</option><option value="preparing_consent">Preparing Building Consent</option><option value="consent_lodged">Building Consent lodged</option><option value="council_rfi">Council RFI received</option><option value="consent_approved">Building Consent approved</option><option value="construction">Construction underway</option><option value="existing">Existing building / alteration</option><option value="other">Other</option></select></label></div></>;
  }

  function designStep() {
    return <><h3>Is this a glass balustrade or pool fence?</h3><div className="image-grid"><Choice selected={state.design.family === "balustrade"} title="Glass balustrade" description="Decks, balconies, stairs, landings and other barriers." image="/assets/fix-spigots.jpg" onClick={() => patch("design", { family: "balustrade", system: "" })} /><Choice selected={state.design.family === "pool"} title="Pool fence" description="Glass fencing around a swimming pool." image="/assets/use-pool.jpg" onClick={() => patch("design", { family: "pool", system: "" })} /><Choice selected={state.design.family === "not_sure"} title="Not sure" description="Royal Glass can identify the right project type." onClick={() => patch("design", { family: "not_sure", system: "not-sure" })} /></div><label className="field full"><span>Royal Glass system *</span><select value={state.design.system} onChange={(event) => patch("design", { ...state.design, system: event.target.value })}><option value="">Select a system</option>{systems.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><SystemReferenceCard system={state.design.system} />{state.design.system === "not-sure" ? <div className="notice">No problem. Add a photo, drawing, sketch or inspiration image in the documents section if you have one.</div> : null}</>;
  }

  function siteStep() {
    const substrates = [["timber", "Timber", "substrate-timber.jpg"], ["concrete", "Concrete", "substrate-concrete.jpg"], ["steel", "Steel", "substrate-steel.jpg"], ["tile-concrete", "Tile over concrete", "substrate-tile.jpg"], ["not_sure", "Not sure", "not-sure.jpg"]] as const;
    function updateLocation(index: number, value: Partial<JourneyState["site"]["locations"][number]>) {
      const locations = state.site.locations.map((location, current) => current === index ? { ...location, ...value } : location);
      patch("site", { ...state.site, locations });
    }
    function toggleLocation(index: number, type: string) {
      const location = state.site.locations[index];
      if (type === "pool-area" && !location.types.includes(type)) { patch("site", { ...state.site, locations: [{ ...location, types: [type], other: "" }] }); return; }
      const types = nextLocationTypes(location.types, type);
      updateLocation(index, { types, other: types.includes("other") ? location.other : "" });
    }
    return <><h3>What will the glass system be fixed to?</h3><div className="image-grid four">{substrates.map(([value, title, image]) => <Choice key={value} selected={state.site.substrate === value} title={title} image={`/assets/${image}`} onClick={() => patch("site", { ...state.site, substrate: value })} />)}</div><div className="section-head"><div><h3>Locations <small>Optional</small></h3><p>Add up to three areas if you know them. Pool area must be the only area.</p></div><button type="button" className="button secondary" disabled={state.site.locations.length >= 3 || state.site.locations.some((location) => location.types.includes("pool-area"))} onClick={() => patch("site", { ...state.site, locations: [...state.site.locations, { types: [], environment: "", other: "" }] })}>Add location</button></div>
      <div className="areas">{state.site.locations.map((location, index) => <fieldset key={index} className="area"><legend>Area {index + 1}</legend>{state.site.locations.length > 1 ? <button type="button" className="text-button" onClick={() => patch("site", { ...state.site, locations: state.site.locations.filter((_, current) => current !== index) })}>Remove</button> : null}<LocationAreaFields index={index} location={location} onChange={(value) => updateLocation(index, value)} onToggle={(type) => toggleLocation(index, type)} /></fieldset>)}</div></>;
  }

  function documentsStep() {
    const fileCount = files.length + pendingFiles.length;
    return <><p className="section-intro">Add anything you already have. This section is optional.</p><label className={`upload-zone ${fileCount >= 5 ? "disabled" : ""}`}><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg" disabled={busy || fileCount >= 5} onChange={(event) => addFiles(event.target.files)} /><strong>{fileCount >= 5 ? "Maximum of 5 files reached" : "Select drawings, documents or photos"}</strong><span>PDF, JPG, PNG or DWG · up to 10 MB each</span></label><div className="file-list">{files.map((file) => <div key={file.id}><span><strong>{file.name}</strong><small>{Math.ceil(file.sizeBytes / 1024)} KB</small></span><b>Uploaded</b></div>)}{pendingFiles.map((file) => <div key={`${file.name}-${file.lastModified}`}><span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></span><b>Ready</b></div>)}</div><div className="notice">Don’t have everything yet? Continue without uploading. Royal Glass will contact you if anything else is needed.</div></>;
  }

  function applicantStep() {
    return <><h3>Your contact details</h3><p className="section-intro">We need these details so our team can review the project and contact you.</p><div className="field-grid"><Field label="Full name" value={state.applicant.name} required autoComplete="name" onChange={(name) => patch("applicant", { ...state.applicant, name })} /><Field label="Mobile" type="tel" value={state.applicant.mobile} required autoComplete="tel" onChange={(mobile) => patch("applicant", { ...state.applicant, mobile })} /><Field label="Email" type="email" value={state.applicant.email} required autoComplete="email" onChange={(email) => patch("applicant", { ...state.applicant, email })} /></div>
      <h3>Your role in this project <small>Optional</small></h3><div className="compact-grid">{(["architect", "builder", "developer", "homeowner", "other"] as const).map((role) => <Choice key={role} selected={state.applicant.role === role} title={({ architect: "Architect / Designer", builder: "Builder", developer: "Developer", homeowner: "Homeowner", other: "Other" })[role]} onClick={() => patch("applicant", { ...state.applicant, role })} />)}</div>
      {!session ? <div className="security-box"><strong>Security check</strong><p>Complete this quick check before submitting. It protects the form from automated spam.</p>{turnstileToken ? <p className="security-complete"><CheckIcon /> Security check complete</p> : siteKey ? <div ref={turnstileContainer} /> : <p className="error-text">Security check configuration is required before this form can submit.</p>}</div> : null}
      <label className="confirm"><input type="checkbox" checked={state.acknowledgement} onChange={(event) => patch("acknowledgement", event.target.checked)} /><span>I confirm the information is accurate to the best of my knowledge and may be submitted to Royal Glass for review.</span></label><div className="notice amber"><strong>What happens next</strong><p>Royal Glass reviews the project information and contacts you if anything else is needed. Submission does not automatically confirm that a PS1 will be issued.</p></div></>;
  }

  const content = [needStep, projectStep, designStep, siteStep, documentsStep, applicantStep][step]();
  const saveState = status || (session ? "Draft active" : "Not saved yet");

  if (submitted) return (
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
            <p>We have emailed a copy to you and sent the application to our team for review.</p>
          </div>
        </header>
        <main className="success-card">
          <p className="success-label">Application received</p>
          <div className="reference-panel"><span>Application reference</span><strong>{submitted.reference}</strong></div>
        </main>
      </div>
    </div>
  );

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
            {savedReceipt ? <DraftSavedNotice {...savedReceipt} /> : null}
            <div className="form-actions">
              <button type="button" className="button secondary" disabled={step === 0 || busy} onClick={() => setStep((current) => current - 1)}>Back</button>
              <button type="button" className="button ghost" disabled={busy} onClick={() => void saveForLater()}>{busy ? "Saving…" : "Save for later"}</button>
              {step < stepLabels.length - 1 ? <button type="button" className="button primary" disabled={busy || !stepIsValid(state, step)} onClick={() => void continueForward()}>{busy ? "Saving…" : "Continue"}</button> : <button type="button" className="button primary" disabled={busy || !allRequiredValid || !state.acknowledgement} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit application"}</button>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
