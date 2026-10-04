"use client";

import Script from "next/script";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createDraftSession,
  initialJourneyState,
  loadDraft,
  saveDraft,
  submitApplication,
  uploadApplicationFile,
  type DraftSession,
  type JourneyState,
  type UploadedFile,
} from "@/modules/applications/public-journey";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

const stepLabels = [
  "Applicant",
  "Project & consent",
  "Design",
  "Site conditions",
  "Documents & images",
  "Review & submit",
];

const systems = [
  ["double-disc", "Double Disc"], ["hidden", "Hidden Face"], ["jh-clamp", "JH Clamp"],
  ["juralco-canopy", "Juralco Canopy"], ["lugano", "Lugano"], ["mini-post", "Mini Post"],
  ["mp-sp14", "Mini Post SP14"], ["side-channel", "Side Mount Channel"],
  ["top-channel", "Top Mount Channel"], ["unex-ascot", "Unex Ascot"],
  ["unex-metropolis", "Unex Metropolis"], ["viking-aluminium", "Viking Aluminium"],
  ["viking-glass", "Viking Glass"], ["vista", "Vista"], ["not-sure", "Not sure"],
] as const;

const locationOptions = [
  ["deck", "Deck"], ["balcony", "Balcony"], ["stair", "Stair"], ["landing", "Landing"],
  ["juliet-window", "Juliet window"], ["entrance-facade", "Entrance facade"],
  ["pool-area", "Pool area"], ["other", "Other"],
] as const;

function cloneInitialState(): JourneyState {
  return structuredClone(initialJourneyState);
}

function stepIsValid(state: JourneyState, step: number): boolean {
  if (step === 0) return Boolean(state.applicant.name.trim() && state.applicant.mobile.trim() && /^\S+@\S+\.\S+$/.test(state.applicant.email));
  if (step === 1) return Boolean(state.project.address.trim() && state.project.stage);
  if (step === 2) return Boolean(state.design.system);
  if (step === 3) return state.site.locations.length > 0 && state.site.locations.every((location) =>
    location.types.length > 0 && location.environment && (!location.types.includes("other") || location.other.trim()),
  );
  return true;
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "" }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return <label className="field"><span>{label}{required ? " *" : ""}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} /></label>;
}

