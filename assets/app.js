/**
 * Flow controller: shows one step at a time, keeps the answers, and hands over
 * to the result screen at the end.
 */

import { emptyValues } from './schema.js';
import { score } from './scoring.js';
import { STEPS, visibleSteps, progressOf, fieldById } from './flow.js';
import { renderResult } from './result.js';

const STORAGE_KEY = 'hf-app.session.v2';

const stage = document.getElementById('stage');
const footer = document.getElementById('footer');
const backButton = document.getElementById('btn-back');
const primaryButton = document.getElementById('btn-primary');
const progressFill = document.getElementById('progress-fill');
const sectionLabel = document.getElementById('section-label');
const sheet = document.getElementById('menu-sheet');

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

let state = restore() ?? { values: emptyValues(), currentId: STEPS[0].id, answered: [] };
let answered = new Set(state.answered);
let direction = 'forward';

const currentStep = () => STEPS.find((step) => step.id === state.currentId) ?? STEPS[0];

/* ------------------------------------------------------------ navigation */

function goTo(stepId, how = 'forward') {
  direction = how;
  state.currentId = stepId;
  persist();
  render();
}

function step(offset) {
  const list = visibleSteps(state.values);
  const index = list.findIndex((s) => s.id === state.currentId);
  const target = list[index + offset];
  if (!target) return;
  goTo(target.id, offset > 0 ? 'forward' : 'back');
}

function next() {
  if (!validate()) return;
  step(1);
}

/* ------------------------------------------------------------ validation */

let validators = [];

function validate() {
  const errorNode = document.getElementById('step-error');
  for (const check of validators) {
    const message = check();
    if (message) {
      if (errorNode) errorNode.textContent = message;
      return false;
    }
  }
  if (errorNode) errorNode.textContent = '';
  return true;
}

/* --------------------------------------------------------- input widgets */

/** Big tappable option buttons, lettered like a quiz. */
function optionList(options, isSelected, onPick) {
  const list = el('div', 'options');
  options.forEach(([value, label], index) => {
    const button = el('button', 'option');
    button.type = 'button';
    button.append(
      el('span', 'option-key', String.fromCharCode(65 + index)),
      el('span', 'option-label', label),
    );
    if (isSelected(value)) button.classList.add('selected');
    button.addEventListener('click', () => onPick(value, button));
    list.appendChild(button);
  });
  return list;
}

/** Choosing an option answers the question, so move on by itself. */
function pickAndAdvance(list, button) {
  for (const other of list.querySelectorAll('.option')) other.classList.remove('selected');
  button.classList.add('selected');
  setTimeout(() => next(), 180);
}

function textInput(field) {
  const input = el('input');
  input.id = `f-${field.id}`;
  input.value = state.values[field.id] ?? '';
  if (field.type === 'number') {
    input.type = 'number';
    input.inputMode = field.step && field.step < 1 ? 'decimal' : 'numeric';
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.step !== undefined) input.step = field.step;
  } else if (field.type === 'date') {
    input.type = 'date';
  } else {
    input.type = 'text';
    if (field.placeholder) input.placeholder = field.placeholder;
  }
  input.addEventListener('input', () => {
    state.values[field.id] = input.value;
    answered.add(field.id);
    persist();
    updatePrimaryLabel();
    const bmi = document.getElementById('bmi-live');
    if (bmi) bmi.textContent = bmiText();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); next(); }
  });

  validators.push(() => {
    const raw = input.value.trim();
    if (raw === '' || field.type !== 'number') return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return `${field.label} must be a number.`;
    if (field.min !== undefined && value < field.min) return `${field.label} looks too low — expected ${field.min}–${field.max}.`;
    if (field.max !== undefined && value > field.max) return `${field.label} looks too high — expected ${field.min}–${field.max}.`;
    return null;
  });
  return input;
}

function bmiText() {
  const h = Number(state.values.heightCm);
  const w = Number(state.values.weightKg);
  if (!h || !w) return 'BMI appears once both are entered.';
  return `BMI ${(w / ((h / 100) ** 2)).toFixed(1)} kg/m²`;
}

/* ------------------------------------------------------------- rendering */

