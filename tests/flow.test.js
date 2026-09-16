import test from 'node:test';
import assert from 'node:assert/strict';

import { STEPS, visibleSteps, countableSteps, progressOf, fieldById } from '../assets/flow.js';
import { ALL_FIELDS, PATIENT_FIELDS, emptyValues } from '../assets/schema.js';

const questionSteps = STEPS.filter((s) => s.kind === 'question' || s.kind === 'multi');
const askedIds = questionSteps.flatMap((step) => step.fields);

test('every scored field is asked somewhere in the flow', () => {
  const missing = ALL_FIELDS.map((f) => f.id).filter((id) => !askedIds.includes(id));
  assert.deepEqual(missing, [], `fields never asked: ${missing.join(', ')}`);
});

test('no field is asked on two different steps', () => {
  const seen = new Set();
  const duplicates = askedIds.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  assert.deepEqual(duplicates, []);
});

test('every step references fields that exist in the schema', () => {
  for (const step of questionSteps) {
    for (const id of step.fields) assert.doesNotThrow(() => fieldById(id), `${step.id} -> ${id}`);
  }
});

test('contact e-mail is collected so the reminder has somewhere to go', () => {
  assert.ok(askedIds.includes('contactEmail'));
  const patientAsked = PATIENT_FIELDS.map((f) => f.id).filter((id) => askedIds.includes(id));
  assert.ok(patientAsked.length >= 3);
});

test('the flow opens on a welcome step and ends on the result', () => {
  assert.equal(STEPS[0].kind, 'welcome');
  assert.equal(STEPS[STEPS.length - 1].kind, 'result');
  assert.equal(STEPS.filter((s) => s.kind === 'result').length, 1);
});

test('step ids are unique', () => {
  const ids = STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('multi steps only ever hold yes/no fields', () => {
  for (const step of STEPS.filter((s) => s.kind === 'multi')) {
    for (const id of step.fields) {
      assert.equal(fieldById(id).type, 'bool', `${step.id} -> ${id} is not a bool`);
    }
  }
});

test('every question step carries a section label and a title', () => {
  for (const step of questionSteps) {
    assert.ok(step.section, `${step.id} has no section`);
    assert.ok(step.title, `${step.id} has no title`);
  }
});

test('the admission-date question only appears after an admission is recorded', () => {
  const blank = emptyValues();
  const ids = (values) => visibleSteps(values).map((s) => s.id);

  assert.ok(!ids(blank).includes('q-lastadm'));
  assert.ok(!ids({ ...blank, hhfLastYear: '0' }).includes('q-lastadm'));
  assert.ok(ids({ ...blank, hhfLastYear: '2' }).includes('q-lastadm'));
});

test('LBBB is skipped once a narrow QRS has been entered', () => {
  const blank = emptyValues();
  const ids = (values) => visibleSteps(values).map((s) => s.id);

  assert.ok(ids(blank).includes('q-lbbb'), 'asked while QRS is unknown');
  assert.ok(ids({ ...blank, qrs: '140' }).includes('q-lbbb'));
  assert.ok(!ids({ ...blank, qrs: '88' }).includes('q-lbbb'));
});

test('progress counts only real questions and stays in range', () => {
  const values = emptyValues();
  const countable = countableSteps(values);
  assert.ok(countable.every((s) => s.kind === 'question' || s.kind === 'multi'));

  for (const step of countable) {
    const progress = progressOf(step.id, values);
    assert.ok(progress.position >= 1 && progress.position <= progress.total);
    assert.equal(progress.total, countable.length);
  }
  assert.equal(progressOf('welcome', values), null);
  assert.equal(progressOf('result', values), null);
});

test('the questionnaire stays short enough to finish in one sitting', () => {
  assert.ok(countableSteps(emptyValues()).length <= 35,
    `${countableSteps(emptyValues()).length} question screens is too many`);
});

test('conditional steps change the denominator rather than leaving a gap', () => {
  const withAdmission = countableSteps({ ...emptyValues(), hhfLastYear: '2' }).length;
  const without = countableSteps({ ...emptyValues(), hhfLastYear: '0' }).length;
  assert.equal(withAdmission, without + 1);
});
