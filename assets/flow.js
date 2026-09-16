/**
 * The guided question flow.
 *
 * The app asks one thing at a time. A step is either a single question, a
 * tight cluster that belongs on one screen (height + weight, BP + pulse), a
 * "select all that apply" list, or a section divider.
 *
 * Field ids come from `schema.js`, which stays the single source of truth for
 * the input's type, units and range — a step only decides *when* a field is
 * asked and how the question is worded. `tests/flow.test.js` enforces that
 * every scored field appears in exactly one step, so a parameter can never be
 * silently dropped from the flow.
 */

import { ALL_FIELDS, PATIENT_FIELDS } from './schema.js';
import { num } from './scoring.js';

const BY_ID = new Map([...ALL_FIELDS, ...PATIENT_FIELDS].map((f) => [f.id, f]));

/** Look up a field definition, failing loudly on a typo. */
export function fieldById(id) {
  const field = BY_ID.get(id);
  if (!field) throw new Error(`Unknown field id in flow: ${id}`);
  return field;
}

export const STEPS = [
  { kind: 'welcome', id: 'welcome' },

  {
    kind: 'question', id: 'patient', section: 'Patient',
    title: 'Who is this assessment for?',
    hint: 'Optional — used only on the summary and the reminder message.',
    fields: ['patientName', 'patientId', 'visitDate'],
    optional: true,
  },

  /* ------------------------------------------------------------- History */
  {
    kind: 'section', id: 's-history', section: 'History',
    title: 'History', blurb: 'Age, past cardiac events and any known cardiomyopathy.',
  },
  {
    kind: 'question', id: 'q-age', section: 'History',
    title: 'How old is the patient?', fields: ['age'],
  },
  {
    kind: 'question', id: 'q-sex', section: 'History',
    title: 'Sex', fields: ['sex'],
  },
  {
    kind: 'question', id: 'q-body', section: 'History',
    title: 'Height and weight', hint: 'Used to calculate BMI.',
    fields: ['heightCm', 'weightKg'], optional: true, showBmi: true,
  },
  {
    kind: 'question', id: 'q-priorhhf', section: 'History',
    title: 'Has the patient ever been hospitalised for heart failure?',
    fields: ['priorHHF'],
  },
  {
    kind: 'question', id: 'q-pci', section: 'History',
    title: 'Any previous PCI or CABG?', fields: ['pciCabg'],
  },
  {
    kind: 'question', id: 'q-device', section: 'History',
    title: 'Does the patient have an implanted cardiac device?', fields: ['device'],
  },
  {
    kind: 'question', id: 'q-valve', section: 'History',
    title: 'Any valvular heart disease?', fields: ['valvularHD'],
  },
  {
    kind: 'question', id: 'q-cmp', section: 'History',
    title: 'Has a cardiomyopathy been diagnosed?', fields: ['cardiomyopathy'],
  },

  /* -------------------------------------------------------- Risk factors */
  {
    kind: 'section', id: 's-risk', section: 'Risk Factors',
    title: 'Risk factors', blurb: 'Comorbidities that change the outlook.',
  },
  {
    kind: 'multi', id: 'q-risk', section: 'Risk Factors',
    title: 'Which of these apply?', hint: 'Select all that apply — tap again to unselect.',
    fields: ['htn', 'dm', 'osa', 'ckd', 'copd', 'liverDisease', 'af'],
  },
  {
    kind: 'question', id: 'q-other', section: 'Risk Factors',
    title: 'Any other significant comorbidity?',
    hint: 'Recorded on the summary, not scored.',
    fields: ['otherComorbidity'], optional: true,
  },

  /* ------------------------------------------------------------ Symptoms */
  {
    kind: 'section', id: 's-symptoms', section: 'Symptoms',
    title: 'Symptoms', blurb: 'What the patient feels day to day.',
  },
  {
    kind: 'question', id: 'q-nyha', section: 'Symptoms',
    title: 'How limited is the patient by symptoms?',
    hint: 'NYHA functional class.', fields: ['nyha'],
  },
  {
    kind: 'multi', id: 'q-symptoms', section: 'Symptoms',
    title: 'Which symptoms are present?', hint: 'Select all that apply.',
    fields: ['fatigability', 'palpitations', 'syncope', 'cough', 'swelling',
      'hemoptysis', 'appetite', 'sleep'],
  },

  /* --------------------------------------------------------------- Signs */
  {
    kind: 'section', id: 's-signs', section: 'Signs',
    title: 'Signs', blurb: 'Examination findings and today’s vitals.',
  },
  {
    kind: 'question', id: 'q-oedema', section: 'Signs',
    title: 'How much pedal oedema?', fields: ['pedalOedema'],
  },
  {
    kind: 'multi', id: 'q-signs', section: 'Signs',
    title: 'Any of these findings?', hint: 'Select all that apply.',
    fields: ['ascites', 'afDocumented', 'fluctuatingBP'],
  },
  {
    kind: 'question', id: 'q-vitals', section: 'Signs',
    title: 'Blood pressure and pulse', fields: ['sbp', 'dbp', 'hr'], optional: true,
  },

  /* ---------------------------------------------------------------- Labs */
  {
    kind: 'section', id: 's-labs', section: 'Lab Values',
    title: 'Lab values', blurb: 'Leave anything that was not tested blank — blanks are never guessed.',
  },
  {
    kind: 'question', id: 'q-bnp', section: 'Lab Values',
    title: 'NT-proBNP', hint: 'The single strongest input in the score.',
    fields: ['ntprobnp'], optional: true,
  },
  {
    kind: 'question', id: 'q-blood', section: 'Lab Values',
    title: 'Haemoglobin and cholesterol', fields: ['hb', 'totalCholesterol'], optional: true,
  },
  {
    kind: 'question', id: 'q-renal', section: 'Lab Values',
    title: 'Renal function', fields: ['creatinine', 'uacr'], optional: true,
  },
  {
    kind: 'question', id: 'q-electrolytes', section: 'Lab Values',
    title: 'Electrolytes and uric acid', fields: ['sodium', 'potassium', 'uricAcid'], optional: true,
  },
  {
    kind: 'question', id: 'q-metabolic', section: 'Lab Values',
    title: 'HbA1c and thyroid', fields: ['hba1c', 'tsh'], optional: true,
  },

  /* ----------------------------------------------------- Radiology / ECG */
  {
    kind: 'section', id: 's-imaging', section: 'Radiological & ECG Values',
    title: 'Imaging & ECG', blurb: 'Chest X-ray, echo and the resting ECG.',
  },
  {
    kind: 'question', id: 'q-ef', section: 'Radiological & ECG Values',
    title: 'What is the ejection fraction?', hint: 'From the most recent echo.',
    fields: ['ef'], optional: true,
  },
  {
    kind: 'question', id: 'q-cxr', section: 'Radiological & ECG Values',
    title: 'Cardiomegaly on the chest X-ray?', fields: ['cardiomegaly'],
  },
  {
    kind: 'question', id: 'q-mr', section: 'Radiological & ECG Values',
    title: 'Mitral regurgitation', fields: ['mr'],
  },
  {
    kind: 'question', id: 'q-tr', section: 'Radiological & ECG Values',
    title: 'Tricuspid regurgitation', fields: ['tr'],
  },
  {
    kind: 'question', id: 'q-la', section: 'Radiological & ECG Values',
    title: 'LA size and QRS duration', fields: ['laSize', 'qrs'], optional: true,
  },
  {
    kind: 'question', id: 'q-rhythm', section: 'Radiological & ECG Values',
    title: 'What is the rhythm?', fields: ['rhythm'],
  },
  {
    kind: 'question', id: 'q-lbbb', section: 'Radiological & ECG Values',
    title: 'Is there LBBB morphology?',
    hint: 'Asked because the QRS is 110 ms or wider.',
    fields: ['lbbb'],
    when: (values) => {
      const qrs = num(values.qrs);
      return qrs === null || qrs >= 110;
    },
  },

  /* ------------------------------------------------------ Hospitalisation */
  {
    kind: 'section', id: 's-hhf', section: 'Hospitalisation for HF',
    title: 'Hospitalisation', blurb: 'Admissions for heart failure in the last 12 months.',
  },
  {
    kind: 'question', id: 'q-hhf', section: 'Hospitalisation for HF',
    title: 'How many times has the patient been admitted for HF in the last year?',
    fields: ['hhfLastYear'],
    quick: [['0', 'None'], ['1', 'Once'], ['2', 'Twice'], ['3', '3 or more']],
  },
  {
    kind: 'question', id: 'q-lastadm', section: 'Hospitalisation for HF',
    title: 'When was the most recent admission?',
    fields: ['lastAdmission'], optional: true,
    when: (values) => (num(values.hhfLastYear) ?? 0) > 0,
  },

  /* ---------------------------------------------------------- Medication */
  {
    kind: 'section', id: 's-meds', section: 'Medication',
    title: 'Medication', blurb: 'Points are added for guideline therapies the patient is missing, so optimising treatment lowers the score.',
  },
  {
    kind: 'multi', id: 'q-pillars', section: 'Medication',
    title: 'Which of the four pillars is the patient on?',
    hint: 'Select every drug class currently prescribed.',
    fields: ['renin', 'sglt2i', 'betaBlocker', 'mra'],
  },
  {
    kind: 'multi', id: 'q-adjunct', section: 'Medication',
    title: 'And any of these?', hint: 'Select all that apply.',
    fields: ['vericiguat', 'ivabradine', 'iron', 'vaccination'],
  },
  {
    kind: 'question', id: 'q-email', section: 'Medication',
    title: 'Where should the follow-up reminder go?',
    hint: 'Optional — leave blank to skip the reminder e-mail.',
    fields: ['contactEmail'], optional: true,
  },

  { kind: 'result', id: 'result' },
];

/** Steps currently reachable, honouring each step's `when` condition. */
export function visibleSteps(values) {
  return STEPS.filter((step) => !step.when || step.when(values));
}

/** Steps the progress indicator counts — dividers and the result do not. */
export function countableSteps(values) {
  return visibleSteps(values).filter((step) => step.kind === 'question' || step.kind === 'multi');
}

/** Position of a step for "Question 7 of 32", or null when it is not counted. */
export function progressOf(stepId, values) {
  const countable = countableSteps(values);
  const index = countable.findIndex((step) => step.id === stepId);
  if (index === -1) return null;
  return { position: index + 1, total: countable.length };
}
