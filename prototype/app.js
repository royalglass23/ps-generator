// PROTOTYPE ONLY: three variants of Roxy's PS1 portal, switchable with ?variant=A|B|C.
(function () {
  const root = document.getElementById('prototype-root');
  const variants = {
    A: 'Focused wizard',
    B: 'Guided step rail',
    C: 'Application workspace',
  };
  const stepLabels = ['Applicant', 'Project & Consent Details', 'Design', 'Site Conditions & Locations', 'Documents & Images', 'Review & Submit'];
  const MAX_AREAS = 3;
  const MAX_LOCATIONS_PER_AREA = 3;
  const imageBase = 'assets/';
  const state = {
    step: 0,
    furthestStep: 0,
    submitted: false,
    draftTouched: false,
    openLocationMenu: null,
    need: 'ps1',
    role: 'architect',
    name: '', email: '', mobile: '',
    address: '', city: '', postalCode: '', bc: '', resourceConsent: '', estimatedInstallation: 'asap', stage: 'preparing_consent',
    designFamily: 'balustrade', design: '',
    substrate: 'timber',
    locations: [{ types: [], other: '', environment: '' }],
    uploads: [],
    uploadError: '',
    agreement: false,
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function variant() {
    const requested = new URLSearchParams(location.search).get('variant') || 'A';
    return variants[requested] ? requested : 'A';
  }

  function setVariant(key) {
    const url = new URL(location.href);
    url.searchParams.set('variant', key);
    history.replaceState({}, '', url);
    render();
  }

  function cycleVariant(direction) {
    const keys = Object.keys(variants);
    const next = (keys.indexOf(variant()) + direction + keys.length) % keys.length;
    setVariant(keys[next]);
  }

  function shell(content) {
    return `
      <div class="site-shell">
        <div class="prototype-note">Prototype only — no information is saved or submitted</div>
        <header class="site-header">
          <div class="brand"><div class="brand-mark">RG</div><div>Royal Glass<small>PS1 APPLICATION PORTAL</small></div></div>
          <div class="secure-label"><span>◈</span> Secure application <i>·</i> <span id="draft-status">${draftStatus()}</span></div>
        </header>
        <section class="intro">
          <div class="eyebrow">Glass balustrade & barrier design</div>
          <h1>Request a PS1</h1>
          <p>Tell us about your project and upload what you already have. Our team will review the information before a PS1 is prepared.</p>
        </section>
        <section class="intake-primer" aria-label="Before you start">
          <div class="primer-heading"><span>Before you start</span><strong>You can begin with incomplete information</strong></div>
          <div class="primer-grid">
            <div><b>PS1 is for design</b><span>Start before installation. A PS3 relates to the completed work.</span></div>
            <div><b>Useful project details</b><span>Address, Council/BCA, wind information, system and fixing substrate.</span></div>
            <div><b>Useful drawings</b><span>Plan, elevation and a typical fixing section — upload what you have.</span></div>
          </div>
        </section>
        ${content}
        <div class="prototype-switcher" aria-label="Prototype variant switcher">
          <button type="button" data-variant-prev aria-label="Previous variant">←</button>
          <div class="variant-label">${variant()} — ${variants[variant()]}</div>
          <button type="button" data-variant-next aria-label="Next variant">→</button>
        </div>
      </div>`;
  }

  function progress() {
    const pct = Math.round(((state.step + 1) / stepLabels.length) * 100);
    return `<div class="progress-wrap"><div class="progress-meta"><strong>Step ${state.step + 1} of ${stepLabels.length}</strong><span>${pct}% complete</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;
  }

  function draftStatus() {
    return state.draftTouched ? 'Draft updated in this session' : 'Draft starts in this session';
  }

  function stepHeading() {
    const descriptions = [
      'Tell us what you need and add the applicant’s contact details.',
      'Add the project address, consent references and current stage.',
      'Select the known Royal Glass system, or choose Not sure.',
      'Tell us about the fixing conditions and the areas covered by the system.',
      'Upload any drawings, documents or photos that will help Royal Glass review the project.',
      'Review the application, confirm the information is accurate and submit it for Royal Glass to review.',
    ];
    return `<div class="step-heading"><div class="step-number">${state.step + 1}</div><div><h2>${stepLabels[state.step]}</h2>${descriptions[state.step] ? `<p>${descriptions[state.step]}</p>` : ''}</div></div>`;
  }

  function optionCard(value, selected, title, description, image, group) {
    return `<button type="button" class="option-card ${selected === value ? 'selected' : ''}" data-choice-group="${group}" data-choice-value="${value}">
      ${image ? `<img src="${imageBase + image}" alt="" />` : ''}
      <span class="option-copy"><span class="option-title">${title}${selected === value ? '<span class="checkmark">✓</span>' : ''}</span>${description ? `<span class="option-description">${description}</span>` : ''}</span>
    </button>`;
  }

  function choiceRow(value, selected, title, description, group) {
    return `<button type="button" class="choice-row ${selected === value ? 'selected' : ''}" data-choice-group="${group}" data-choice-value="${value}"><span class="choice-dot"></span><span><strong>${title}</strong>${description ? `<span>${description}</span>` : ''}</span></button>`;
  }

  function applicantStep() {
    return `<div class="section-label">What do you need?</div><div class="choice-stack">
      ${choiceRow('ps1', state.need, 'I need a PS1', 'I am preparing or responding to a Building Consent application.', 'need')}
      ${choiceRow('quote', state.need, 'I need a quotation first', 'I want pricing before deciding whether to proceed with a PS1.', 'need')}
      ${choiceRow('unsure', state.need, 'I’m not sure whether I need a PS1', 'Royal Glass can review the project and advise the appropriate next step.', 'need')}
    </div><div class="section-label">Applicant details</div><div class="field-grid">
      ${field('Full name','name','text','e.g. John Smith',false,true)}${field('Mobile','mobile','tel','021 000 0000',false,true)}${field('Email','email','email','john@example.co.nz',true,true)}
    </div><div class="section-label">What is your role in this project?</div><div class="option-grid three">
      ${['architect:Architect / Designer','builder:Builder','developer:Developer','homeowner:Homeowner','other:Other'].map(item => { const [v,t] = item.split(':'); return optionCard(v,state.role,t,'',null,'role'); }).join('')}
    </div>`;
  }

  function field(label, key, type = 'text', placeholder = '', full = false, required = false) {
    return `<div class="field ${full ? 'full' : ''}"><label for="field-${key}">${label}${required ? ' *' : ''}</label><input id="field-${key}" data-field="${key}" type="${type}" value="${escapeHtml(state[key])}" placeholder="${placeholder}" ${required ? 'required aria-required="true"' : ''} /></div>`;
  }

  function selectField(label, key, options, full = false, required = false) {
    return `<div class="field ${full ? 'full' : ''}"><label for="field-${key}">${label}${required ? ' *' : ''}</label><select id="field-${key}" data-field="${key}" ${required ? 'required aria-required="true"' : ''}>${options.map(([v,t]) => `<option value="${v}" ${state[key] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  }

  function projectStep() {
    return `<div class="field-grid">
      <div class="field full"><label for="field-address">Project address *</label><input id="field-address" data-field="address" type="text" value="${escapeHtml(state.address)}" placeholder="Start typing the project address" list="project-address-suggestions" aria-describedby="address-search-hint" autocomplete="street-address" required aria-required="true" /><datalist id="project-address-suggestions"><option value="28 Example Street, Auckland 1010"></option><option value="15 Queen Street, Auckland 1010"></option></datalist><span class="field-hint" id="address-search-hint">Select an address from the Google suggestions to automatically fill City and Postal code.</span></div>
      ${field('City','city','text','Auto-filled from address')}${field('Postal code','postalCode','text','Auto-filled from address')}${field('Building Consent number','bc','text','If available')}${field('Resource Consent number','resourceConsent','text','If applicable')}
      ${selectField('Estimated installation date','estimatedInstallation',[
        ['asap','ASAP'],['3_months','3 months'],['6_months','6 months'],['1_year','1 year'],['2_years','2 years']
      ],true)}
      ${selectField('What stage is the project currently at?','stage',[
        ['concept','Concept / Early Design'],['developed','Developed Design'],['preparing_consent','Preparing Building Consent'],['consent_lodged','Building Consent lodged'],['council_rfi','Council RFI received'],['consent_approved','Building Consent approved'],['construction','Construction underway'],['existing','Existing building / alteration'],['other','Other']
      ],true,true)}
    </div>`;
  }

  function projectDetailsStep() {
    return projectStep();
  }

  function designStep() {
    const options = [
      ['','Select a system'],
      ['double-disc','Double Disc'],
      ['hidden','Hidden Face'],
      ['jh-clamp','JH Clamp'],
      ['juralco-canopy','Juralco Canopy'],
      ['lugano','Lugano'],
      ['mini-post','Mini Post'],
      ['mp-sp14','Mini Post SP14'],
      ['side-channel','Side Mount Channel'],
      ['top-channel','Top Mount Channel'],
      ['unex-ascot','Unex Ascot'],
      ['unex-metropolis','Unex Metropolis'],
      ['viking-aluminium','Viking Aluminium'],
      ['viking-glass','Viking Glass'],
      ['vista','Vista'],
      ['not-sure','Not sure','Royal Glass can identify the system from your drawings or photos.'],
    ];
    const systemPhotos = {
      'double-disc':'fix-standoff.jpg','hidden':'fix-standoff.jpg','jh-clamp':'fix-standoff.jpg','juralco-canopy':'not-sure.jpg',
      'lugano':'fix-standoff.jpg','mini-post':'fix-spigots.jpg','mp-sp14':'fix-spigots.jpg','side-channel':'fix-channel.jpg',
      'top-channel':'fix-channel.jpg','unex-ascot':'not-sure.jpg','unex-metropolis':'not-sure.jpg','viking-aluminium':'not-sure.jpg',
      'viking-glass':'not-sure.jpg','vista':'not-sure.jpg',
    };
    const selectedSystem = options.find(([value]) => value === state.design);
    const preview = state.design && selectedSystem && state.design !== 'not-sure'
      ? `<figure class="system-photo-preview"><img src="${imageBase + systemPhotos[state.design]}" alt="Representative placeholder for ${selectedSystem[1]}" /><figcaption><strong>${selectedSystem[1]}</strong><span>Representative prototype image — replace with the approved system photo.</span></figcaption></figure>`
      : '';
    return `<div class="section-label">What type of barrier is this?</div><div class="option-grid">
      ${optionCard('balustrade',state.designFamily,'Glass Balustrade','Decks, balconies, stairs, landings and other barriers.','fix-spigots.jpg','designFamily')}
      ${optionCard('pool',state.designFamily,'Pool Barrier','Glass fencing around a swimming pool.','use-pool.jpg','designFamily')}
    </div><div class="section-label">Known Royal Glass systems</div><div class="field-grid one">${selectField('Select a system','design',options,true,true)}</div>${preview}
      ${state.design === 'not-sure' ? '<div class="helper">No problem. Upload a photo, drawing, sketch or inspiration image in Step 5 and our team will review it.</div>' : ''}`;
  }

  function siteStep() {
    const substrates = [
      ['timber','Timber','substrate-timber.jpg'],
      ['concrete','Concrete','substrate-concrete.jpg'],
      ['steel','Steel','substrate-steel.jpg'],
      ['tile-concrete','Tile over concrete','substrate-tile.jpg'],
    ];
    return `<div class="section-label">What will the glass system be fixed to?</div><div class="option-grid">${substrates.map(([value,title,image])=>optionCard(value,state.substrate,title,'',image,'substrate')).join('')}</div>`;
  }

  function locationsValid() {
    return state.locations.length > 0 && state.locations.every(location => location.types.length && location.environment && (!location.types.includes('other') || location.other.trim()));
  }

  function locationsStep() {
    const options = [['deck','Deck'],['balcony','Balcony'],['stair','Stair'],['landing','Landing'],['juliet-window','Juliet Window'],['entrance-facade','Entrance Facade'],['pool-area','Pool Area'],['other','Others']];
    const poolSelected = state.locations.some(location => location.types.includes('pool-area'));
    const canAdd = !poolSelected && state.locations.length < MAX_AREAS;
    const rows = state.locations.map((location,index) => {
      const selectedLabels = options.filter(([value]) => location.types.includes(value)).map(([,label]) => label);
      const selectionSummary = selectedLabels.length ? selectedLabels.join(', ') : 'Select one or more locations';
      const menuOpen = state.openLocationMenu === index;
      return `<div class="location-row" data-location-row="${index}">
      <div class="location-row-header"><strong>Area ${index + 1}</strong>${state.locations.length > 1 ? `<button type="button" data-remove-location="${index}">Remove</button>` : ''}</div>
      <div class="multi-select"><label id="location-label-${index}">Location * <span>Select up to ${MAX_LOCATIONS_PER_AREA}</span></label>
        <button type="button" class="multi-select-trigger" data-location-menu-toggle="${index}" aria-expanded="${menuOpen}" aria-controls="location-menu-${index}" aria-labelledby="location-label-${index} location-summary-${index}"><span id="location-summary-${index}" class="multi-select-value">${escapeHtml(selectionSummary)}</span><span class="multi-select-chevron" aria-hidden="true"></span></button>
        ${menuOpen ? `<div id="location-menu-${index}" class="multi-select-menu" role="group" aria-label="Location options">
          ${options.map(([value,label]) => { const selected = location.types.includes(value); const disabled = !selected && location.types.length >= MAX_LOCATIONS_PER_AREA; return `<label class="multi-select-option ${disabled ? 'disabled' : ''}"><input type="checkbox" value="${value}" data-location-choice="${index}" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''} /><span>${label}</span></label>`; }).join('')}
          <button type="button" class="multi-select-done" data-location-menu-done="${index}">Done</button>
        </div>` : ''}
      </div>
      ${location.types.includes('other') ? `<div class="field location-other-field"><label for="location-other-${index}">Describe other location *</label><input id="location-other-${index}" data-location-other="${index}" type="text" value="${escapeHtml(location.other)}" required aria-required="true" /><span class="field-hint">Required when Others is selected.</span></div>` : ''}
      <fieldset class="environment-fieldset"><legend>Is this area internal or external? *</legend><div class="radio-list">
        <label class="radio-option"><input type="radio" name="location-environment-${index}" value="internal" data-location-environment="${index}" ${location.environment === 'internal' ? 'checked' : ''} required /><span>Internal</span></label>
        <label class="radio-option"><input type="radio" name="location-environment-${index}" value="external" data-location-environment="${index}" ${location.environment === 'external' ? 'checked' : ''} required /><span>External</span></label>
      </div></fieldset>
    </div>`;
    }).join('');
    return `<div class="location-heading"><div><h3 id="locations-heading">Locations</h3><p>Add up to three areas and select up to three locations per area. Pool Area must be the only area.</p></div><button type="button" class="btn btn-secondary" data-add-location ${canAdd ? '' : 'disabled'}>Add area</button></div><div class="location-list">${rows}</div>`;
  }

  function siteConditionsStep() {
    return `${siteStep()}<section class="form-subsection" aria-labelledby="locations-heading">${locationsStep()}</section>`;
  }

  function documentUploadStep() {
    const atLimit = state.uploads.length >= 5;
    return `<div class="simple-upload-wrap">
      <input class="visually-hidden" id="project-files" data-file-input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dwg" ${atLimit ? 'disabled' : ''} />
      <label class="simple-upload-zone ${atLimit ? 'disabled' : ''}" for="project-files" data-drop-zone>
        <span class="upload-symbol" aria-hidden="true"></span>
        <strong>${atLimit ? 'Maximum of 5 files reached' : 'Drag and drop files here'}</strong>
        <span>${atLimit ? 'Remove a file to add another.' : 'or select files from your computer'}</span>
      </label>
      <div class="simple-upload-meta"><span>Accepted: PDF, JPG, PNG, DWG</span><strong>${state.uploads.length} of 5 files</strong></div>
      ${state.uploadError ? `<div class="upload-error" role="alert">${escapeHtml(state.uploadError)}</div>` : ''}
      ${state.uploads.length ? `<div class="uploaded-files">${state.uploads.map((upload,index) => `<div class="uploaded-file"><span><strong>${escapeHtml(upload.name)}</strong><small>${escapeHtml(upload.sizeLabel)}</small></span><button type="button" data-remove-upload="${index}">Remove</button></div>`).join('')}</div>` : ''}
    </div>
      <div class="helper">Don't have all the information yet? Submit what you currently have. Royal Glass will review the information provided and may issue a Request for Further Information (RFI).</div>`;
  }

  function nextStepsTimeline() {
    return `<ol class="next-steps"><li><b>Application received</b><span>We email you a copy of your application and send it to the Royal Glass team for review.</span></li><li><b>Technical review</b><span>Royal Glass checks the system, drawings and design conditions.</span></li><li><b>More information if needed</b><span>If anything is missing, Royal Glass will email you with a secure way to provide the requested information.</span></li><li><b>PS1 prepared and issued</b><span>The document is issued only after the design route and required information are confirmed.</span></li></ol>`;
  }

  function reviewSummary() {
    return `${summaryItem('Applicant',state.name || 'Not entered')}${summaryItem('Project address',state.address || 'Not entered')}${summaryItem('System',designLabel())}${summaryItem('Areas',locationsSummaryLabel())}${summaryItem('Fixing substrate',substrateLabel())}${summaryItem('Files',state.uploads.length ? `${state.uploads.length} uploaded` : 'None uploaded')}${summaryItem('Request',initialNeedLabel())}${summaryItem('Preliminary route',pathway().title)}`;
  }

  function agreementStep() {
    return `<div class="section-label">Application summary</div><div class="summary-list">${reviewSummary()}</div>${missingItemsPanel()}<div class="section-label">Confirmation</div><label class="checkbox-row"><input type="checkbox" data-field="agreement" ${state.agreement ? 'checked' : ''}/><span>I confirm that the information provided is accurate to the best of my knowledge and may be submitted to Royal Glass for review.</span></label>
      <div class="section-label">What happens after submission?</div>${nextStepsTimeline()}
      <div class="helper amber">Submitting this form does not automatically mean Royal Glass has agreed to issue a PS1. Every application is reviewed first and may require more information or further technical review.</div>`;
  }

  function stepContent() {
    const content = [applicantStep, projectDetailsStep, designStep, siteConditionsStep, documentUploadStep, agreementStep][state.step]();
    const help = state.step >= 1 && state.step <= 3
      ? `<div class="support-strip"><span>Need help with a technical answer?</span><button type="button" data-help>Ask Royal Glass for guidance</button></div>`
      : '';
    return content + help;
  }

  function designLabel() {
    const labels = { 'double-disc':'Double Disc','hidden':'Hidden Face','jh-clamp':'JH Clamp','juralco-canopy':'Juralco Canopy','lugano':'Lugano','mini-post':'Mini Post','mp-sp14':'Mini Post SP14','side-channel':'Side Mount Channel','top-channel':'Top Mount Channel','unex-ascot':'Unex Ascot','unex-metropolis':'Unex Metropolis','viking-aluminium':'Viking Aluminium','viking-glass':'Viking Glass','vista':'Vista','not-sure':'Not sure' };
    return labels[state.design] || 'Not selected';
  }

  function roleLabel() {
    return ({ architect:'Architect / Designer', builder:'Builder', developer:'Developer', homeowner:'Homeowner', other:'Other' })[state.role] || 'Not selected';
  }

  function stageLabel() {
    return ({ concept:'Concept / Early Design', developed:'Developed Design', preparing_consent:'Preparing Building Consent', consent_lodged:'Building Consent lodged', council_rfi:'Council RFI received', consent_approved:'Building Consent approved', construction:'Construction underway', existing:'Existing building / alteration', other:'Other' })[state.stage] || 'Not selected';
  }

  function installationDateLabel() {
    return ({ asap:'ASAP', '3_months':'3 months', '6_months':'6 months', '1_year':'1 year', '2_years':'2 years' })[state.estimatedInstallation] || 'Not selected';
  }

  function substrateLabel() {
    return ({ timber:'Timber', concrete:'Concrete', steel:'Steel', 'tile-concrete':'Tile over concrete' })[state.substrate] || 'Not selected';
  }

  function designFamilyLabel() {
    return state.designFamily === 'pool' ? 'Pool Barrier' : 'Glass Balustrade';
  }

  function locationTypeLabel(type) {
    return ({ deck:'Deck', balcony:'Balcony', stair:'Stair', landing:'Landing', 'juliet-window':'Juliet Window', 'entrance-facade':'Entrance Facade', 'pool-area':'Pool Area', other:'Other' })[type] || type;
  }

  function locationAreaLabel(location, index) {
    const types = location.types.map(type => type === 'other' && location.other ? `Other: ${location.other}` : locationTypeLabel(type));
    const environment = location.environment ? location.environment[0].toUpperCase() + location.environment.slice(1) : 'Internal / External not selected';
    return `Area ${index + 1}: ${types.length ? types.join(', ') : 'No location selected'} — ${environment}`;
  }

  function locationsSummaryLabel() {
    return state.locations.some(location => location.types.length) ? state.locations.map(locationAreaLabel).join(' | ') : 'Not entered';
  }

  function pathway() {
    const specificSignals = state.locations.some(location => location.types.includes('other'));
    const unknownSignals = !state.substrate || !state.design || !locationsValid();
    if (specificSignals) return { tone: 'amber', title: 'Technical review likely', copy: 'One or more answers fall outside a straightforward standard pathway. Royal Glass should review the drawings and fixing details before confirming the PS1 route.' };
    if (unknownSignals) return { tone: '', title: 'Pathway not confirmed yet', copy: 'There is not enough information to suggest a route. You can still continue and Royal Glass can request the missing details.' };
    return { tone: 'green', title: 'Standard pathway may be possible', copy: 'The current answers do not show an obvious specific-design trigger. Royal Glass must still verify the selected system, substrate, drawings and project conditions.' };
  }

  function pathwayPanel() {
    const result = pathway();
    return `<div class="pathway-panel ${result.tone}"><span class="pathway-kicker">Preliminary pathway</span><strong>${result.title}</strong><p>${result.copy}</p></div>`;
  }

  function missingItemsPanel() {
    const items = [];
    if (!state.name.trim()) items.push('Applicant full name');
    if (!state.mobile.trim()) items.push('Applicant mobile');
    if (!state.email.trim()) items.push('Applicant email');
    if (!state.address) items.push('Project address');
    if (!state.stage) items.push('Project stage');
    if (!state.design) items.push('Preferred system or visual match');
    if (!state.substrate) items.push('Fixing substrate');
    if (!locationsValid()) items.push('Project location areas');
    if (!items.length) return `<div class="missing-panel clear"><strong>Ready for initial review</strong><span>No obvious intake items are missing. Royal Glass still confirms the technical requirements.</span></div>`;
    return `<div class="missing-panel"><strong>${items.length} required item${items.length === 1 ? '' : 's'} still to complete</strong><ul>${items.map(item => `<li>${item}</li>`).join('')}</ul><span>Complete these items before submitting the application.</span></div>`;
  }

  function initialNeedLabel() {
    return ({ ps1:'PS1 application', quote:'Quotation first', unsure:'Royal Glass to advise' })[state.need];
  }

  function summaryItem(label, value) {
    return `<div class="summary-item"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function successPanel() {
    const line = (label, value) => `<div class="application-summary-line"><strong>${escapeHtml(label)}:</strong><span>${escapeHtml(value)}</span></div>`;
    const files = state.uploads.length
      ? `<ul class="document-status-list">${state.uploads.map(upload => `<li><span><strong>${escapeHtml(upload.name)}</strong><small>${escapeHtml(upload.sizeLabel)}</small></span><strong class="document-status received">✓</strong></li>`).join('')}</ul>`
      : `<p class="summary-answer muted">No files uploaded.</p>`;
    const areas = `<ul class="area-summary-list">${state.locations.map((location,index) => `<li>${escapeHtml(locationAreaLabel(location,index))}</li>`).join('')}</ul>`;
    const submittedDate = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    return `<div class="card success-panel application-summary">
      <h2>PS1 Application Summary</h2>
      <p class="application-summary-intro">Application received for Royal Glass review.</p>
      <section><h3>Applicant</h3>${line('Full name',state.name || 'Not entered')}${line('Mobile',state.mobile || 'Not entered')}${line('Email',state.email || 'Not entered')}${line('Role',roleLabel())}</section>
      <section><h3>Project</h3>${line('Project address',state.address || 'Not entered')}${line('City',state.city || 'Not entered')}${line('Postal code',state.postalCode || 'Not entered')}${line('Building Consent number',state.bc || 'Not provided')}${line('Resource Consent number',state.resourceConsent || 'Not provided')}${line('Project stage',stageLabel())}${line('Estimated installation',installationDateLabel())}</section>
      <section><h3>System & Site Conditions</h3>${line('Barrier type',designFamilyLabel())}${line('Royal Glass system',designLabel())}${line('Fixing substrate',substrateLabel())}<h4>Areas</h4>${areas}</section>
      <section><h3>Documents & Images</h3>${files}</section>
      <section><h3>Request</h3><strong class="summary-answer">${escapeHtml(initialNeedLabel())}</strong><p class="summary-route">${escapeHtml(pathway().title)}</p></section>
      <section><h3>Agreement</h3>${line('Accepted',state.agreement ? 'Yes' : 'No')}${line('Accepted by',state.name || 'Applicant')}${line('Date',submittedDate)}</section>
    </div>`;
  }

  function navigation() {
    const lastStep = stepLabels.length - 1;
    const finalDisabled = state.step === lastStep && (!state.agreement || !requiredIntakeValid());
    const stepDisabled = state.step < lastStep && !stepValid(state.step);
    return `<div class="nav-row"><button type="button" class="btn btn-secondary" data-back ${state.step === 0 ? 'disabled' : ''}>Back</button><button type="button" class="btn btn-save" data-save>Save for later</button><button type="button" class="btn btn-primary" data-next ${finalDisabled || stepDisabled ? 'disabled' : ''}>${state.step === lastStep ? 'Review and submit application' : 'Continue'}</button></div>`;
  }

  function stepValid(step) {
    if (step === 0) return Boolean(state.name.trim() && state.mobile.trim() && state.email.trim());
    if (step === 1) return Boolean(state.address.trim() && state.stage);
    if (step === 2) return Boolean(state.design);
    if (step === 3) return Boolean(state.substrate && locationsValid());
    return true;
  }

  function requiredIntakeValid() {
    return [0, 1, 2, 3].every(stepValid);
  }

  function canNavigateToStep(targetStep) {
    if (targetStep <= state.step) return true;
    if (targetStep > state.furthestStep + 1) return false;
    return Array.from({ length: targetStep }, (_, index) => index).every(stepValid);
  }

  function refreshNavigationLocks() {
    root.querySelectorAll('[data-go-step]').forEach(button => {
      const allowed = canNavigateToStep(Number(button.dataset.goStep));
      button.disabled = !allowed;
      if (allowed) button.removeAttribute('title');
      else button.title = 'Complete the earlier pages first';
    });
    const reviewButton = root.querySelector('[data-review]');
    if (reviewButton) {
      const allowed = canNavigateToStep(stepLabels.length - 1);
      reviewButton.disabled = !allowed;
      if (allowed) reviewButton.removeAttribute('title');
      else reviewButton.title = 'Complete each page before reviewing';
    }
  }

  function renderA() {
    return `<main class="variant-a">${state.submitted ? successPanel() : `${progress()}<section class="card main-card">${stepHeading()}${stepContent()}${navigation()}</section>`}</main>`;
  }

  function renderB() {
    const rail = `<aside class="card step-rail"><h3>Your application</h3><p>Complete each required section in order. You can return to earlier steps at any time.</p>${stepLabels.map((label,index) => {
      const allowed = canNavigateToStep(index);
      const completed = index < state.furthestStep && stepValid(index);
      return `<button class="rail-step ${index === state.step ? 'active' : ''} ${completed ? 'done' : ''}" data-go-step="${index}" ${allowed ? '' : 'disabled title="Complete the earlier pages first"'}><span class="rail-index">${completed ? '✓' : index + 1}</span><span class="rail-label">${label}</span></button>`;
    }).join('')}</aside>`;
    return `<main class="variant-b">${rail}<section>${state.submitted ? successPanel() : `<div class="card main-card">${stepHeading()}${stepContent()}${navigation()}</div>`}</section></main>`;
  }

  function renderC() {
    const tabs = `<div class="workspace-tabs">${stepLabels.map((label,index) => {
      const allowed = canNavigateToStep(index);
      return `<button class="workspace-tab ${index === state.step ? 'active' : ''}" data-go-step="${index}" ${allowed ? '' : 'disabled title="Complete the earlier pages first"'}>${String(index + 1).padStart(2,'0')} ${label}</button>`;
    }).join('')}</div>`;
    const uploadCount = state.uploads.length;
    const summary = `<aside class="card summary-card"><h3>Application snapshot</h3><div class="summary-list">${summaryItem('Applicant',state.name || 'Not entered')}${summaryItem('Role',state.role.replace('_',' '))}${summaryItem('Address',state.address || 'Not entered')}${summaryItem('Design',designLabel())}${summaryItem('Preliminary route',pathway().title)}${summaryItem('Site',state.substrate || 'Not selected')}${summaryItem('Uploads',`${uploadCount} added`)}${summaryItem('Request',initialNeedLabel())}</div></aside>`;
    const reviewAllowed = canNavigateToStep(stepLabels.length - 1);
    return `<main class="variant-c">${state.submitted ? successPanel() : `<div class="workspace-head"><div><h2>PS1 application workspace</h2><p>Work through each section while keeping the application summary visible.</p></div><button class="btn btn-quiet" type="button" data-review ${reviewAllowed ? '' : 'disabled title="Complete each page before reviewing"'}>Review application</button></div>${tabs}<div class="workspace-grid"><section class="card workspace-card">${stepHeading()}${stepContent()}${navigation()}</section>${summary}</div>`}</main>`;
  }

  function render() {
    const body = variant() === 'A' ? renderA() : variant() === 'B' ? renderB() : renderC();
    root.innerHTML = shell(body);
    bindInteractions();
  }

  function handleClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.matches('[data-variant-prev]')) return cycleVariant(-1);
    if (target.matches('[data-variant-next]')) return cycleVariant(1);
    if (target.matches('[data-back]') && state.step > 0) { state.step--; return render(); }
    if (target.matches('[data-next]')) {
      if (state.step < stepLabels.length - 1 && !stepValid(state.step)) return;
      if (state.step < stepLabels.length - 1) {
        state.step++;
        state.furthestStep = Math.max(state.furthestStep, state.step);
      }
      else if (state.agreement && requiredIntakeValid()) state.submitted = true;
      return render();
    }
    if (target.matches('[data-go-step]')) {
      const targetStep = Number(target.dataset.goStep);
      if (!canNavigateToStep(targetStep)) return;
      state.step = targetStep;
      state.furthestStep = Math.max(state.furthestStep, state.step);
      state.submitted = false;
      return render();
    }
    if (target.matches('[data-review]')) {
      const reviewStep = stepLabels.length - 1;
      if (!canNavigateToStep(reviewStep)) return;
      state.step = reviewStep;
      state.furthestStep = Math.max(state.furthestStep, state.step);
      return render();
    }
    if (target.matches('[data-save]')) return window.alert('Prototype: the production portal will save this draft for 24 hours and email you a secure link to resume it.');
    if (target.matches('[data-help]')) return window.alert('Prototype: this would open the Royal Glass technical help path without losing the draft.');
    if (target.matches('[data-location-menu-toggle]')) {
      const index = Number(target.dataset.locationMenuToggle);
      state.openLocationMenu = state.openLocationMenu === index ? null : index;
      return render();
    }
    if (target.matches('[data-location-menu-done]')) {
      state.openLocationMenu = null;
      return render();
    }
    if (target.matches('[data-add-location]')) {
      if (state.locations.length >= MAX_AREAS || state.locations.some(location => location.types.includes('pool-area'))) return;
      state.locations.push({ types: [], other: '', environment: '' });
      state.openLocationMenu = state.locations.length - 1;
      state.draftTouched = true;
      return render();
    }
    if (target.matches('[data-remove-location]')) {
      state.locations.splice(Number(target.dataset.removeLocation), 1);
      if (!state.locations.length) state.locations.push({ types: [], other: '', environment: '' });
      state.openLocationMenu = null;
      state.draftTouched = true;
      return render();
    }
    if (target.matches('[data-remove-upload]')) {
      state.uploads.splice(Number(target.dataset.removeUpload), 1);
      state.uploadError = '';
      state.draftTouched = true;
      return render();
    }
    if (target.matches('[data-choice-group]')) { state.draftTouched = true; state[target.dataset.choiceGroup] = target.dataset.choiceValue; if (target.dataset.choiceGroup === 'designFamily') state.design = ''; return render(); }
  }

  function handleInput(event) {
    const otherLocationIndex = event.target.dataset.locationOther;
    if (otherLocationIndex !== undefined) {
      const location = state.locations[Number(otherLocationIndex)];
      if (location) location.other = event.target.value;
      state.draftTouched = true;
      const nextButton = root.querySelector('[data-next]');
      if (nextButton && state.step === 3) nextButton.disabled = !locationsValid();
      refreshNavigationLocks();
      return;
    }
    const key = event.target.dataset.field;
    if (!key) return;
    state[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    if (key === 'address') {
      const addressDetails = {
        '28 Example Street, Auckland 1010': { city: 'Auckland', postalCode: '1010' },
        '15 Queen Street, Auckland 1010': { city: 'Auckland', postalCode: '1010' },
      }[event.target.value];
      if (addressDetails) {
        state.city = addressDetails.city;
        state.postalCode = addressDetails.postalCode;
        state.draftTouched = true;
        return render();
      }
    }
    state.draftTouched = true;
    const draft = root.querySelector('#draft-status');
    if (draft) draft.textContent = draftStatus();
    const nextButton = root.querySelector('[data-next]');
    if (nextButton && state.step < stepLabels.length - 1) nextButton.disabled = !stepValid(state.step);
    refreshNavigationLocks();
  }

  function handleChange(event) {
    const locationIndex = event.target.dataset.locationChoice;
    if (locationIndex !== undefined) {
      const location = state.locations[Number(locationIndex)];
      if (!location) return;
      const value = event.target.value;
      if (event.target.checked && value !== 'pool-area' && location.types.length >= MAX_LOCATIONS_PER_AREA) return render();
      if (value === 'pool-area' && event.target.checked) {
        location.types = ['pool-area'];
        location.other = '';
        state.locations = [location];
        state.openLocationMenu = 0;
      } else {
        location.types = location.types.filter(type => type !== 'pool-area' && type !== value);
        if (event.target.checked) location.types.push(value);
        if (!location.types.includes('other')) location.other = '';
        state.openLocationMenu = Number(locationIndex);
      }
      state.draftTouched = true;
      return render();
    }
    const locationEnvironmentIndex = event.target.dataset.locationEnvironment;
    if (locationEnvironmentIndex !== undefined) {
      const location = state.locations[Number(locationEnvironmentIndex)];
      if (!location) return;
      location.environment = event.target.value;
      state.draftTouched = true;
      return render();
    }
    const key = event.target.dataset.field;
    if (!key) return;
    state[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    state.draftTouched = true;
    if (key === 'agreement' || key === 'design') render();
  }

  function bindInteractions() {
    root.querySelectorAll('button').forEach(button => button.addEventListener('click', handleClick));
    root.querySelectorAll('[data-field], [data-location-choice], [data-location-other], [data-location-environment]').forEach(control => {
      control.addEventListener('input', handleInput);
      control.addEventListener('change', handleChange);
    });
    const fileInput = root.querySelector('[data-file-input]');
    if (fileInput) fileInput.addEventListener('change', event => addFiles(event.target.files));
    const dropZone = root.querySelector('[data-drop-zone]');
    if (dropZone && !dropZone.classList.contains('disabled')) {
      dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('dragging'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
      dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('dragging'); addFiles(event.dataTransfer.files); });
    }
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const validFiles = files.filter(file => /\.(pdf|jpe?g|png|dwg)$/i.test(file.name));
    const available = Math.max(0, 5 - state.uploads.length);
    state.uploads.push(...validFiles.slice(0, available).map(file => ({
      name: file.name,
      sizeLabel: file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'File ready',
    })));
    if (validFiles.length < files.length) state.uploadError = 'Some files were not added. Use PDF, JPG, PNG or DWG files only.';
    else if (validFiles.length > available) state.uploadError = 'Only 5 files can be added. Remove a file before adding another.';
    else state.uploadError = '';
    state.draftTouched = true;
    render();
  }

  addEventListener('popstate', render);
  addEventListener('keydown', event => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (['INPUT','TEXTAREA','SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
    if (event.key === 'ArrowLeft') cycleVariant(-1);
    if (event.key === 'ArrowRight') cycleVariant(1);
  });

  render();
})();