function Choice({ selected, title, description, onClick, image }: { selected: boolean; title: string; description?: string; onClick: () => void; image?: string }) {
  return <button type="button" className={`choice ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}>
    {image ? <Image src={image} alt="" width={520} height={320} /> : null}<span><strong>{title}{selected ? <b aria-hidden="true">✓</b> : null}</strong>{description ? <small>{description}</small> : null}</span>
  </button>;
}

export function ApplicationForm({ siteKey, draftId }: { siteKey: string; draftId?: string }) {
  const [state, setState] = useState<JourneyState>(cloneInitialState);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [session, setSession] = useState<DraftSession | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
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
    if (!turnstileReady || !siteKey || session || widgetId.current || !turnstileContainer.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(turnstileContainer.current, {
      sitekey: siteKey,
      theme: "light",
      callback: (token: string) => { setTurnstileToken(token); setError(""); },
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setError("The security check could not load. Refresh the page and try again."),
    });
  }, [turnstileReady, siteKey, session]);

  const allRequiredValid = useMemo(() => [0, 1, 2, 3].every((index) => stepIsValid(state, index)), [state]);

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
    const saved = await persist("Draft saved");
    if (!saved) return;
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
    setFurthestStep((current) => Math.max(current, step + 1));
  }

  async function addFiles(selected: FileList | null) {
    if (!selected?.length) return;
    const activeSession = await persist("Draft saved before upload");
    if (!activeSession) return;
    setBusy(true); setError("");
    try {
      const available = 5 - files.length;
      const nextFiles = Array.from(selected).slice(0, available);
      const uploaded: UploadedFile[] = [];
      for (const file of nextFiles) uploaded.push(await uploadApplicationFile(activeSession, file));
      setFiles((current) => [...current, ...uploaded]);
      setStatus(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The files could not be uploaded."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!allRequiredValid || !state.acknowledgement) { setError("Complete the required information and confirm the application."); return; }
    setBusy(true); setError("");
    try {
      const activeSession = await ensureSession();
      await saveDraft(activeSession, state);
      setSubmitted(await submitApplication(activeSession, state));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The application could not be submitted."); }
    finally { setBusy(false); }
  }

  function applicantStep() {
    const needs = [
      ["ps1", "I need a PS1", "I am preparing or responding to a Building Consent application."],
      ["quote", "I need a quotation first", "I want pricing before deciding whether to proceed with a PS1."],
      ["unsure", "I’m not sure whether I need a PS1", "Royal Glass can review the project and advise the appropriate next step."],
    ] as const;
    return <><h3>What do you need?</h3><div className="choice-stack">{needs.map(([value, title, description]) => <Choice key={value} selected={state.need === value} title={title} description={description} onClick={() => patch("need", value)} />)}</div>
      <h3>Applicant details</h3><div className="field-grid"><Field label="Full name" value={state.applicant.name} required onChange={(name) => patch("applicant", { ...state.applicant, name })} /><Field label="Mobile" type="tel" value={state.applicant.mobile} required onChange={(mobile) => patch("applicant", { ...state.applicant, mobile })} /><Field label="Email" type="email" value={state.applicant.email} required onChange={(email) => patch("applicant", { ...state.applicant, email })} /></div>
      <h3>Your role in this project</h3><div className="compact-grid">{(["architect", "builder", "developer", "homeowner", "other"] as const).map((role) => <Choice key={role} selected={state.applicant.role === role} title={({ architect: "Architect / Designer", builder: "Builder", developer: "Developer", homeowner: "Homeowner", other: "Other" })[role]} onClick={() => patch("applicant", { ...state.applicant, role })} />)}</div>
      {!session ? <div className="security-box"><strong>Secure save</strong><p>Complete this quick check once. It protects the application form from automated spam.</p>{siteKey ? <div ref={turnstileContainer} /> : <p className="error-text">Security check configuration is required before this form can save.</p>}</div> : null}</>;
  }

  function projectStep() {
    const project = state.project;
    const update = (value: Partial<JourneyState["project"]>) => patch("project", { ...project, ...value });
    return <div className="field-grid"><Field label="Project address" required value={project.address} onChange={(address) => update({ address })} placeholder="Street address" /><Field label="City" value={project.city} onChange={(city) => update({ city })} /><Field label="Postal code" value={project.postalCode} onChange={(postalCode) => update({ postalCode })} /><Field label="Building Consent number" value={project.buildingConsentNumber} onChange={(buildingConsentNumber) => update({ buildingConsentNumber })} placeholder="If available" /><Field label="Resource Consent number" value={project.resourceConsentNumber} onChange={(resourceConsentNumber) => update({ resourceConsentNumber })} placeholder="If applicable" />
      <label className="field"><span>Estimated installation date</span><select value={project.estimatedInstallation} onChange={(event) => update({ estimatedInstallation: event.target.value as JourneyState["project"]["estimatedInstallation"] })}><option value="asap">ASAP</option><option value="3_months">3 months</option><option value="6_months">6 months</option><option value="1_year">1 year</option><option value="2_years">2 years</option></select></label>
      <label className="field full"><span>What stage is the project at? *</span><select value={project.stage} onChange={(event) => update({ stage: event.target.value as JourneyState["project"]["stage"] })}><option value="concept">Concept / Early Design</option><option value="developed">Developed Design</option><option value="preparing_consent">Preparing Building Consent</option><option value="consent_lodged">Building Consent lodged</option><option value="council_rfi">Council RFI received</option><option value="consent_approved">Building Consent approved</option><option value="construction">Construction underway</option><option value="existing">Existing building / alteration</option><option value="other">Other</option></select></label></div>;
  }

  function designStep() {
    return <><h3>What type of barrier is this?</h3><div className="image-grid"><Choice selected={state.design.family === "balustrade"} title="Glass balustrade" description="Decks, balconies, stairs, landings and other barriers." image="/assets/fix-spigots.jpg" onClick={() => patch("design", { family: "balustrade", system: "" })} /><Choice selected={state.design.family === "pool"} title="Pool barrier" description="Glass fencing around a swimming pool." image="/assets/use-pool.jpg" onClick={() => patch("design", { family: "pool", system: "" })} /></div><label className="field full"><span>Known Royal Glass system *</span><select value={state.design.system} onChange={(event) => patch("design", { ...state.design, system: event.target.value })}><option value="">Select a system</option>{systems.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{state.design.system === "not-sure" ? <div className="notice">No problem. Add a photo, drawing, sketch or inspiration image in the next documents step.</div> : null}</>;
  }

  function siteStep() {
    const substrates = [["timber", "Timber", "substrate-timber.jpg"], ["concrete", "Concrete", "substrate-concrete.jpg"], ["steel", "Steel", "substrate-steel.jpg"], ["tile-concrete", "Tile over concrete", "substrate-tile.jpg"]] as const;
    function updateLocation(index: number, value: Partial<JourneyState["site"]["locations"][number]>) {
      const locations = state.site.locations.map((location, current) => current === index ? { ...location, ...value } : location);
      patch("site", { ...state.site, locations });
    }
    function toggleLocation(index: number, type: string) {
      const location = state.site.locations[index];
      if (type === "pool-area" && !location.types.includes(type)) { patch("site", { ...state.site, locations: [{ ...location, types: [type], other: "" }] }); return; }
      const types = location.types.includes(type) ? location.types.filter((item) => item !== type) : [...location.types.filter((item) => item !== "pool-area"), type].slice(0, 3);
      updateLocation(index, { types, other: types.includes("other") ? location.other : "" });
    }
    return <><h3>What will the glass system be fixed to?</h3><div className="image-grid four">{substrates.map(([value, title, image]) => <Choice key={value} selected={state.site.substrate === value} title={title} image={`/assets/${image}`} onClick={() => patch("site", { ...state.site, substrate: value })} />)}</div><div className="section-head"><div><h3>Locations</h3><p>Add up to three areas. Pool area must be the only area.</p></div><button type="button" className="button secondary" disabled={state.site.locations.length >= 3 || state.site.locations.some((location) => location.types.includes("pool-area"))} onClick={() => patch("site", { ...state.site, locations: [...state.site.locations, { types: [], environment: "", other: "" }] })}>Add area</button></div>
      <div className="areas">{state.site.locations.map((location, index) => <fieldset key={index} className="area"><legend>Area {index + 1}</legend>{state.site.locations.length > 1 ? <button type="button" className="text-button" onClick={() => patch("site", { ...state.site, locations: state.site.locations.filter((_, current) => current !== index) })}>Remove</button> : null}<div className="check-grid">{locationOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={location.types.includes(value)} onChange={() => toggleLocation(index, value)} /><span>{label}</span></label>)}</div>{location.types.includes("other") ? <Field label="Describe other location" required value={location.other} onChange={(other) => updateLocation(index, { other })} /> : null}<div className="radio-row"><span>Is this area internal or external? *</span><label><input type="radio" name={`environment-${index}`} checked={location.environment === "internal"} onChange={() => updateLocation(index, { environment: "internal" })} /> Internal</label><label><input type="radio" name={`environment-${index}`} checked={location.environment === "external"} onChange={() => updateLocation(index, { environment: "external" })} /> External</label></div></fieldset>)}</div></>;
  }

  function documentsStep() {
    return <><label className={`upload-zone ${files.length >= 5 ? "disabled" : ""}`}><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg" disabled={busy || files.length >= 5} onChange={(event) => void addFiles(event.target.files)} /><strong>{files.length >= 5 ? "Maximum of 5 files reached" : "Select drawings, documents or photos"}</strong><span>PDF, JPG, PNG or DWG · up to 10 MB each</span></label><div className="file-list">{files.map((file) => <div key={file.id}><span><strong>{file.name}</strong><small>{Math.ceil(file.sizeBytes / 1024)} KB</small></span><b>Uploaded ✓</b></div>)}</div><div className="notice">Don’t have everything yet? Submit what you have. Royal Glass will review it and send a More Information Request if anything else is needed.</div></>;
  }

  function reviewStep() {
    const system = systems.find(([value]) => value === state.design.system)?.[1] ?? "Not selected";
    const rows = [["Applicant", state.applicant.name], ["Project address", state.project.address], ["System", system], ["Fixing substrate", state.site.substrate.replace("tile-concrete", "Tile over concrete")], ["Areas", `${state.site.locations.length}`], ["Files", `${files.length} uploaded`]];
    return <><div className="summary">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><label className="confirm"><input type="checkbox" checked={state.acknowledgement} onChange={(event) => patch("acknowledgement", event.target.checked)} /><span>I confirm the information is accurate to the best of my knowledge and may be submitted to Royal Glass for review.</span></label><div className="notice amber"><strong>What happens next</strong><p>Royal Glass reviews the system, drawings and design conditions. Submitting this application does not automatically confirm that a PS1 will be issued.</p></div></>;
  }

  const content = [applicantStep, projectStep, designStep, siteStep, documentsStep, reviewStep][step]();
  const saveState = status || (session ? "Draft active" : "Not saved yet");

  if (submitted) return (
    <div className="rg-ps1">
      <div className="portal-shell">
        <header className="portal-masthead success-masthead">
          <div className="masthead-shade" />
          <div className="masthead-content">
            <Image className="brand-logo" src="/assets/brand/royal-glass-logo-white.png" alt="Royal Glass" width={150} height={72} priority />
            <div className="success-heading">
              <span className="success-icon" aria-hidden="true">✓</span>
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
        <header className="portal-masthead">
          <div className="masthead-shade" />
          <div className="masthead-content">
            <div className="masthead-meta">
              <Image className="brand-logo" src="/assets/brand/royal-glass-logo-white.png" alt="Royal Glass" width={150} height={72} priority />
              <p>Secure application <span aria-hidden="true">·</span> {saveState}</p>
            </div>
            <h1>Request a PS1</h1>
            <p className="masthead-intro">Tell us about your project and upload what you already have. Our team will review the information before a PS1 is prepared.</p>
            <div className="hero-progress" aria-label={`Step ${step + 1} of ${stepLabels.length}: ${stepLabels[step]}`}>
              <div><span>Step {step + 1} of {stepLabels.length}</span><strong>{stepLabels[step]}</strong></div>
              <div className="hero-progress-track" aria-hidden="true"><span style={{ width: `${((step + 1) / stepLabels.length) * 100}%` }} /></div>
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
                return <button type="button" key={label} disabled={!available} className={`${index === step ? "active" : ""} ${complete ? "complete" : ""}`} onClick={() => setStep(index)}><span>{complete ? "✓" : index + 1}</span>{label}</button>;
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
              <button type="button" className="button ghost" disabled={busy} onClick={() => void persist("Draft saved. Keep this page link to return later.")}>{busy ? "Saving…" : "Save for later"}</button>
              {step < stepLabels.length - 1 ? <button type="button" className="button primary" disabled={busy || !stepIsValid(state, step)} onClick={() => void continueForward()}>{busy ? "Saving…" : "Continue"}</button> : <button type="button" className="button primary" disabled={busy || !allRequiredValid || !state.acknowledgement} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit application"}</button>}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