function renderQuestion(stepDef) {
  const body = el('div', 'step-body');
  const fields = stepDef.fields.map(fieldById);
  const single = fields.length === 1 ? fields[0] : null;

  if (single && single.type === 'bool') {
    const list = optionList(
      [['yes', 'Yes'], ['no', 'No']],
      (value) => answered.has(single.id) && (value === 'yes') === Boolean(state.values[single.id]),
      (value, button) => {
        state.values[single.id] = value === 'yes';
        answered.add(single.id);
        persist();
        pickAndAdvance(list, button);
      },
    );
    body.appendChild(list);
    return body;
  }

  if (single && single.type === 'select') {
    const options = single.options.filter(([value]) => value !== '');
    const list = optionList(
      options,
      (value) => state.values[single.id] === value,
      (value, button) => {
        state.values[single.id] = value;
        answered.add(single.id);
        persist();
        pickAndAdvance(list, button);
      },
    );
    body.appendChild(list);
    return body;
  }

  if (single && stepDef.quick) {
    const list = optionList(
      stepDef.quick,
      (value) => String(state.values[single.id]) === value,
      (value, button) => {
        state.values[single.id] = value;
        answered.add(single.id);
        persist();
        pickAndAdvance(list, button);
      },
    );
    body.appendChild(list);

    const exact = el('div', 'field');
    exact.append(el('label', null, 'Or enter the exact number'), textInput(single));
    exact.querySelector('label').htmlFor = `f-${single.id}`;
    body.appendChild(exact);
    return body;
  }

  const grid = el('div', fields.length > 1 ? 'field-grid' : 'field-grid single');
  for (const field of fields) {
    const wrap = el('div', 'field');
    const label = el('label', null, field.unit ? `${field.label} (${field.unit})` : field.label);
    label.htmlFor = `f-${field.id}`;
    wrap.append(label, textInput(field));
    if (field.ref) wrap.appendChild(el('span', 'ref', `Normal ${field.ref}`));
    grid.appendChild(wrap);
  }
  body.appendChild(grid);

  if (stepDef.showBmi) {
    const readout = el('p', 'bmi-live', bmiText());
    readout.id = 'bmi-live';
    body.appendChild(readout);
  }
  return body;
}

function renderMulti(stepDef) {
  const body = el('div', 'step-body');
  const chips = el('div', 'chips');
  for (const field of stepDef.fields.map(fieldById)) {
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.append(el('span', 'chip-box'), el('span', null, field.label));
    if (state.values[field.id]) chip.classList.add('selected');
    chip.addEventListener('click', () => {
      state.values[field.id] = !state.values[field.id];
      answered.add(field.id);
      chip.classList.toggle('selected', Boolean(state.values[field.id]));
      persist();
    });
    chips.appendChild(chip);
  }
  body.appendChild(chips);
  body.appendChild(el('p', 'chip-hint', 'Leave everything unselected if none apply.'));
  return body;
}

function renderWelcome() {
  const body = el('div', 'step-body welcome');
  body.append(
    el('p', 'welcome-kicker', 'Indian HF App'),
    el('h1', 'welcome-title', 'Heart Failure Risk Assessment'),
    el('p', 'welcome-blurb',
      'A few questions at a time — history, symptoms, signs, labs, imaging and treatment. '
      + 'You get a 0–100 risk score with a colour zone and follow-up plan at the end.'),
    el('p', 'welcome-meta', 'About 4 minutes · answers are saved on this device as you go'),
  );
  const sample = el('button', 'btn ghost', 'Fill with a sample patient');
  sample.type = 'button';
  sample.addEventListener('click', loadSample);
  body.appendChild(sample);
  body.appendChild(el('p', 'fine-print disclaimer',
    'Not a medical device. The weighting is a transparent internal scheme, not a '
    + 'validated published model, and does not replace clinical judgement.'));
  return body;
}

function renderSection(stepDef) {
  const body = el('div', 'step-body section-intro');
  body.append(
    el('p', 'section-kicker', 'Next section'),
    el('h1', 'section-title', stepDef.title),
    el('p', 'section-blurb', stepDef.blurb),
  );
  return body;
}

function render() {
  const stepDef = currentStep();
  validators = [];

  const screen = el('div', `screen enter-${direction}`);
  const isResult = stepDef.kind === 'result';

  if (stepDef.kind === 'question' || stepDef.kind === 'multi') {
    const progress = progressOf(stepDef.id, state.values);
    // The app bar already carries the section name, so this line only numbers.
    screen.appendChild(el('p', 'step-meta',
      `Question ${progress.position} of ${progress.total}`));
    screen.appendChild(el('h1', 'step-title', stepDef.title));
    if (stepDef.hint) screen.appendChild(el('p', 'step-hint', stepDef.hint));
    screen.appendChild(stepDef.kind === 'multi' ? renderMulti(stepDef) : renderQuestion(stepDef));
    const error = el('p', 'step-error');
    error.id = 'step-error';
    screen.appendChild(error);
  } else if (stepDef.kind === 'welcome') {
    screen.appendChild(renderWelcome());
  } else if (stepDef.kind === 'section') {
    screen.appendChild(renderSection(stepDef));
  } else {
    screen.appendChild(renderResult(state.values, {
      onReview: () => goTo(STEPS[1].id, 'back'),
      onRestart: restart,
      onExport: exportJson,
    }));
  }

  stage.replaceChildren(screen);
  stage.scrollTop = 0;
  window.scrollTo(0, 0);

  document.body.classList.toggle('on-result', isResult);
  footer.hidden = isResult;
  updateHeader(stepDef);
  updatePrimaryLabel();

  const list = visibleSteps(state.values);
  backButton.disabled = list.findIndex((s) => s.id === stepDef.id) === 0;

  const focusTarget = screen.querySelector('input:not([type=hidden])');
  if (focusTarget && stepDef.kind === 'question') focusTarget.focus({ preventScroll: true });
}

function updateHeader(stepDef) {
  const list = visibleSteps(state.values);
  const index = list.findIndex((s) => s.id === stepDef.id);
  const percent = Math.round((index / Math.max(1, list.length - 1)) * 100);
  progressFill.style.width = `${percent}%`;

  sectionLabel.textContent = stepDef.kind === 'result' ? 'Result' : (stepDef.section ?? stepDef.title ?? '');
}

