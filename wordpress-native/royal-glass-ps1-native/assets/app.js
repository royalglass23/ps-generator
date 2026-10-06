import {
  applicantDetailsError,
  buildDraftPayload,
  buildSubmissionPayload,
  initialJourneyState,
  nextLocationTypes,
  stateFromDraft,
  validateInput,
  validateUpload,
} from "./domain.mjs";

const config = window.RoyalGlassPS1 ?? {};
const steps = ["What you need", "Project details", "Design", "Site conditions", "Documents & images", "Applicant details"];
const systems = [
  ["double-disc", "Double Disc"], ["hidden", "Hidden Face"], ["jh-clamp", "JH Clamp"],
  ["juralco-canopy", "Juralco EDGE Canopy"], ["lugano", "Lugano"], ["mini-post", "Mini Post"],
  ["mp-sp14", "Mini Post SP14"], ["side-channel", "Side Mount Channel"], ["top-channel", "Top Mount Channel"],
  ["unex-ascot", "Unex Ascot"], ["unex-metropolis", "Unex Metropolis"], ["viking-aluminium", "Viking Aluminium"],
  ["viking-glass", "Viking Glass"], ["vista", "Vista"], ["not-sure", "Not sure"],
];
const systemsByFamily = {
  balustrade: ["double-disc", "hidden", "jh-clamp", "lugano", "mini-post", "mp-sp14", "side-channel", "top-channel", "unex-metropolis", "viking-glass", "vista"],
  pool: ["double-disc", "hidden", "jh-clamp", "lugano", "mini-post", "mp-sp14", "side-channel", "top-channel", "unex-ascot", "unex-metropolis", "viking-aluminium", "viking-glass", "vista"],
  aluminium: ["unex-ascot", "viking-aluminium"],
  canopy: ["juralco-canopy"],
};
const familyImages = {
  balustrade: "systems/ai/double-disc-balustrade-v1.png",
  pool: "systems/ai/double-disc-pool-v1.png",
  aluminium: "systems/ai/viking-aluminium-balustrade-v1.png",
  canopy: "systems/ai/juralco-canopy-commercial-v1.png",
  not_sure: "systems/ai/not-sure-balustrade-v1.png",
};
const systemImages = {
  "double-disc": "double-disc", hidden: "hidden-face", "jh-clamp": "jh-clamp", lugano: "lugano",
  "mini-post": "mini-post", "mp-sp14": "mini-post-sp14", "side-channel": "side-mount-channel",
  "top-channel": "top-mount-channel", "unex-ascot": "unex-ascot", "unex-metropolis": "unex-metropolis",
  "viking-aluminium": "viking-aluminium", "viking-glass": "viking-glass", vista: "vista",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]);
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function field(path, label, value, validation, options = {}) {
  const { type = "text", required = false, placeholder = "", maxLength = "", inputMode = "" } = options;
  return `<label class="field"><span>${escapeHtml(label)}${required ? " *" : ""}</span><input data-field="${path}" data-validation="${validation}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${maxLength ? ` maxlength="${maxLength}"` : ""}${inputMode ? ` inputmode="${inputMode}"` : ""}${required ? " required" : ""}><small class="field-warning" data-error-for="${path}" hidden></small></label>`;
}

function choice(path, value, title, description, selected, image = "") {
  return `<button type="button" class="choice-card${selected ? " selected" : ""}" data-choice-path="${path}" data-choice-value="${escapeHtml(value)}">${image ? `<img src="${escapeHtml(config.assetUrl + image)}" alt="">` : ""}<span><strong>${escapeHtml(title)}</strong>${description ? `<small>${escapeHtml(description)}</small>` : ""}</span></button>`;
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split(".");
  let target = object;
  for (const part of parts.slice(0, -1)) target = target[part];
  target[parts.at(-1)] = value;
}

