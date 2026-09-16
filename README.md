# Indian HF App — Heart Failure Risk Calculator

A mobile-first, guided questionnaire that collects the heart-failure parameters
laid out in the `HF_App` specification and turns them into a 100-point risk
score with a Green / Yellow / Orange / Red zone, outcome-specific sub-risks,
action points and a follow-up reminder.

Questions are asked **one screen at a time** — a single question, or a tight
cluster that belongs together (height + weight, BP + pulse). Choices are large
tap targets that advance by themselves; long checklists become one
"select all that apply" screen. The score appears only at the end.

No build step, no backend, no dependencies — open `index.html` in a browser, or
serve the folder:

```sh
npm run serve      # http://localhost:8080
npm test           # scoring + flow unit tests (node --test)
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

## The flow

33 question screens, plus a short divider before each section so the user knows
where they are. Two are conditional: the date of the last admission is only
asked once an admission is recorded, and LBBB is skipped once a narrow QRS has
been entered — the progress denominator follows suit.

- **Nothing is mandatory.** The primary button reads *Skip* on an optional
  question left blank, so a lab panel that was never ordered costs four taps.
- **Numbers are range-checked** before the screen advances, so a mistyped
  age of 400 is refused rather than scored.
- **Answers persist as you go** (`localStorage`), so a reload or a lock screen
  resumes on the same question.
- **Keyboard works too**: `Enter` advances, and letter keys pick the lettered
  options — useful when the same clinician enters many patients at a desk.
- The `⋮` menu jumps straight to the score, loads a sample patient, exports or
  imports answers as JSON, or starts over.

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

Answers are kept in `localStorage` as you go. From the menu, *Export JSON*
writes the values plus the computed result to a file and *Import JSON* reads one
back (jumping straight to its score). On the result screen, *Print* produces a
one-patient summary with the breakdown expanded.

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
index.html          app shell — app bar, stage, footer, menu sheet
assets/schema.js    field definitions: type, units, ranges
assets/flow.js      the question flow: what is asked, when, and how it is worded
assets/scoring.js   scoring engine (pure, no DOM, unit-tested)
assets/app.js       flow controller — rendering, navigation, state
assets/result.js    the final score screen
assets/styles.css   mobile-first styling, dark mode and print rules
tests/              node --test suites for the scoring engine and the flow
```

Adding a parameter means one entry in `schema.js`, one rule in `scoring.js`, and
one step in `flow.js`. A test asserts that every scored field is asked exactly
once, so a parameter cannot be silently dropped from the questionnaire.

## Disclaimer

**This is not a medical device.** The 100-point weighting is a transparent,
internally consistent scheme reflecting the prognostic direction of each
variable in routine HF practice — it is **not** a validated published model
such as MAGGIC or the Seattle Heart Failure Model. Calibrate it against local
outcome data before any clinical use. It does not replace clinical judgement.
