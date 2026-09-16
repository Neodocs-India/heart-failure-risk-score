/**
 * Heart-failure risk scoring engine.
 *
 * The total is a 100-point composite split across the eight data domains of
 * the specification:
 *
 *   History 12 | Risk factors 10 | Symptoms 12 | Signs 10
 *   Labs 20    | Radiology/ECG 18 | HF hospitalisations 12 | Medication gaps 6
 *
 * Every rule returns an itemised contribution so the UI can show exactly why a
 * patient landed in a zone.  Blank inputs contribute zero and are counted
 * against data completeness rather than being imputed.
 *
 * The weights are a transparent, internally consistent scheme drawn from the
 * prognostic direction of each variable in routine HF practice.  They are NOT
 * a validated published model and must be calibrated against local outcome
 * data before clinical use.
 */

export const DOMAIN_MAX = {
  history: 12,
  riskFactors: 10,
  symptoms: 12,
  signs: 10,
  labs: 20,
  imaging: 18,
  hospitalisation: 12,
  medication: 6,
};

export const ZONES = [
  { id: 'green', label: 'Green', min: 0, max: 24, summary: 'Low risk — stable', followUpDays: 180 },
  { id: 'yellow', label: 'Yellow', min: 25, max: 44, summary: 'Moderate risk — watch', followUpDays: 90 },
  { id: 'orange', label: 'Orange', min: 45, max: 64, summary: 'High risk — optimise now', followUpDays: 30 },
  { id: 'red', label: 'Red', min: 65, max: 100, summary: 'Very high risk — urgent review', followUpDays: 7 },
];

/** Parse a form value into a finite number, or null when absent. */
export function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const bool = (value) => value === true || value === 'true' || value === 'on';

/**
 * Pick the points for the first matching threshold.
 * `bands` is ordered [[test, points, detail], ...].
 */
function pick(value, bands) {
  for (const [test, points, detail] of bands) {
    if (test(value)) return { points, detail };
  }
  return { points: 0, detail: null };
}

/** BMI in kg/m², or null when height or weight is missing. */
export function bmiOf(values) {
  const h = num(values.heightCm);
  const w = num(values.weightKg);
  if (!h || !w) return null;
  return w / ((h / 100) ** 2);
}

/**
 * Score one patient.
 * @param {Record<string, unknown>} values raw form values
 * @returns {{total:number, zone:object, domains:object, items:Array, completeness:object, subRisks:Array, flags:Array}}
 */