class Ps1Application {
  constructor(root) {
    this.root = root;
    this.state = structuredClone(initialJourneyState);
    this.step = 0;
    this.furthestStep = 0;
    this.session = null;
    this.uploads = [];
    this.busy = false;
    this.error = "";
    this.status = "";
    this.submitted = null;
    this.turnstileToken = "";
    this.turnstileWidget = null;
	this.turnstileFailed = false;
	this.restoreFailed = false;
    this.render();
    this.bind();
	this.restore();
  }

  bind() {
    this.root.addEventListener("click", (event) => this.click(event));
    this.root.addEventListener("input", (event) => this.input(event));
    this.root.addEventListener("change", (event) => this.change(event));
    this.root.addEventListener("focusout", (event) => this.validateField(event), true);
  }

  async api(path, options = {}) {
    const response = await fetch(`${String(config.restUrl).replace(/\/$/, "")}${path}`, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || this.friendlyError(body.code));
    return body;
  }

  friendlyError(code) {
    return ({
      ABUSE_CHECK_FAILED: "Complete the security check and try again.",
      VALIDATION_FAILED: "Check the information and try again.",
      APPLICATION_NOT_AVAILABLE: "This application link is no longer available.",
      UPLOAD_TOO_LARGE: "This file is too large. The maximum file size is 10 MB.",
      UNSUPPORTED_UPLOAD_TYPE: "Use a PDF, JPG, PNG or DWG file.",
      RATE_LIMITED: "Too many attempts were made. Wait a little and try again.",
    })[code] || "Something went wrong. Your information is still on this page; try again.";
  }

