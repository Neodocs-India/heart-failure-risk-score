/** UI layer: renders the form from the schema and re-scores on every change. */

import { SECTIONS, PATIENT_FIELDS, emptyValues } from './schema.js';
import { score, followUpDate, bmiOf } from './scoring.js';

const STORAGE_KEY = 'hf-app.draft.v1';
const form = document.getElementById('hf-form');
const patientGrid = document.getElementById('patient-fields');

let values = loadDraft() ?? emptyValues();

/* --------------------------------------------------------------- render */

function fieldNode(field) {
  const wrap = document.createElement('div');
  wrap.className = field.type === 'bool' ? 'field field-bool' : 'field';

  const inputId = `f-${field.id}`;
  const label = document.createElement('label');
  label.htmlFor = inputId;
  label.textContent = field.unit ? `${field.label} (${field.unit})` : field.label;

  let input;
  if (field.type === 'select') {
    input = document.createElement('select');
    for (const [value, text] of field.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.appendChild(option);
    }
  } else {
    input = document.createElement('input');
    input.type = field.type === 'bool' ? 'checkbox'
      : field.type === 'number' ? 'number'
      : field.type === 'date' ? 'date' : 'text';
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.step !== undefined) input.step = field.step;
    if (field.placeholder) input.placeholder = field.placeholder;
  }
  input.id = inputId;
  input.name = field.id;
  input.dataset.fieldId = field.id;

  if (field.type === 'bool') {
    wrap.append(input, label);
  } else {
    wrap.append(label, input);
    if (field.ref) {
      const ref = document.createElement('span');
      ref.className = 'ref';
      ref.textContent = `Normal: ${field.ref}`;
      wrap.appendChild(ref);
    }
  }
  return wrap;
}

function renderForm() {
  for (const field of PATIENT_FIELDS) patientGrid.appendChild(fieldNode(field));

  for (const section of SECTIONS) {
    const card = document.createElement('section');
    card.className = 'card';
    card.id = `section-${section.id}`;

    const head = document.createElement('div');
    head.className = 'card-head';
    const title = document.createElement('h2');
    title.textContent = section.title;
    const badge = document.createElement('span');
    badge.className = 'section-score';
    badge.id = `section-score-${section.id}`;
    badge.textContent = `0 / ${section.max}`;
    head.append(title, badge);
    card.appendChild(head);

    if (section.note) {
      const note = document.createElement('p');
      note.className = 'section-note';
      note.textContent = section.note;
      card.appendChild(note);
    }

    const grid = document.createElement('div');
    grid.className = 'field-grid';
    for (const field of section.fields) grid.appendChild(fieldNode(field));

    if (section.id === 'history') {
      const bmi = document.createElement('p');
      bmi.className = 'bmi-readout';
      bmi.id = 'bmi-readout';
      grid.appendChild(bmi);
    }

    card.appendChild(grid);
    form.appendChild(card);
  }
}

/* --------------------------------------------------------- form <-> state */

function writeToForm() {
  for (const [id, value] of Object.entries(values)) {
    const input = form.querySelector(`[data-field-id="${CSS.escape(id)}"]`);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value ?? '';
  }
}

function readFromForm() {
  for (const input of form.querySelectorAll('[data-field-id]')) {
    values[input.dataset.fieldId] = input.type === 'checkbox' ? input.checked : input.value;
  }
}

/* ------------------------------------------------------------- results */

const ZONE_COLOR = {
  green: 'var(--green)', yellow: 'var(--yellow)',
  orange: 'var(--orange)', red: 'var(--red)',
};

function colorForPercent(percent) {
  if (percent >= 65) return 'var(--red)';
  if (percent >= 45) return 'var(--orange)';
  if (percent >= 25) return 'var(--yellow)';
  return 'var(--green)';
}

function bar(percent) {
  const outer = document.createElement('div');
  outer.className = 'bar';
  const fill = document.createElement('span');
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  fill.style.background = colorForPercent(percent);
  outer.appendChild(fill);
  return outer;
}

function renderResult(result) {
  document.getElementById('score-total').textContent = result.total;

  const badge = document.getElementById('zone-badge');
  badge.textContent = `${result.zone.label} zone`;
  badge.className = `zone-badge ${result.zone.id}`;
  document.getElementById('zone-summary').textContent = result.zone.summary;
  document.getElementById('zone-marker').style.left = `${result.total}%`;

  const c = result.completeness;
  document.getElementById('completeness').textContent =
    `Data completeness ${c.percent}% (${c.filled}/${c.total} key inputs)`;

  const bmi = bmiOf(values);
  document.getElementById('bmi-readout').textContent =
    bmi === null ? 'Enter height and weight to calculate BMI.' : `BMI ${bmi.toFixed(1)} kg/m²`;

  for (const section of SECTIONS) {
    const domain = result.domains[section.id];
    document.getElementById(`section-score-${section.id}`).textContent =
      `${domain.points} / ${domain.max}`;
  }

  const subRisks = document.getElementById('sub-risks');
  subRisks.replaceChildren(...result.subRisks.map((risk) => {
    const row = document.createElement('div');
    row.className = 'subrisk';
    const top = document.createElement('div');
    top.className = 'subrisk-top';
    top.innerHTML = `<span></span><b></b>`;
    top.firstChild.textContent = risk.label;
    top.lastChild.textContent = `${risk.value}%`;
    row.append(top, bar(risk.value));
    return row;
  }));

  const flagsCard = document.getElementById('flags-card');
  const flagList = document.getElementById('flags');
  flagsCard.hidden = result.flags.length === 0;
  flagList.replaceChildren(...result.flags.map((flag) => {
    const li = document.createElement('li');
    li.className = flag.level;
    li.textContent = flag.text;
    return li;
  }));

  const domains = document.getElementById('domains');
  domains.replaceChildren(...SECTIONS.map((section) => {
    const domain = result.domains[section.id];
    const row = document.createElement('div');
    row.className = 'domain-row';
    const top = document.createElement('div');
    top.className = 'domain-top';
    top.innerHTML = '<span></span><span></span>';
    top.firstChild.textContent = section.title;
    top.lastChild.textContent = `${domain.points} / ${domain.max}`;
    row.append(top, bar(domain.percent));
    return row;
  }));

  renderBreakdown(result);
  renderReminder(result);
}