export function score(values) {
  const items = [];
  const add = (domain, label, points, max, detail) => {
    items.push({ domain, label, points, max, detail: detail ?? null });
  };

  // ---------------------------------------------------------------- History
  const age = num(values.age);
  const ageBand = pick(age, [
    [(v) => v === null, 0, null],
    [(v) => v >= 75, 3, '≥ 75 years'],
    [(v) => v >= 65, 2, '65–74 years'],
    [(v) => v >= 50, 1, '50–64 years'],
    [() => true, 0, '< 50 years'],
  ]);
  add('history', 'Age', ageBand.points, 3, ageBand.detail);
  add('history', 'Prior HF hospitalisation (ever)', bool(values.priorHHF) ? 2 : 0, 2);
  add('history', 'Previous PCI / CABG', bool(values.pciCabg) ? 2 : 0, 2);
  add('history', 'Implanted device', values.device && values.device !== 'none' ? 1 : 0, 1, values.device);
  add('history', 'Valvular heart disease', bool(values.valvularHD) ? 2 : 0, 2);
  const cmp = pick(values.cardiomyopathy, [
    [(v) => v === 'ischemic' || v === 'dilated', 2, null],
    [(v) => v === 'hypertrophic' || v === 'restrictive', 1.5, null],
    [(v) => v === 'peripartum' || v === 'other', 1, null],
    [() => true, 0, null],
  ]);
  add('history', 'Cardiomyopathy', cmp.points, 2, values.cardiomyopathy);

  // ----------------------------------------------------------- Risk factors
  add('riskFactors', 'Hypertension', bool(values.htn) ? 1 : 0, 1);
  add('riskFactors', 'Diabetes mellitus', bool(values.dm) ? 1.5 : 0, 1.5);
  const bmi = bmiOf(values);
  const bmiBand = pick(bmi, [
    [(v) => v === null, 0, null],
    [(v) => v >= 30, 1.5, `BMI ${bmi?.toFixed(1)} — obese`],
    [(v) => v >= 25, 0.75, `BMI ${bmi?.toFixed(1)} — overweight`],
    [() => true, 0, `BMI ${bmi?.toFixed(1)}`],
  ]);
  add('riskFactors', 'Obesity (BMI)', bmiBand.points, 1.5, bmiBand.detail);
  add('riskFactors', 'Obstructive sleep apnoea', bool(values.osa) ? 0.5 : 0, 0.5);
  add('riskFactors', 'Chronic kidney disease', bool(values.ckd) ? 2 : 0, 2);
  add('riskFactors', 'COPD', bool(values.copd) ? 1 : 0, 1);
  add('riskFactors', 'Liver disease', bool(values.liverDisease) ? 1 : 0, 1);
  add('riskFactors', 'Atrial fibrillation', bool(values.af) ? 1.5 : 0, 1.5);

  // --------------------------------------------------------------- Symptoms
  const nyha = num(values.nyha);
  const nyhaBand = pick(nyha, [
    [(v) => v === null, 0, 'not assessed'],
    [(v) => v >= 4, 4, 'class IV'],
    [(v) => v === 3, 3, 'class III'],
    [(v) => v === 2, 1.5, 'class II'],
    [() => true, 0, 'class I'],
  ]);
  add('symptoms', 'NYHA class', nyhaBand.points, 4, nyhaBand.detail);
  const symptomChecks = [
    ['fatigability', 'Easy fatigability'],
    ['palpitations', 'Palpitations'],
    ['syncope', 'Syncope / vertigo'],
    ['cough', 'Chronic / night-time cough'],
    ['swelling', 'Abnormal swelling'],
    ['hemoptysis', 'Coughing of blood'],
    ['appetite', 'Reduced appetite'],
    ['sleep', 'Reduced sleep / orthopnoea'],
  ];
  for (const [id, label] of symptomChecks) {
    add('symptoms', label, bool(values[id]) ? 1 : 0, 1);
  }

  // ------------------------------------------------------------------ Signs
  const oedema = pick(values.pedalOedema, [
    [(v) => v === 'severe', 3, null],
    [(v) => v === 'moderate', 2, null],
    [(v) => v === 'mild', 1, null],
    [() => true, 0, null],
  ]);
  add('signs', 'Pedal oedema', oedema.points, 3, values.pedalOedema);
  add('signs', 'Ascites / abdominal swelling', bool(values.ascites) ? 2 : 0, 2);
  add('signs', 'Known AF', bool(values.afDocumented) ? 1 : 0, 1);
  const sbp = num(values.sbp);
  const sbpBand = pick(sbp, [
    [(v) => v === null, 0, null],
    [(v) => v < 90, 2, `${sbp} mmHg — hypotensive`],
    [(v) => v < 100, 1.5, `${sbp} mmHg — low`],
    [(v) => v >= 140, 1, `${sbp} mmHg — uncontrolled`],
    [(v) => v < 120, 0.5, `${sbp} mmHg`],
    [() => true, 0, `${sbp} mmHg`],
  ]);
  add('signs', 'Systolic BP', sbpBand.points, 2, sbpBand.detail);
  add('signs', 'Fluctuating BP', bool(values.fluctuatingBP) ? 1 : 0, 1);
  const hr = num(values.hr);
  const hrBand = pick(hr, [
    [(v) => v === null, 0, null],
    [(v) => v >= 100, 1, `${hr} bpm — tachycardic`],
    [(v) => v >= 90, 0.5, `${hr} bpm`],
    [(v) => v < 50, 0.5, `${hr} bpm — bradycardic`],
    [() => true, 0, `${hr} bpm`],
  ]);
  add('signs', 'Heart rate', hrBand.points, 1, hrBand.detail);

  // ------------------------------------------------------------------- Labs
  const labRules = [
    ['hb', 'Haemoglobin', 2, [
      [(v) => v < 10, 2, 'severe anaemia'],
      [(v) => v < 12, 1, 'anaemia'],
    ]],
    ['totalCholesterol', 'Total cholesterol', 1, [
      [(v) => v > 240, 1, 'high'],
      [(v) => v < 120, 0.5, 'low — adverse in HF'],
      [(v) => v >= 200, 0.5, 'borderline'],
    ]],
    ['creatinine', 'Creatinine', 3, [
      [(v) => v > 2.0, 3, 'marked renal impairment'],
      [(v) => v >= 1.5, 2, 'renal impairment'],
      [(v) => v >= 1.2, 1, 'mild elevation'],
    ]],
    ['uacr', 'UACR', 1.5, [
      [(v) => v > 300, 1.5, 'macroalbuminuria'],
      [(v) => v >= 30, 0.75, 'microalbuminuria'],
    ]],
    ['sodium', 'Sodium', 3, [
      [(v) => v < 130, 3, 'significant hyponatraemia'],
      [(v) => v < 135, 2, 'hyponatraemia'],
    ]],
    ['potassium', 'Potassium', 1.5, [
      [(v) => v >= 5.5, 1.5, 'hyperkalaemia'],
      [(v) => v < 3.5, 1.5, 'hypokalaemia'],
      [(v) => v >= 5.0, 1, 'upper limit'],
    ]],
    ['uricAcid', 'Uric acid', 1, [
      [(v) => v > 9, 1, 'markedly raised'],
      [(v) => v > 7, 0.5, 'raised'],
    ]],
    ['hba1c', 'HbA1c', 1.5, [
      [(v) => v >= 9, 1.5, 'poor glycaemic control'],
      [(v) => v >= 7, 1, 'above target'],
    ]],
    ['tsh', 'TSH', 1, [
      [(v) => v > 10, 1, 'overt hypothyroidism range'],
      [(v) => v < 0.1, 1, 'suppressed'],
      [(v) => v > 4.5, 0.5, 'subclinical hypothyroidism range'],
    ]],
    ['ntprobnp', 'NT-proBNP', 4.5, [
      [(v) => v >= 10000, 4.5, 'very high'],
      [(v) => v >= 3000, 4, 'high'],
      [(v) => v >= 1000, 3, 'raised'],
      [(v) => v >= 125, 1.5, 'mildly raised'],
    ]],
  ];
  for (const [id, label, max, bands] of labRules) {
    const v = num(values[id]);
    const band = v === null
      ? { points: 0, detail: 'not entered' }
      : pick(v, [...bands, [() => true, 0, 'within range']]);
    add('labs', label, band.points, max, band.detail);
  }

  // --------------------------------------------------------- Radiology / ECG
  add('imaging', 'Cardiomegaly on CXR', bool(values.cardiomegaly) ? 2 : 0, 2);
  const ef = num(values.ef);
  const efBand = pick(ef, [
    [(v) => v === null, 0, 'not entered'],
    [(v) => v < 30, 5, `EF ${ef}% — severe LV dysfunction`],
    [(v) => v <= 40, 3.5, `EF ${ef}% — HFrEF`],
    [(v) => v < 50, 2, `EF ${ef}% — mildly reduced`],
    [() => true, 1, `EF ${ef}% — preserved`],
  ]);
  add('imaging', 'Ejection fraction', efBand.points, 5, efBand.detail);
  const regurg = (v, severeScore) => pick(v, [
    [(x) => x === 'severe', severeScore, null],
    [(x) => x === 'moderate', severeScore * 0.5, null],
    [(x) => x === 'mild', severeScore * 0.2, null],
    [() => true, 0, null],
  ]);
  const mr = regurg(values.mr, 3);
  add('imaging', 'Mitral regurgitation', mr.points, 3, values.mr);
  const tr = regurg(values.tr, 2.5);
  add('imaging', 'Tricuspid regurgitation', tr.points, 2.5, values.tr);
  const la = num(values.laSize);
  const laBand = pick(la, [
    [(v) => v === null, 0, 'not entered'],
    [(v) => v > 45, 2, `${la} mm — dilated`],
    [(v) => v >= 40, 1, `${la} mm — borderline`],
    [() => true, 0, `${la} mm`],
  ]);
  add('imaging', 'LA size', laBand.points, 2, laBand.detail);
  const qrs = num(values.qrs);
  const qrsBand = pick(qrs, [
    [(v) => v === null, 0, 'not entered'],
    [(v) => v >= 150, 2, `${qrs} ms — wide`],
    [(v) => v >= 120, 1.25, `${qrs} ms — prolonged`],
    [() => true, 0, `${qrs} ms`],
  ]);
  add('imaging', 'QRS duration', qrsBand.points, 2, qrsBand.detail);
  const rhythmBand = pick(values.rhythm, [
    [(v) => v === 'af', 1.5, null],
    [(v) => v === 'paced', 1, null],
    [() => true, 0, null],
  ]);
  add('imaging', 'Rhythm', rhythmBand.points, 1.5, values.rhythm || 'not entered');

  // -------------------------------------------------- HF hospitalisations
  const hhf = num(values.hhfLastYear);
  const hhfBand = pick(hhf, [
    [(v) => v === null, 0, 'not entered'],
    [(v) => v >= 3, 12, `${hhf} admissions`],
    [(v) => v === 2, 8.5, '2 admissions'],
    [(v) => v === 1, 5, '1 admission'],
    [() => true, 0, 'none'],
  ]);
  add('hospitalisation', 'HF hospitalisations in the last year', hhfBand.points, 12, hhfBand.detail);

  // ------------------------------------------------- Medication (GDMT gaps)
  const pillars = [
    ['renin', 'ARNI / ACE-i / ARB'],
    ['sglt2i', 'SGLT2 inhibitor'],
    ['betaBlocker', 'Beta blocker'],
    ['mra', 'MRA'],
  ];
  for (const [id, label] of pillars) {
    const onDrug = bool(values[id]);
    add('medication', `${label} gap`, onDrug ? 0 : 1.25, 1.25, onDrug ? 'on therapy' : 'not prescribed');
  }
  const hb = num(values.hb);
  const ironIndicated = hb !== null && hb < 12;
  add('medication', 'Iron repletion gap', ironIndicated && !bool(values.iron) ? 0.5 : 0, 0.5,
    ironIndicated ? (bool(values.iron) ? 'repleted' : 'anaemic, not repleted') : 'not indicated');
  add('medication', 'Vaccination gap', bool(values.vaccination) ? 0 : 0.5, 0.5,
    bool(values.vaccination) ? 'vaccinated' : 'not vaccinated');

  // ---------------------------------------------------------------- Totals
  const domains = {};
  for (const key of Object.keys(DOMAIN_MAX)) {
    domains[key] = { points: 0, max: DOMAIN_MAX[key] };
  }
  for (const item of items) {
    domains[item.domain].points += item.points;
  }
  for (const key of Object.keys(domains)) {
    domains[key].points = round(domains[key].points);
    domains[key].percent = domains[key].max ? (domains[key].points / domains[key].max) * 100 : 0;
  }

  const rawTotal = items.reduce((sum, item) => sum + item.points, 0);
  const total = Math.min(100, Math.max(0, Math.round(rawTotal)));
  const zone = ZONES.find((z) => total >= z.min && total <= z.max) ?? ZONES[ZONES.length - 1];

  return {
    total,
    rawTotal: round(rawTotal),
    zone,
    domains,
    items,
    bmi: bmi === null ? null : round(bmi, 1),
    completeness: completeness(values),
    subRisks: subRisks(values, domains, { ef, ntprobnp: num(values.ntprobnp), hhf, nyha, qrs }),
    flags: flags(values, { ef, qrs, nyha, hhf, sbp, hb }),
  };
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Share of scored inputs the user actually filled in. */
function completeness(values) {
  const tracked = [
    // Only fields that are genuinely blank until answered — selects that default
    // to a real value (e.g. pedal oedema "none") cannot be told apart from an
    // unanswered one, so they are not counted here.
    'age', 'sex', 'heightCm', 'weightKg', 'nyha', 'sbp', 'dbp', 'hr',
    'hb', 'totalCholesterol', 'creatinine', 'uacr', 'sodium', 'potassium', 'uricAcid',
    'hba1c', 'tsh', 'ntprobnp', 'ef', 'laSize', 'qrs', 'rhythm', 'hhfLastYear',
  ];
  const missing = tracked.filter((id) => {
    const v = values[id];
    return v === undefined || v === null || v === '';
  });
  return {
    filled: tracked.length - missing.length,
    total: tracked.length,
    percent: Math.round(((tracked.length - missing.length) / tracked.length) * 100),
    missing,
  };
}

/**
 * The four outcome-specific views from the specification, each normalised to
 * 0–100 from the subset of the composite that drives it.
 */
function subRisks(values, domains, ctx) {
  const { ef, ntprobnp, hhf, nyha, qrs } = ctx;

  const scale = (points, max) => (max <= 0 ? 0 : Math.round(Math.min(100, (points / max) * 100)));

  // Worsening HF — congestion and symptom burden now.
  const worsening = domains.symptoms.points + domains.signs.points
    + (ntprobnp !== null ? Math.min(4.5, ntprobnp / 2500) : 0)
    + domains.medication.points;
  const worseningMax = DOMAIN_MAX.symptoms + DOMAIN_MAX.signs + 4.5 + DOMAIN_MAX.medication;

  // Re-hospitalisation — history of admissions plus renal / natriuretic load.
  const reHF = domains.hospitalisation.points
    + (ntprobnp !== null ? Math.min(4.5, ntprobnp / 2500) : 0)
    + (ef !== null && ef <= 40 ? 3 : 0)
    + (bool(values.ckd) ? 2 : 0)
    + domains.medication.points;
  const reHFMax = DOMAIN_MAX.hospitalisation + 4.5 + 3 + 2 + DOMAIN_MAX.medication;

  // Revascularisation — ischaemic substrate.
  const revasc = (values.cardiomyopathy === 'ischemic' ? 4 : 0)
    + (bool(values.pciCabg) ? 3 : 0)
    + (bool(values.dm) ? 2 : 0)
    + (bool(values.htn) ? 1 : 0)
    + (num(values.totalCholesterol) !== null && num(values.totalCholesterol) > 200 ? 1 : 0)
    + (ef !== null && ef <= 40 ? 2 : 0);
  const revascMax = 13;

  // CRT — conduction disease with reduced EF.
  const crt = (ef !== null && ef <= 35 ? 4 : 0)
    + (qrs !== null && qrs >= 150 ? 4 : qrs !== null && qrs >= 130 ? 2 : 0)
    + (bool(values.lbbb) ? 2 : 0)
    + (nyha !== null && nyha >= 2 ? 2 : 0);
  const crtMax = 12;

  return [
    { id: 'worsening', label: 'Worsening HF', value: scale(worsening, worseningMax) },
    { id: 'reHF', label: 'Re-hospitalisation (Re-HF)', value: scale(reHF, reHFMax) },
    { id: 'revascularization', label: 'Revascularisation', value: scale(revasc, revascMax) },
    { id: 'crt', label: 'CRT candidacy', value: scale(crt, crtMax) },
  ];
}

/** Actionable one-line alerts shown above the breakdown. */
function flags(values, ctx) {
  const { ef, qrs, nyha, hhf, sbp, hb } = ctx;
  const out = [];
  const onAllPillars = ['renin', 'sglt2i', 'betaBlocker', 'mra'].every((id) => bool(values[id]));

  if (ef !== null && ef <= 35 && qrs !== null && qrs >= 130 && (nyha === null || nyha >= 2)
      && !['crt', 'crtd'].includes(values.device)) {
    out.push({ level: 'high', text: 'Meets the usual EF/QRS/NYHA profile for CRT — refer for device assessment.' });
  }
  if (ef !== null && ef <= 40 && !onAllPillars) {
    const missing = [['renin', 'ARNI/ACE-i/ARB'], ['sglt2i', 'SGLT2i'], ['betaBlocker', 'beta blocker'], ['mra', 'MRA']]
      .filter(([id]) => !bool(values[id])).map(([, label]) => label);
    out.push({ level: 'high', text: `HFrEF not on all four pillars — missing ${missing.join(', ')}.` });
  }
  if (hhf !== null && hhf >= 2) {
    out.push({ level: 'high', text: 'Two or more HF admissions in a year — consider advanced HF referral.' });
  }
  const sodium = num(values.sodium);
  if (sodium !== null && sodium < 130) {
    out.push({ level: 'high', text: 'Significant hyponatraemia — review diuretic strategy.' });
  }
  const potassium = num(values.potassium);
  if (potassium !== null && (potassium >= 5.5 || potassium < 3.5)) {
    out.push({ level: 'medium', text: 'Potassium outside range — recheck before titrating MRA/ARNI.' });
  }
  if (sbp !== null && sbp < 90) {
    out.push({ level: 'medium', text: 'Systolic BP below 90 mmHg — up-titration may not be tolerated.' });
  }
  if (hb !== null && hb < 12 && !bool(values.iron)) {
    out.push({ level: 'medium', text: 'Anaemia without iron repletion — check ferritin and TSAT.' });
  }
  const creatinine = num(values.creatinine);
  if (creatinine !== null && creatinine > 2.0) {
    out.push({ level: 'medium', text: 'Creatinine above 2.0 mg/dL — cardiorenal review.' });
  }
  return out;
}

/** Suggested next review date for the zone. */
export function followUpDate(zone, from = new Date()) {
  const date = new Date(from.getTime());
  date.setDate(date.getDate() + zone.followUpDays);
  return date;
}
