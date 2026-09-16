/**
 * Form definition for the Indian HF App.
 *
 * Every section below maps to one slide of the source specification
 * (History, Risk Factors, Symptoms, Signs, Lab Values, Radiological Values,
 * Frequency of HHF, Medication).  The form UI is rendered from this schema, and
 * `scoring.js` consumes the same field ids, so adding a field only needs an
 * entry here plus a rule in the scoring module.
 */

export const SECTIONS = [
  {
    id: 'history',
    title: 'History',
    max: 12,
    fields: [
      { id: 'age', label: 'Age', type: 'number', unit: 'years', min: 0, max: 120 },
      {
        id: 'sex', label: 'Sex', type: 'select',
        options: [['', '—'], ['male', 'Male'], ['female', 'Female'], ['other', 'Other']],
      },
      { id: 'heightCm', label: 'Height', type: 'number', unit: 'cm', min: 50, max: 250, step: 0.5 },
      { id: 'weightKg', label: 'Weight', type: 'number', unit: 'kg', min: 10, max: 300, step: 0.1 },
      { id: 'priorHHF', label: 'Prior hospitalisation for HF (ever)', type: 'bool' },
      { id: 'pciCabg', label: 'Previous PCI / CABG', type: 'bool' },
      {
        id: 'device', label: 'Implanted device', type: 'select',
        options: [['none', 'None'], ['pacemaker', 'Pacemaker'], ['icd', 'ICD'], ['crt', 'CRT-P'], ['crtd', 'CRT-D']],
      },
      { id: 'valvularHD', label: 'Valvular heart disease', type: 'bool' },
      {
        id: 'cardiomyopathy', label: 'Diagnosed cardiomyopathy', type: 'select',
        options: [
          ['none', 'None'], ['ischemic', 'Ischaemic'], ['dilated', 'Dilated'],
          ['hypertrophic', 'Hypertrophic'], ['restrictive', 'Restrictive'],
          ['peripartum', 'Peripartum'], ['other', 'Other'],
        ],
      },
    ],
  },
  {
    id: 'riskFactors',
    title: 'Risk Factors',
    max: 10,
    note: 'Obesity is scored from the BMI calculated in the History section.',
    fields: [
      { id: 'htn', label: 'Hypertension', type: 'bool' },
      { id: 'dm', label: 'Diabetes mellitus', type: 'bool' },
      { id: 'osa', label: 'Obstructive sleep apnoea', type: 'bool' },
      { id: 'ckd', label: 'Chronic kidney disease', type: 'bool' },
      { id: 'copd', label: 'COPD', type: 'bool' },
      { id: 'liverDisease', label: 'Liver disease', type: 'bool' },
      { id: 'af', label: 'Atrial fibrillation', type: 'bool' },
      { id: 'otherComorbidity', label: 'Other comorbidity', type: 'text', placeholder: 'Free text — recorded, not scored' },
    ],
  },
  {
    id: 'symptoms',
    title: 'Symptoms',
    max: 12,
    fields: [
      {
        id: 'nyha', label: 'NYHA functional class', type: 'select',
        options: [['', '—'], ['1', 'I — no limitation'], ['2', 'II — slight limitation'],
          ['3', 'III — marked limitation'], ['4', 'IV — symptoms at rest']],
      },
      { id: 'fatigability', label: 'Easy fatigability', type: 'bool' },
      { id: 'palpitations', label: 'Palpitations', type: 'bool' },
      { id: 'syncope', label: 'Syncope / vertigo', type: 'bool' },
      { id: 'cough', label: 'Chronic or night-time cough', type: 'bool' },
      { id: 'swelling', label: 'Abnormal swelling', type: 'bool' },
      { id: 'hemoptysis', label: 'Coughing of blood', type: 'bool' },
      { id: 'appetite', label: 'Reduced appetite', type: 'bool' },
      { id: 'sleep', label: 'Reduced sleep / orthopnoea', type: 'bool' },
    ],
  },
  {
    id: 'signs',
    title: 'Signs',
    max: 10,
    fields: [
      {
        id: 'pedalOedema', label: 'Pedal oedema', type: 'select',
        options: [['none', 'None'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']],
      },
      { id: 'ascites', label: 'Abdominal swelling / ascites', type: 'bool' },
      { id: 'afDocumented', label: 'Known AF (irregular pulse documented)', type: 'bool' },
      { id: 'sbp', label: 'Systolic BP', type: 'number', unit: 'mmHg', min: 50, max: 260 },
      { id: 'dbp', label: 'Diastolic BP', type: 'number', unit: 'mmHg', min: 30, max: 160 },
      { id: 'hr', label: 'Heart rate', type: 'number', unit: 'bpm', min: 20, max: 220 },
      { id: 'fluctuatingBP', label: 'Fluctuating BP between visits', type: 'bool' },
    ],
  },
  {
    id: 'labs',
    title: 'Lab Values',
    max: 20,
    note: 'Leave a field blank if the test was not done — blanks score zero and lower the completeness figure.',
    fields: [
      { id: 'hb', label: 'Haemoglobin', type: 'number', unit: 'g/dL', min: 2, max: 25, step: 0.1, ref: '13–17 (M) / 12–15 (F)' },
      { id: 'totalCholesterol', label: 'Total cholesterol', type: 'number', unit: 'mg/dL', min: 50, max: 500, ref: '< 200' },
      { id: 'creatinine', label: 'Creatinine', type: 'number', unit: 'mg/dL', min: 0.1, max: 20, step: 0.01, ref: '0.6–1.2' },
      { id: 'uacr', label: 'Urine albumin:creatinine ratio', type: 'number', unit: 'mg/g', min: 0, max: 5000, ref: '< 30' },
      { id: 'sodium', label: 'Sodium', type: 'number', unit: 'mmol/L', min: 100, max: 180, ref: '135–145' },
      { id: 'potassium', label: 'Potassium', type: 'number', unit: 'mmol/L', min: 1, max: 9, step: 0.1, ref: '3.5–5.0' },
      { id: 'uricAcid', label: 'Uric acid', type: 'number', unit: 'mg/dL', min: 0, max: 20, step: 0.1, ref: '3.5–7.0' },
      { id: 'hba1c', label: 'HbA1c', type: 'number', unit: '%', min: 3, max: 20, step: 0.1, ref: '< 5.7' },
      { id: 'tsh', label: 'TSH', type: 'number', unit: 'µIU/mL', min: 0, max: 100, step: 0.01, ref: '0.4–4.5' },
      { id: 'ntprobnp', label: 'NT-proBNP', type: 'number', unit: 'pg/mL', min: 0, max: 50000, ref: '< 125' },
    ],
  },
  {
    id: 'imaging',
    title: 'Radiological & ECG Values',
    max: 18,
    fields: [
      { id: 'cardiomegaly', label: 'Cardiomegaly on chest X-ray', type: 'bool' },
      { id: 'ef', label: 'Ejection fraction (ECHO)', type: 'number', unit: '%', min: 5, max: 80 },
      {
        id: 'mr', label: 'Mitral regurgitation', type: 'select',
        options: [['none', 'None / trivial'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']],
      },
      {
        id: 'tr', label: 'Tricuspid regurgitation', type: 'select',
        options: [['none', 'None / trivial'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']],
      },
      { id: 'laSize', label: 'LA size', type: 'number', unit: 'mm', min: 15, max: 90 },
      { id: 'qrs', label: 'QRS duration', type: 'number', unit: 'ms', min: 40, max: 300 },
      {
        id: 'rhythm', label: 'Rhythm', type: 'select',
        options: [['', '—'], ['sinus', 'Sinus'], ['af', 'Atrial fibrillation'], ['paced', 'Paced'], ['other', 'Other']],
      },
      { id: 'lbbb', label: 'LBBB morphology', type: 'bool' },
    ],
  },
  {
    id: 'hospitalisation',
    title: 'Hospitalisation for HF',
    max: 12,
    fields: [
      { id: 'hhfLastYear', label: 'Number of HF hospitalisations in the last year', type: 'number', min: 0, max: 12 },
      { id: 'lastAdmission', label: 'Date of most recent admission', type: 'date' },
    ],
  },
  {
    id: 'medication',
    title: 'Medication',
    max: 6,
    note: 'Scored as guideline-directed therapy gaps: points are added for pillars the patient is NOT on.',
    fields: [
      { id: 'renin', label: 'ARNI / ACE-i / ARB', type: 'bool' },
      { id: 'sglt2i', label: 'SGLT2 inhibitor', type: 'bool' },
      { id: 'betaBlocker', label: 'Beta blocker', type: 'bool' },
      { id: 'mra', label: 'MRA', type: 'bool' },
      { id: 'vericiguat', label: 'Vericiguat', type: 'bool' },
      { id: 'ivabradine', label: 'Ivabradine', type: 'bool' },
      { id: 'iron', label: 'Iron repletion', type: 'bool' },
      { id: 'vaccination', label: 'Influenza / pneumococcal vaccination', type: 'bool' },
    ],
  },
];

/** Patient identifiers kept outside the score. */
export const PATIENT_FIELDS = [
  { id: 'patientName', label: 'Patient name', type: 'text' },
  { id: 'patientId', label: 'Patient / UHID', type: 'text' },
  { id: 'visitDate', label: 'Visit date', type: 'date' },
  { id: 'contactEmail', label: 'Contact e-mail', type: 'text', placeholder: 'used for the follow-up reminder' },
];

export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

/** Blank form values, used on load and on reset. */
export function emptyValues() {
  const values = {};
  for (const field of [...ALL_FIELDS, ...PATIENT_FIELDS]) {
    if (field.type === 'bool') values[field.id] = false;
    else if (field.type === 'select') values[field.id] = field.options[0][0];
    else values[field.id] = '';
  }
  return values;
}
