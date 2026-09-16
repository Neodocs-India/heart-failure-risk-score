/** Renders the final score screen shown at the end of the flow. */

import { SECTIONS } from './schema.js';
import { score, followUpDate, bmiOf } from './scoring.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function colorForPercent(percent) {
  if (percent >= 65) return 'var(--red)';
  if (percent >= 45) return 'var(--orange)';
  if (percent >= 25) return 'var(--yellow)';
  return 'var(--green)';
}

function bar(percent) {
  const outer = el('div', 'bar');
  const fill = el('span');
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  fill.style.background = colorForPercent(percent);
  outer.appendChild(fill);
  return outer;
}

function row(label, valueText, percent) {
  const wrap = el('div', 'meter-row');
  const top = el('div', 'meter-top');
  top.append(el('span', null, label), el('b', null, valueText));
  wrap.append(top, bar(percent));
  return wrap;
}

/** The reminder message and the date it is due. */
export function reminderMessage(values, result) {
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

/**
 * Build the result screen.
 * @param {object} values form values
 * @param {{onReview:Function, onRestart:Function, onExport:Function, onEdit:Function}} handlers
 */
export function renderResult(values, handlers) {
  const result = score(values);
  const screen = el('div', 'result-screen');

  /* ------------------------------------------------------------- score */
  const scoreCard = el('section', `panel score-panel ${result.zone.id}`);
  scoreCard.append(el('p', 'eyebrow', 'HF Risk Score'));

  const dial = el('div', 'score-dial');
  const value = el('div', 'score-value');
  value.append(el('span', 'score-number', String(result.total)), el('span', 'score-denom', '/100'));
  dial.append(value, el('div', `zone-pill ${result.zone.id}`, `${result.zone.label} zone`));
  scoreCard.appendChild(dial);

  const meter = el('div', 'zone-meter');
  const track = el('div', 'zone-track');
  for (const [zoneId, width] of [['green', 25], ['yellow', 20], ['orange', 20], ['red', 35]]) {
    const seg = el('span', `seg ${zoneId}`);
    seg.style.width = `${width}%`;
    track.appendChild(seg);
  }
  const marker = el('div', 'zone-marker');
  marker.style.left = `${result.total}%`;
  const scale = el('div', 'zone-scale');
  for (const tick of ['0', '25', '45', '65', '100']) scale.appendChild(el('span', null, tick));
  meter.append(track, marker, scale);
  scoreCard.append(meter, el('p', 'zone-summary', result.zone.summary));

  const bmi = bmiOf(values);
  const c = result.completeness;
  const meta = el('p', 'result-meta',
    `Data completeness ${c.percent}% (${c.filled}/${c.total} key inputs)${bmi === null ? '' : ` · BMI ${bmi.toFixed(1)}`}`);
  scoreCard.appendChild(meta);
  if (c.percent < 60) {
    scoreCard.appendChild(el('p', 'low-confidence',
      'Several key inputs are blank. Blanks score zero, so this total is likely an underestimate.'));
  }
  screen.appendChild(scoreCard);

  /* ------------------------------------------------------- action points */
  if (result.flags.length) {
    const panel = el('section', 'panel');
    panel.append(el('h2', null, 'Action points'));
    const list = el('ul', 'flag-list');
    for (const flag of result.flags) list.appendChild(el('li', flag.level, flag.text));
    panel.appendChild(list);
    screen.appendChild(panel);
  }

  /* ----------------------------------------------------------- sub-risks */
  const subPanel = el('section', 'panel');
  subPanel.append(el('h2', null, 'Outcome-specific risk'));
  for (const risk of result.subRisks) {
    subPanel.appendChild(row(risk.label, `${risk.value}%`, risk.value));
  }
  screen.appendChild(subPanel);

  /* ------------------------------------------------------------- domains */
  const domainPanel = el('section', 'panel');
  domainPanel.append(el('h2', null, 'Where the score came from'));
  for (const section of SECTIONS) {
    const domain = result.domains[section.id];
    domainPanel.appendChild(row(section.title, `${domain.points} / ${domain.max}`, domain.percent));
  }
  screen.appendChild(domainPanel);

  /* ------------------------------------------------------------ reminder */
  const { text, due } = reminderMessage(values, result);
  const reminderPanel = el('section', 'panel');
  reminderPanel.append(
    el('h2', null, 'Follow-up'),
    el('p', 'followup', `Next review due ${due} — ${result.zone.followUpDays} days (${result.zone.label} zone).`),
  );
  const textarea = el('textarea', 'reminder');
  textarea.rows = 8;
  textarea.readOnly = true;
  textarea.value = text;
  reminderPanel.appendChild(textarea);

  const reminderActions = el('div', 'button-row');
  const copyButton = el('button', 'btn ghost', 'Copy message');
  copyButton.type = 'button';
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      textarea.select();
      document.execCommand('copy');
    }
    copyButton.textContent = 'Copied';
    setTimeout(() => { copyButton.textContent = 'Copy message'; }, 1500);
  });
  const mail = el('a', 'btn ghost', 'E-mail');
  mail.href = `mailto:${encodeURIComponent(values.contactEmail || '')}`
    + `?subject=${encodeURIComponent(`HF follow-up reminder — review due ${due}`)}`
    + `&body=${encodeURIComponent(text)}`;
  reminderActions.append(copyButton, mail);
  reminderPanel.append(reminderActions,
    el('p', 'fine-print', 'Automated SMS or e-mail delivery needs a backend — this composes the message and the due date.'));
  screen.appendChild(reminderPanel);

  /* ----------------------------------------------------------- breakdown */
  const details = el('details', 'panel breakdown');
  details.appendChild(el('summary', null, 'Full score breakdown'));
  for (const section of SECTIONS) {
    const group = el('div', 'breakdown-group');
    group.appendChild(el('h3', null, section.title));
    for (const item of result.items.filter((i) => i.domain === section.id)) {
      const line = el('div', item.points === 0 ? 'breakdown-row zero' : 'breakdown-row');
      const left = el('span', null, item.label);
      if (item.detail) left.appendChild(el('em', null, ` — ${item.detail}`));
      line.append(left, el('b', null, `${item.points} / ${item.max}`));
      group.appendChild(line);
    }
    details.appendChild(group);
  }
  screen.appendChild(details);

  /* ------------------------------------------------------------- actions */
  const actions = el('div', 'result-actions');
  const button = (label, className, onClick) => {
    const node = el('button', `btn ${className}`, label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  };
  actions.append(
    button('Review answers', 'primary', handlers.onReview),
    button('Export JSON', 'ghost', handlers.onExport),
    button('Print', 'ghost', () => { details.open = true; window.print(); }),
    button('Start over', 'ghost danger', handlers.onRestart),
  );
  screen.appendChild(actions);

  screen.appendChild(el('p', 'fine-print disclaimer',
    'Not a medical device. The 100-point weighting is a transparent internal scheme, '
    + 'not a validated published model, and must be calibrated against local outcome '
    + 'data before clinical use. It does not replace clinical judgement.'));

  return screen;
}