function renderBreakdown(result) {
  const container = document.getElementById('breakdown');
  container.replaceChildren(...SECTIONS.map((section) => {
    const group = document.createElement('div');
    group.className = 'breakdown-group';
    const heading = document.createElement('h3');
    heading.textContent = section.title;
    group.appendChild(heading);
    for (const item of result.items.filter((i) => i.domain === section.id)) {
      const row = document.createElement('div');
      row.className = item.points === 0 ? 'breakdown-row zero' : 'breakdown-row';
      const left = document.createElement('span');
      left.textContent = item.label;
      if (item.detail) {
        const detail = document.createElement('em');
        detail.textContent = ` — ${item.detail}`;
        left.appendChild(detail);
      }
      const right = document.createElement('b');
      right.textContent = `${item.points} / ${item.max}`;
      row.append(left, right);
      group.appendChild(row);
    }
    return group;
  }));
}

function reminderMessage(result) {
  const due = followUpDate(result.zone).toISOString().slice(0, 10);
  const name = values.patientName || 'Patient';
  const lines = [
    `Dear ${name},`,
    '',
    `Your heart-failure risk assessment on ${values.visitDate || new Date().toISOString().slice(0, 10)}`,
    `scored ${result.total}/100 — ${result.zone.label} zone (${result.zone.summary}).`,
    '',
    `Please book your next review on or before ${due}.`,
  ];
  if (result.flags.length) {
    lines.push('', 'Points your clinician flagged:');
    for (const flag of result.flags) lines.push(`  • ${flag.text}`);
  }
  lines.push(
    '',
    'Continue your prescribed medicines, weigh yourself daily, and seek urgent',
    'care for breathlessness at rest, rapid weight gain or fainting.',
    '',
    '— Indian HF App',
  );
  return { text: lines.join('\n'), due };
}

function renderReminder(result) {
  const { text, due } = reminderMessage(result);
  document.getElementById('followup').textContent =
    `Next review due ${due} (${result.zone.followUpDays} days — ${result.zone.label} zone).`;
  document.getElementById('reminder-text').value = text;

  const mail = document.getElementById('btn-mail');
  const subject = `HF follow-up reminder — review due ${due}`;
  mail.href = `mailto:${encodeURIComponent(values.contactEmail || '')}`
    + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/* ------------------------------------------------------------ lifecycle */

function refresh() {
  renderResult(score(values));
  saveDraft();
}

function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    /* private mode or quota — the form still works, it just will not persist */
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...emptyValues(), ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- events */

form.addEventListener('input', () => { readFromForm(); refresh(); });
form.addEventListener('change', () => { readFromForm(); refresh(); });
form.addEventListener('submit', (event) => event.preventDefault());

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Clear the form and start a new assessment?')) return;
  values = emptyValues();
  writeToForm();
  refresh();
});

document.getElementById('btn-print').addEventListener('click', () => {
  document.querySelector('.breakdown').open = true;
  window.print();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const result = score(values);
  const payload = {
    exportedAt: new Date().toISOString(),
    values,
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
  link.download = `hf-assessment-${values.patientId || 'unnamed'}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

const fileInput = document.getElementById('file-import');
document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    values = { ...emptyValues(), ...(parsed.values ?? parsed) };
    writeToForm();
    refresh();
  } catch {
    alert('That file could not be read as a saved assessment.');
  }
  fileInput.value = '';
});

document.getElementById('btn-copy').addEventListener('click', async () => {
  const button = document.getElementById('btn-copy');
  const text = document.getElementById('reminder-text').value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    document.getElementById('reminder-text').select();
    document.execCommand('copy');
  }
  button.textContent = 'Copied';
  setTimeout(() => { button.textContent = 'Copy message'; }, 1500);
});

document.getElementById('btn-sample').addEventListener('click', () => {
  values = {
    ...emptyValues(),
    patientName: 'Sample Patient', patientId: 'DEMO-001',
    visitDate: new Date().toISOString().slice(0, 10),
    age: '68', sex: 'male', heightCm: '168', weightKg: '82',
    priorHHF: true, pciCabg: true, device: 'none', valvularHD: false,
    cardiomyopathy: 'ischemic',
    htn: true, dm: true, ckd: true, af: true,
    nyha: '3', fatigability: true, swelling: true, sleep: true, appetite: true,
    pedalOedema: 'moderate', ascites: false, afDocumented: true,
    sbp: '104', dbp: '68', hr: '96', fluctuatingBP: true,
    hb: '10.8', totalCholesterol: '186', creatinine: '1.6', uacr: '120',
    sodium: '132', potassium: '5.1', uricAcid: '8.2', hba1c: '8.4',
    tsh: '3.1', ntprobnp: '3400',
    cardiomegaly: true, ef: '30', mr: 'moderate', tr: 'mild',
    laSize: '47', qrs: '142', rhythm: 'af', lbbb: false,
    hhfLastYear: '2',
    renin: true, betaBlocker: true, sglt2i: false, mra: false, vaccination: false,
  };
  writeToForm();
  refresh();
});

renderForm();
writeToForm();
refresh();
