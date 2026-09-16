# Indian HF App — Heart Failure Risk Calculator

A single-page form that collects the heart-failure parameters laid out in the
`HF_App` specification and turns them into a 100-point risk score with a
Green / Yellow / Orange / Red zone, outcome-specific sub-risks, action points
and a follow-up reminder message.

No build step, no backend, no dependencies — open `index.html` in a browser, or
serve the folder:

```sh
npm run serve      # http://localhost:8080
npm test           # scoring engine unit tests (node --test)
```

## What it captures

Each section of the form is one slide of the specification:

| Section | Inputs | Weight |
|---|---|---|
| History | Age, sex, height/weight (BMI), prior HF hospitalisation, PCI/CABG, implanted device, valvular HD, cardiomyopathy | 12 |
| Risk factors | HTN, DM, obesity, OSA, CKD, COPD, liver disease, AF, free-text other | 10 |
| Symptoms | NYHA class + the eight symptoms from the deck | 12 |
| Signs | Pedal oedema, ascites, known AF, SBP/DBP/HR, fluctuating BP | 10 |
| Lab values | Hb, total cholesterol, creatinine, UACR, Na, K, uric acid, HbA1c, TSH, NT-proBNP | 20 |
| Radiological & ECG | Cardiomegaly on CXR, EF, MR, TR, LA size, QRS, rhythm, LBBB | 18 |
| HF hospitalisation | Admissions in the last year, date of the most recent one | 12 |
| Medication | ARNI/ACE-i/ARB, SGLT2i, beta blocker, MRA, vericiguat, ivabradine, iron, vaccination | 6 |

The weights add up to exactly 100, and a unit test enforces that — both across
domains and item-by-item within each domain.

Two fields go beyond the deck because the score is weaker without them: **NYHA
class** (symptom severity) and **QRS duration / LBBB** (without them CRT
candidacy cannot be assessed).

## How the score behaves

- **Medication is scored as a gap.** Points are added for guideline-directed
  pillars the patient is *not* on, so optimising therapy lowers the score. Iron
  only counts as a gap when Hb < 12 g/dL.
- **Blank means blank.** A missing lab scores zero and is never imputed;
  instead the panel reports data completeness, so a low score on a
  three-quarters-empty form is visibly a low-confidence score.
- **Zones:** Green 0–24 (review in 180 days), Yellow 25–44 (90 days),
  Orange 45–64 (30 days), Red 65–100 (7 days).
- **Sub-risks** (0–100 each), from the calculator slide: worsening HF,
  re-hospitalisation, revascularisation, CRT candidacy.
- **Action points** fire on the things worth doing something about today —
  a CRT-eligible profile without a device, HFrEF missing pillars, ≥ 2 admissions
  in a year, hyponatraemia, potassium out of range, SBP < 90, untreated
  anaemia, creatinine > 2.0.

Every contribution is itemised under *Full score breakdown*, so any total can be
traced back to the inputs that produced it.

## Saving and sharing

Entries are kept in `localStorage` as you type. *Export JSON* writes the values
plus the computed result to a file, *Import JSON* reads one back, and *Print*
produces a one-patient summary with the breakdown expanded.

## Not built yet

Two items in the specification need a backend and are deliberately out of scope
for this static app:

- **Rx upload with AI parsing** — the medication section is manual checkboxes.
  Parsing an uploaded prescription needs a server-side OCR/LLM step.
- **Automated reminder delivery** — the app composes the reminder text and the
  due date and offers copy / `mailto:`, but sending SMS or e-mail on a schedule
  needs a server and a messaging provider.

## Layout

```
index.html          markup and the result panel
assets/schema.js    field definitions — the form is rendered from this
assets/scoring.js   scoring engine (pure, no DOM, unit-tested)
assets/app.js       rendering, state, export/import, reminders
assets/styles.css   styling, including print rules
tests/              node --test suite for the scoring engine
```

Adding a parameter means one entry in `schema.js` and one rule in `scoring.js`.

## Disclaimer

**This is not a medical device.** The 100-point weighting is a transparent,
internally consistent scheme reflecting the prognostic direction of each
variable in routine HF practice — it is **not** a validated published model
such as MAGGIC or the Seattle Heart Failure Model. Calibrate it against local
outcome data before any clinical use. It does not replace clinical judgement.