/** "Skip" reads better than "Next" on an optional question left blank. */
function updatePrimaryLabel() {
  const stepDef = currentStep();
  if (stepDef.kind === 'welcome') { primaryButton.textContent = 'Start'; return; }
  if (stepDef.kind === 'section') { primaryButton.textContent = 'Continue'; return; }

  const list = visibleSteps(state.values);
  const isLast = list[list.length - 2]?.id === stepDef.id;
  if (isLast) { primaryButton.textContent = 'See my score'; return; }

  const blank = (stepDef.fields ?? []).every((id) => {
    const value = state.values[id];
    return value === '' || value === undefined || value === null || value === false;
  });
  primaryButton.textContent = stepDef.optional && blank ? 'Skip' : 'Next';
}

/* ---------------------------------------------------------- persistence */

function persist() {
  state.answered = [...answered];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota — the flow still works, it just will not resume */
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.values) return null;
    return {
      values: { ...emptyValues(), ...parsed.values },
      currentId: STEPS.some((s) => s.id === parsed.currentId) ? parsed.currentId : STEPS[0].id,
      answered: Array.isArray(parsed.answered) ? parsed.answered : [],
    };
  } catch {
    return null;
  }
}

function restart() {
  if (!confirm('Clear every answer and start a new assessment?')) return;
  state = { values: emptyValues(), currentId: STEPS[0].id, answered: [] };
  answered = new Set();
  persist();
  goTo(STEPS[0].id, 'back');
}

/* --------------------------------------------------------------- export */

function exportJson() {
  const result = score(state.values);
  const payload = {
    exportedAt: new Date().toISOString(),
    values: state.values,
    result: {
      total: result.total,
      zone: result.zone.id,
      domains: result.domains,
      subRisks: result.subRisks,
      flags: result.flags,
      completeness: result.completeness,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `hf-assessment-${state.values.patientId || 'unnamed'}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importJson(file) {
  file.text().then((raw) => {
    const parsed = JSON.parse(raw);
    state.values = { ...emptyValues(), ...(parsed.values ?? parsed) };
    answered = new Set(Object.keys(state.values));
    goTo('result', 'forward');
  }).catch(() => alert('That file could not be read as a saved assessment.'));
}

function loadSample() {
  state.values = {
    ...emptyValues(),
    patientName: 'Sample Patient', patientId: 'DEMO-001',
    visitDate: new Date().toISOString().slice(0, 10),
    age: '68', sex: 'male', heightCm: '168', weightKg: '82',
    priorHHF: true, pciCabg: true, device: 'none', valvularHD: false,
    cardiomyopathy: 'ischemic',
    htn: true, dm: true, ckd: true, af: true,
    nyha: '3', fatigability: true, swelling: true, sleep: true, appetite: true,
    pedalOedema: 'moderate', afDocumented: true,
    sbp: '104', dbp: '68', hr: '96', fluctuatingBP: true,
    hb: '10.8', totalCholesterol: '186', creatinine: '1.6', uacr: '120',
    sodium: '132', potassium: '5.1', uricAcid: '8.2', hba1c: '8.4',
    tsh: '3.1', ntprobnp: '3400',
    cardiomegaly: true, ef: '30', mr: 'moderate', tr: 'mild',
    laSize: '47', qrs: '142', rhythm: 'af', lbbb: false,
    hhfLastYear: '2',
    renin: true, betaBlocker: true,
  };
  answered = new Set(Object.keys(state.values));
  goTo('result', 'forward');
}

/* --------------------------------------------------------------- events */

primaryButton.addEventListener('click', next);
backButton.addEventListener('click', () => step(-1));

document.addEventListener('keydown', (event) => {
  if (sheet.open) {
    if (event.key === 'Escape') sheet.close();
    return;
  }
  const stepDef = currentStep();
  if (event.key === 'Enter' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'TEXTAREA') {
    event.preventDefault();
    next();
    return;
  }
  // Letter keys pick an option, the way the badges suggest.
  if (/^[a-z]$/i.test(event.key) && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
    const options = [...stage.querySelectorAll('.option')];
    const target = options[event.key.toLowerCase().charCodeAt(0) - 97];
    if (target) target.click();
  }
});

document.getElementById('btn-menu').addEventListener('click', () => sheet.showModal());
sheet.addEventListener('click', (event) => { if (event.target === sheet) sheet.close(); });
document.getElementById('menu-close').addEventListener('click', () => sheet.close());
document.getElementById('menu-result').addEventListener('click', () => { sheet.close(); goTo('result', 'forward'); });
document.getElementById('menu-restart').addEventListener('click', () => { sheet.close(); restart(); });
document.getElementById('menu-export').addEventListener('click', () => { sheet.close(); exportJson(); });
document.getElementById('menu-sample').addEventListener('click', () => { sheet.close(); loadSample(); });

const fileInput = document.getElementById('file-import');
document.getElementById('menu-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) importJson(file);
  fileInput.value = '';
});

render();