  headers(json = false) {
    const headers = this.session ? { Authorization: `Bearer ${this.session.resumeToken}` } : {};
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async restore() {
    if (!config.draftId) return;
    const hashToken = new URLSearchParams(location.hash.replace(/^#/, "")).get("token");
    const storedToken = sessionStorage.getItem(`rg_ps1_resume_${config.draftId}`);
    const token = hashToken || storedToken;
    this.busy = true;
    this.render();
	try {
	  if (!token) throw new Error("This resume link is incomplete. Open the full link from your saved copy.");
	  sessionStorage.setItem(`rg_ps1_resume_${config.draftId}`, token);
	  if (hashToken) history.replaceState({}, "", `${location.pathname}${location.search}`);
	  const result = await this.api(`/applications/drafts/${encodeURIComponent(config.draftId)}`, { headers: { Authorization: `Bearer ${token}` } });
	  this.session = { id: config.draftId, resumeToken: token, expiresAt: result.expiresAt };
	  this.state = stateFromDraft(result.payload);
	  this.uploads = Array.isArray(result.uploads) ? result.uploads : [];
	  this.status = "Saved application restored";
	} catch (error) {
	  this.restoreFailed = true;
	  this.error = error.message;
	} finally {
	  this.busy = false;
	  this.render();
	}
  }

  async ensureSession() {
    if (this.session) return this.session;
    if (!config.turnstileSiteKey) throw new Error("The security check is not configured yet.");
    if (!this.turnstileToken) throw new Error("Complete the security check before saving.");
	let created;
	try {
	  created = await this.api("/applications/drafts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ turnstileToken: this.turnstileToken }),
	  });
	} catch (error) {
	  this.turnstileToken = "";
	  this.turnstileFailed = false;
	  this.removeTurnstile();
	  throw error;
	}
    this.session = created;
	this.turnstileToken = "";
    sessionStorage.setItem(`rg_ps1_resume_${created.id}`, created.resumeToken);
    const url = new URL(location.href);
    url.searchParams.set("application", created.id);
    url.hash = "";
    history.replaceState({}, "", url);
    return created;
  }

  async persist(message = "Draft saved") {
    const session = await this.ensureSession();
    await this.api(`/applications/drafts/${session.id}`, {
      method: "PUT",
      headers: this.headers(true),
      body: JSON.stringify(buildDraftPayload(this.state)),
    });
    this.status = message;
  }

  stepValid(step = this.step) {
    if (step === 0) return Boolean(this.state.need);
    if (step === 1) return !validateInput("address", this.state.project.address)
      && !validateInput("buildingConsentNumber", this.state.project.buildingConsentNumber)
      && !validateInput("resourceConsentNumber", this.state.project.resourceConsentNumber);
    if (step === 2) return Boolean(this.state.design.family && this.state.design.system);
    if (step === 3) return Boolean(this.state.site.substrate) && this.state.site.locations.every((location) => location.types.length > 0 && location.environment && (!location.types.includes("other") || !validateInput("otherLocation", location.other)));
    if (step === 5) return !applicantDetailsError(this.state) && Boolean(this.state.applicant.role);
    return true;
  }

  allValid() {
    return steps.every((_, index) => this.stepValid(index));
  }

  async click(event) {
    const button = event.target.closest("button");
    if (!button || this.busy) return;
    const choicePath = button.dataset.choicePath;
    if (choicePath) {
      let value = button.dataset.choiceValue;
      if (choicePath === "design.family") {
        this.state.design = { family: value, system: value === "canopy" ? "juralco-canopy" : value === "not_sure" ? "not-sure" : "" };
      } else if (choicePath === "site.substrate") {
        this.state.site.substrate = value;
      } else {
        setPath(this.state, choicePath, value);
      }
      this.status = "";
      this.render();
      return;
    }
    const action = button.dataset.action;
    if (action === "back") { this.step = Math.max(0, this.step - 1); this.error = ""; this.render(); }
    if (action === "goto") { this.step = Number(button.dataset.step); this.error = ""; this.render(); }
    if (action === "continue") await this.continue();
    if (action === "submit") await this.submit();
    if (action === "add-location") { this.state.site.locations.push({ types: [], environment: "", other: "" }); this.render(); }
    if (action === "remove-location") { this.state.site.locations.splice(Number(button.dataset.index), 1); this.render(); }
    if (action === "toggle-location") {
      const index = Number(button.dataset.index);
      const type = button.dataset.value;
      const next = nextLocationTypes(this.state.site.locations[index].types, type);
      this.state.site.locations[index].types = next;
      if (!next.includes("other")) this.state.site.locations[index].other = "";
      if (type === "pool-area" && next.includes(type)) this.state.site.locations = [{ ...this.state.site.locations[index], types: [type], other: "" }];
      this.render();
    }
    if (action === "remove-upload") await this.removeUpload(button.dataset.id);
	if (action === "retry-turnstile") { this.turnstileFailed = false; this.error = ""; this.render(); }
	if (action === "save-later") await this.saveForLater();
	if (action === "restart") this.restart();
  }

  input(event) {
    const input = event.target.closest("[data-field]");
    if (!input) return;
    setPath(this.state, input.dataset.field, input.type === "checkbox" ? input.checked : input.value);
    this.status = "";
	this.refreshActionState();
  }

  refreshActionState() {
	const continueButton = this.root.querySelector('[data-action="continue"]');
	if (continueButton) continueButton.disabled = this.busy || !this.stepValid();
	const submitButton = this.root.querySelector('[data-action="submit"]');
	if (submitButton) submitButton.disabled = this.busy || !this.allValid() || !this.state.acknowledgement;
	const saveButton = this.root.querySelector('[data-action="save-later"]');
	if (saveButton) saveButton.disabled = this.busy || !this.canEmailResume();
  }

  change(event) {
    const input = event.target;
    if (input.matches('[data-action="files"]')) this.addFiles(input.files);
    if (input.matches('[data-field="applicant.role"]')) {
	  if (!["architect", "builder"].includes(input.value)) {
		this.state.applicant.decisionMaker = { name: "", mobile: "", email: "" };
	  }
	  this.render();
	}
  }

  validateField(event) {
    const input = event.target.closest("[data-validation]");
    if (!input) return;
    const error = validateInput(input.dataset.validation, input.value);
    const target = this.root.querySelector(`[data-error-for="${CSS.escape(input.dataset.field)}"]`);
    input.setAttribute("aria-invalid", error ? "true" : "false");
    if (target) { target.textContent = error || ""; target.hidden = !error; }
  }

  async continue() {
    if (!this.stepValid()) { this.error = "Complete the required information on this step."; this.render(); return; }
    this.busy = true; this.error = ""; this.render();
    try {
      if (this.session) await this.persist();
      this.step = Math.min(this.step + 1, steps.length - 1);
      this.furthestStep = Math.max(this.furthestStep, this.step);
    } catch (error) { this.error = error.message; }
    finally { this.busy = false; this.render(); }
  }

  async addFiles(fileList) {
    const files = [...(fileList || [])].slice(0, 5 - this.uploads.length);
    for (const file of files) {
      const error = validateUpload(file);
      if (error) { this.error = error; this.render(); continue; }
      const item = { id: crypto.randomUUID(), name: file.name, sizeBytes: file.size, status: "uploading", file };
      this.uploads.push(item);
      this.render();
      try {
        const session = await this.ensureSession();
        const data = new FormData();
        data.append("file", file, file.name);
        const uploaded = await this.api(`/applications/drafts/${session.id}/uploads`, { method: "POST", headers: this.headers(false), body: data });
        Object.assign(item, uploaded, { status: "uploaded", file: undefined });
      } catch (reason) { item.status = "failed"; this.error = reason.message; }
      this.render();
    }
  }

  async removeUpload(id) {
    const item = this.uploads.find((entry) => entry.id === id);
    if (!item) return;
    if (item.status !== "uploaded" || !this.session) { this.uploads = this.uploads.filter((entry) => entry !== item); this.render(); return; }
    item.status = "removing"; this.render();
    try {
      await this.api(`/applications/drafts/${this.session.id}/uploads/${item.id}`, { method: "DELETE", headers: this.headers(false) });
      this.uploads = this.uploads.filter((entry) => entry !== item);
    } catch (error) { item.status = "uploaded"; this.error = error.message; }
    this.render();
  }

  async submit() {
    if (!this.allValid() || !this.state.acknowledgement) { this.error = "Complete the required information and confirm the application."; this.render(); return; }
    if (this.uploads.some((item) => ["uploading", "removing"].includes(item.status))) { this.error = "Wait for all uploads to finish before submitting."; this.render(); return; }
    this.busy = true; this.error = ""; this.render();
    try {
      const session = await this.ensureSession();
      await this.persist();
      this.submitted = await this.api(`/applications/drafts/${session.id}/submit`, {
        method: "POST", headers: this.headers(true), body: JSON.stringify(buildSubmissionPayload(this.state)),
      });
      sessionStorage.removeItem(`rg_ps1_resume_${session.id}`);
      const url = new URL(location.href); url.searchParams.delete("application"); url.hash = ""; history.replaceState({}, "", url);
    } catch (error) { this.error = error.message; }
    finally { this.busy = false; this.render(); }
  }

  canEmailResume() {
	return !validateInput("name", this.state.applicant.name) && !validateInput("email", this.state.applicant.email);
  }

  async saveForLater() {
	if (!this.canEmailResume()) { this.error = "Enter your name and email address before saving for later."; this.render(); return; }
	this.busy = true; this.error = ""; this.status = ""; this.render();
	try {
	  const session = await this.ensureSession();
	  await this.persist();
	  const result = await this.api(`/applications/drafts/${session.id}/resume-link`, { method: "POST", headers: this.headers(true), body: "{}" });
	  this.status = `Return link queued for ${result.email}`;
	} catch (error) { this.error = error.message; }
	finally { this.busy = false; this.render(); }
  }

  restart() {
	if (config.draftId) sessionStorage.removeItem(`rg_ps1_resume_${config.draftId}`);
	const url = new URL(location.href); url.searchParams.delete("application"); url.hash = ""; history.replaceState({}, "", url);
	config.draftId = "";
	this.state = structuredClone(initialJourneyState); this.step = 0; this.furthestStep = 0; this.session = null; this.uploads = [];
	this.busy = false; this.error = ""; this.status = ""; this.restoreFailed = false; this.render();
  }

  renderStep() {
    if (this.step === 0) return `<h3>What do you need?</h3><div class="choice-stack">${[
      ["ps1", "I need a PS1", "I am preparing or responding to a Building Consent application."],
      ["quote", "I need a quotation first", "I want pricing before deciding whether to proceed with a PS1."],
      ["unsure", "I’m not sure whether I need a PS1", "Royal Glass can review the project and advise the appropriate next step."],
    ].map(([value, title, description]) => choice("need", value, title, description, this.state.need === value)).join("")}</div>`;

    if (this.step === 1) return `<h3>Tell us about the project</h3><div class="field-grid project-fields">
      ${field("project.address", "Job address", this.state.project.address, "address", { required: true, maxLength: 250, placeholder: "Street address" })}
      ${field("project.buildingConsentNumber", "Building Consent number (BC)", this.state.project.buildingConsentNumber, "buildingConsentNumber", { maxLength: 50, placeholder: "If available" })}
      ${field("project.resourceConsentNumber", "Resource Consent number (RC)", this.state.project.resourceConsentNumber, "resourceConsentNumber", { maxLength: 50, placeholder: "If applicable" })}
      <label class="field"><span>Estimated installation date</span><select data-field="project.estimatedInstallation">${[["not_sure","Not sure"],["asap","ASAP"],["3_months","Within 3 months"],["6_months","Within 6 months"],["1_year","Within 1 year"],["2_years","Within 2 years"]].map(([v,l])=>option(v,l,this.state.project.estimatedInstallation)).join("")}</select></label>
      <label class="field"><span>What stage is the project at? <small>Optional</small></span><select data-field="project.stage">${[["","Select if known"],["concept","Concept / Early Design"],["developed","Developed Design"],["preparing_consent","Preparing Building Consent"],["consent_lodged","Building Consent lodged"],["council_rfi","Council RFI received"],["consent_approved","Building Consent approved"],["construction","Construction underway"],["existing","Existing building / alteration"],["other","Other"]].map(([v,l])=>option(v,l,this.state.project.stage)).join("")}</select></label>
    </div>`;

    if (this.step === 2) {
      const families = [["balustrade","Glass balustrade","Decks, balconies, stairs, landings and other barriers."],["pool","Pool fence","Glass or aluminium fencing around a swimming pool."],["aluminium","Aluminium balustrade","Framed aluminium barriers for decks and balconies."],["canopy","Canopy","Juralco EDGE glass canopy."],["not_sure","Not sure","Royal Glass can identify the right project type."]];
      const available = systemsByFamily[this.state.design.family] || [];
      const selectedLabel = systems.find(([value]) => value === this.state.design.system)?.[1] || "";
      const imageStem = systemImages[this.state.design.system];
      const imageSuffix = this.state.design.family === "pool" ? "pool" : "balustrade";
	  const referencePath = this.state.design.system === "juralco-canopy" ? familyImages.canopy : this.state.design.system === "not-sure" ? familyImages.not_sure : imageStem ? `systems/ai/${imageStem}-${imageSuffix}-v1.png` : "";
      return `<h3>What type of system is this?</h3><p class="section-intro">Choose the closest application, then select the system name if you know it.</p><div class="design-family-grid">${families.map(([v,t,d])=>choice("design.family",v,t,d,this.state.design.family===v,familyImages[v])).join("")}</div>${available.length > 1 ? `<label class="field full system-select"><span>Royal Glass system *</span><select data-field="design.system">${option("","Select a system",this.state.design.system)}${available.map((value)=>option(value,systems.find(([id])=>id===value)?.[1]||value,this.state.design.system)).join("")}</select></label>` : ""}${referencePath ? `<div class="system-reference"><img src="${escapeHtml(config.assetUrl + referencePath)}" alt="${escapeHtml(selectedLabel || "Not sure")} reference"><strong>${escapeHtml(selectedLabel || "Not sure")}</strong><span>${this.state.design.system === "not-sure" ? "Royal Glass will help identify the right system" : "Reference image only"}</span></div>` : ""}`;
    }

    if (this.step === 3) {
      const substrates = [["timber","Timber","substrate-timber.jpg"],["concrete","Concrete","substrate-concrete.jpg"],["steel","Steel","substrate-steel.jpg"],["tile-concrete","Tile over concrete","substrate-tile.jpg"],["not_sure","Not Sure",""]];
      const locationOptions = [["deck","Deck"],["balcony","Balcony"],["stair","Stair"],["landing","Landing"],["juliet-window","Juliet window"],["entrance-facade","Entrance facade"],["pool-area","Pool area"],["other","Other"]];
      const areas = this.state.site.locations.map((location,index)=>`<fieldset class="area"><legend>Area ${index+1}</legend>${this.state.site.locations.length>1?`<button type="button" class="text-button" data-action="remove-location" data-index="${index}">Remove</button>`:""}<div class="location-options">${locationOptions.map(([value,label])=>`<button type="button" class="location-chip${location.types.includes(value)?" selected":""}" data-action="toggle-location" data-index="${index}" data-value="${value}">${label}</button>`).join("")}</div><label class="field"><span>Environment *</span><select data-field="site.locations.${index}.environment">${option("","Select",location.environment)}${option("internal","Internal",location.environment)}${option("external","External",location.environment)}</select></label>${location.types.includes("other")?field(`site.locations.${index}.other`,"Describe the other location",location.other,"otherLocation",{required:true,maxLength:200}):""}</fieldset>`).join("");
      return `<h3>What will the glass system be fixed to?</h3><div class="image-grid substrate-grid">${substrates.map(([v,t,img])=>choice("site.substrate",v,t,v==="not_sure"?"Don’t worry, our team will help you.":"",this.state.site.substrate===v,img)).join("")}</div><div class="section-head"><div><h3>Locations <small>Optional</small></h3><p>Add up to three areas if you know them. Pool area must be the only area.</p></div><button type="button" class="button secondary" data-action="add-location"${this.state.site.locations.length>=3||this.state.site.locations.some((l)=>l.types.includes("pool-area"))?" disabled":""}>Add location</button></div><div class="areas">${areas}</div>`;
    }

    if (this.step === 4) {
      const files = this.uploads.map((item)=>`<div><span><strong>${escapeHtml(item.name)}</strong><small>${Math.ceil(item.sizeBytes/1024)} KB</small></span><span class="file-actions"><b class="upload-status ${item.status}">${escapeHtml(item.status)}</b><button type="button" class="text-button" data-action="remove-upload" data-id="${item.id}">Remove</button></span></div>`).join("");
      return `<p class="section-intro">Add anything you already have. This section is optional.</p>${this.securityCheck()}${config.uploadsEnabled?`<label class="upload-zone${this.uploads.length>=5||(!this.session&&!this.turnstileToken)?" disabled":""}"><input type="file" data-action="files" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg"${this.uploads.length>=5||(!this.session&&!this.turnstileToken)?" disabled":""}><strong>${this.uploads.length>=5?"Maximum of 5 files reached":this.session||this.turnstileToken?"Select drawings, documents or photos":"Complete the security check to add files"}</strong><span>PDF, JPG, PNG or DWG · up to 10 MB each</span></label>`:`<div class="notice amber"><strong>Private uploads are not configured yet</strong><p>You can continue without documents. An administrator must configure private storage before publication.</p></div>`}<div class="file-list">${files}</div><div class="notice">Don’t have everything yet? Submit what you have. You can send additional drawings, photos, or details afterward using your application reference.</div>`;
    }

    const needsDecisionMaker = ["architect", "builder"].includes(this.state.applicant.role);
    return `<h3>Your contact details</h3><p class="section-intro">We need these details so our team can review the project and contact you.</p><div class="field-grid">${field("applicant.name","Full name",this.state.applicant.name,"name",{required:true,maxLength:100})}${field("applicant.mobile","NZ mobile or landline",this.state.applicant.mobile,"mobile",{type:"tel",required:true,maxLength:25,inputMode:"tel"})}${field("applicant.email","Email",this.state.applicant.email,"email",{type:"email",required:true,maxLength:320,inputMode:"email"})}<label class="field"><span>Role *</span><select data-field="applicant.role" required>${[["","Select your role"],["architect","Architect / Designer"],["builder","Builder"],["developer","Developer"],["homeowner","Homeowner"],["other","Other"]].map(([v,l])=>option(v,l,this.state.applicant.role)).join("")}</select></label></div>${needsDecisionMaker?`<fieldset class="area decision-maker-fields"><legend>Homeowner or decision-maker details</legend><div class="field-grid">${field("applicant.decisionMaker.name","Homeowner or decision-maker name",this.state.applicant.decisionMaker.name,"name",{required:true,maxLength:100})}${field("applicant.decisionMaker.mobile","Homeowner or decision-maker phone",this.state.applicant.decisionMaker.mobile,"mobile",{type:"tel",required:true,maxLength:25})}${field("applicant.decisionMaker.email","Homeowner or decision-maker email",this.state.applicant.decisionMaker.email,"email",{type:"email",required:true,maxLength:320})}</div></fieldset>`:""}${this.securityCheck()}<label class="confirm"><input type="checkbox" data-field="acknowledgement"${this.state.acknowledgement?" checked":""}><span>I confirm the information is accurate to the best of my knowledge and may be submitted to Royal Glass for review.</span></label><div class="notice amber"><strong>What happens next</strong><p>Royal Glass reviews the project information and contacts you if anything else is needed. Submission does not automatically confirm that a PS1 will be issued.</p></div>`;
  }

  securityCheck() {
    if (this.session) return "";
    if (this.turnstileToken) return '<div class="security-box security-complete"><strong>✓ Security check complete</strong></div>';
    if (!config.turnstileSiteKey) return '<div class="security-box"><strong>Security check</strong><p class="error-text">Security check configuration is required before this form can submit.</p></div>';
	if (this.turnstileFailed) return '<div class="security-box"><strong>Security check unavailable</strong><p class="error-text">The security check could not load.</p><button type="button" class="button secondary" data-action="retry-turnstile">Try again</button></div>';
    return '<div class="security-box"><strong>Security check</strong><p>Complete this quick check before saving or uploading.</p><div data-turnstile></div></div>';
  }

  render() {
    if (this.submitted) {
      this.root.innerHTML = `<div class="rg-ps1"><div class="portal-shell"><header class="portal-masthead success-masthead"><div class="masthead-shade"></div><div class="masthead-content"><img class="brand-logo" src="${escapeHtml(config.assetUrl + "brand/royal-glass-logo-white.png")}" alt="Royal Glass"><h1>Application received</h1><p>Thank you. Your project information has been sent to Royal Glass for review.</p></div></header><main class="success-card"><div class="reference-panel"><span>Application reference</span><strong>${escapeHtml(this.submitted.reference)}</strong></div><div class="email-confirmation"><span><strong>A confirmation email will be sent to</strong><small>${escapeHtml(this.state.applicant.email)}</small></span></div><a class="button primary" href="${escapeHtml(config.homeUrl)}">Back to homepage</a></main></div></div>`;
      return;
    }
    const saveState = this.status || (this.session ? "Draft active" : "Not saved yet");
	const restartAction = this.restoreFailed ? '<button type="button" class="button secondary" data-action="restart">Start a new application</button>' : "";
	const finalActions = `<button type="button" class="button secondary" data-action="save-later"${this.busy||!this.canEmailResume()?" disabled":""}>${this.busy?"Saving…":"Save and email return link"}</button><button type="button" class="button primary" data-action="submit"${this.busy||!this.allValid()||!this.state.acknowledgement?" disabled":""}>${this.busy?"Submitting…":"Submit application"}</button>`;
    this.root.innerHTML = `<div class="rg-ps1"><div class="portal-shell"><header class="portal-masthead"><div class="masthead-shade"></div><div class="masthead-content"><div class="masthead-meta"><img class="brand-logo" src="${escapeHtml(config.assetUrl + "brand/royal-glass-logo-white.png")}" alt="Royal Glass"><p>Secure application · ${escapeHtml(saveState)}</p></div><h1>Tell us about your project</h1><p class="masthead-intro">This usually takes less than a minute. If you don’t know an answer, choose “Not sure” and our team will help.</p><div class="hero-progress"><div><span>Step ${this.step+1} of ${steps.length}</span><strong>${steps[this.step]}</strong></div><div class="hero-progress-track"><span style="transform:scaleX(${(this.step+1)/steps.length})"></span></div></div></div></header><section class="primer"><div><strong>PS1 is for design</strong><span>Start before installation. A PS3 relates to completed work.</span></div><div><strong>You can begin now</strong><span>Incomplete drawings are okay—upload what you already have.</span></div><div><strong>Reviewed by people</strong><span>Royal Glass confirms the correct route after submission.</span></div></section><main class="application-layout"><aside class="step-rail"><h2>Your application</h2><p>Complete each section in order.</p><div class="step-list">${steps.map((label,index)=>`<button type="button" data-action="goto" data-step="${index}" class="${index===this.step?"active":""}"${index>this.furthestStep?" disabled":""}><span>${index+1}</span>${label}</button>`).join("")}</div></aside><section class="form-card"><div class="step-heading"><span>${this.step+1}</span><div><p class="step-progress-label">Step ${this.step+1} of ${steps.length}</p><h2>${steps[this.step]}</h2></div></div>${this.renderStep()}${this.error?`<div class="form-error" role="alert">${escapeHtml(this.error)}</div>${restartAction}`:""}${this.status?`<div class="form-status" role="status">${escapeHtml(this.status)}</div>`:""}<div class="form-actions"><button type="button" class="button secondary" data-action="back"${this.step===0||this.busy?" disabled":""}>Back</button>${this.step<steps.length-1?`<button type="button" class="button primary" data-action="continue"${this.busy||!this.stepValid()?" disabled":""}>${this.busy?"Saving…":"Continue"}</button>`:finalActions}</div></section></main></div></div>`;
    this.mountTurnstile();
  }

  mountTurnstile() {
    const container = this.root.querySelector("[data-turnstile]");
    if (!container || this.turnstileToken) return;
    const render = () => {
      if (!window.turnstile || !container.isConnected || container.dataset.rendered) return;
      container.dataset.rendered = "true";
      this.turnstileWidget = window.turnstile.render(container, {
        sitekey: config.turnstileSiteKey,
        theme: "light",
        callback: (token) => { this.turnstileToken = token; this.error = ""; this.removeTurnstile(); this.render(); },
        "expired-callback": () => { this.turnstileToken = ""; this.removeTurnstile(); this.render(); },
		"error-callback": () => { this.turnstileFailed = true; this.error = "The security check could not load. Try again in a moment."; this.removeTurnstile(); this.render(); },
      });
    };
    if (window.turnstile) { render(); return; }
    if (!document.querySelector('script[data-rg-turnstile]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true; script.dataset.rgTurnstile = "true"; script.addEventListener("load", render); document.head.append(script);
    } else setTimeout(render, 0);
  }

  removeTurnstile() {
	if (this.turnstileWidget !== null && window.turnstile) {
	  try { window.turnstile.remove(this.turnstileWidget); } catch { /* Widget already removed. */ }
	}
	this.turnstileWidget = null;
  }
}

document.querySelectorAll("[data-rg-ps1-native]").forEach((root) => new Ps1Application(root));
