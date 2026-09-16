import test from 'node:test';
import assert from 'node:assert/strict';

import { score, followUpDate, num, bmiOf, DOMAIN_MAX, ZONES } from '../assets/scoring.js';
import { SECTIONS, emptyValues } from '../assets/schema.js';

/** A high-risk patient used across several assertions. */
const severe = {
  ...emptyValues(),
  age: '78', sex: 'male', heightCm: '165', weightKg: '88',
  priorHHF: true, pciCabg: true, device: 'none', valvularHD: true,
  cardiomyopathy: 'ischemic',
  htn: true, dm: true, osa: true, ckd: true, copd: true, liverDisease: true, af: true,
  nyha: '4', fatigability: true, palpitations: true, syncope: true, cough: true,
  swelling: true, hemoptysis: true, appetite: true, sleep: true,
  pedalOedema: 'severe', ascites: true, afDocumented: true,
  sbp: '86', dbp: '58', hr: '112', fluctuatingBP: true,
  hb: '9.1', totalCholesterol: '260', creatinine: '2.4', uacr: '420',
  sodium: '127', potassium: '5.7', uricAcid: '9.6', hba1c: '9.8',
  tsh: '12', ntprobnp: '12000',
  cardiomegaly: true, ef: '24', mr: 'severe', tr: 'severe',
  laSize: '52', qrs: '158', rhythm: 'af', lbbb: true,
  hhfLastYear: '3',
};

test('the eight domain maxima add up to 100', () => {
  const total = Object.values(DOMAIN_MAX).reduce((a, b) => a + b, 0);
  assert.equal(total, 100);
});

test('every section declares the same maximum as the scoring engine', () => {
  for (const section of SECTIONS) {
    assert.equal(section.max, DOMAIN_MAX[section.id], `${section.id} maximum mismatch`);
  }
});

test('per-domain item maxima match the declared domain maximum', () => {
  const result = score(severe);
  for (const [domain, max] of Object.entries(DOMAIN_MAX)) {
    const itemMax = result.items
      .filter((item) => item.domain === domain)
      .reduce((sum, item) => sum + item.max, 0);
    assert.equal(itemMax, max, `${domain} items sum to ${itemMax}, expected ${max}`);
  }
});

test('no item ever scores more than its own maximum', () => {
  const result = score(severe);
  for (const item of result.items) {
    assert.ok(item.points <= item.max, `${item.label} scored ${item.points} > ${item.max}`);
  }
});

test('a worst-case patient lands in the red zone at or near 100', () => {
  const result = score(severe);
  assert.ok(result.total >= 90, `expected >= 90, got ${result.total}`);
  assert.equal(result.zone.id, 'red');
  assert.ok(result.total <= 100);
});

test('an untreated but otherwise blank form scores only the therapy gaps', () => {
  const result = score(emptyValues());
  assert.equal(result.domains.medication.points, 5.5);
  assert.equal(result.total, 6);
  assert.equal(result.zone.id, 'green');
});

test('being on all four pillars removes the medication gap points', () => {
  const treated = { ...emptyValues(), renin: true, sglt2i: true, betaBlocker: true, mra: true, vaccination: true };
  assert.equal(score(treated).domains.medication.points, 0);
  assert.equal(score(treated).total, 0);
});

test('iron gap only counts when the patient is anaemic', () => {
  const base = { ...emptyValues(), renin: true, sglt2i: true, betaBlocker: true, mra: true, vaccination: true };
  assert.equal(score({ ...base, hb: '13.5' }).domains.medication.points, 0);
  assert.equal(score({ ...base, hb: '10.2' }).domains.medication.points, 0.5);
  assert.equal(score({ ...base, hb: '10.2', iron: true }).domains.medication.points, 0);
});

test('hospitalisation frequency is banded 0 / 5 / 8.5 / 12', () => {
  const at = (n) => score({ ...emptyValues(), hhfLastYear: String(n) }).domains.hospitalisation.points;
  assert.equal(at(0), 0);
  assert.equal(at(1), 5);
  assert.equal(at(2), 8.5);
  assert.equal(at(3), 12);
  assert.equal(at(7), 12);
});

test('missing labs score zero rather than being imputed', () => {
  const result = score(emptyValues());
  assert.equal(result.domains.labs.points, 0);
  const ntprobnp = result.items.find((item) => item.label === 'NT-proBNP');
  assert.equal(ntprobnp.points, 0);
  assert.equal(ntprobnp.detail, 'not entered');
});

test('ejection fraction bands run preserved -> severe', () => {
  const ef = (v) => score({ ...emptyValues(), ef: String(v) }).items.find((i) => i.label === 'Ejection fraction').points;
  assert.equal(ef(55), 1);
  assert.equal(ef(45), 2);
  assert.equal(ef(38), 3.5);
  assert.equal(ef(24), 5);
});

test('every zone boundary maps to exactly one zone', () => {
  for (let total = 0; total <= 100; total += 1) {
    const matches = ZONES.filter((z) => total >= z.min && total <= z.max);
    assert.equal(matches.length, 1, `score ${total} matched ${matches.length} zones`);
  }
});

test('completeness reflects the key inputs that were filled in', () => {
  const blank = score(emptyValues()).completeness;
  assert.equal(blank.filled, 0);
  assert.equal(blank.percent, 0);

  const partial = score({ ...emptyValues(), age: '60', ef: '35', ntprobnp: '900' }).completeness;
  assert.equal(partial.filled, 3);
  assert.ok(partial.missing.includes('sodium'));
});

test('CRT is flagged for reduced EF with a wide QRS and no device', () => {
  const candidate = { ...emptyValues(), ef: '30', qrs: '150', nyha: '3', lbbb: true, device: 'none' };
  const flags = score(candidate).flags.map((f) => f.text).join(' ');
  assert.match(flags, /CRT/);

  const alreadyImplanted = score({ ...candidate, device: 'crtd' }).flags.map((f) => f.text).join(' ');
  assert.doesNotMatch(alreadyImplanted, /refer for device assessment/);
});

test('HFrEF on incomplete GDMT names the missing pillars', () => {
  const result = score({ ...emptyValues(), ef: '32', renin: true, betaBlocker: true });
  const flag = result.flags.find((f) => f.text.includes('four pillars'));
  assert.ok(flag);
  assert.match(flag.text, /SGLT2i/);
  assert.match(flag.text, /MRA/);
});

test('sub-risks are reported on a 0-100 scale', () => {
  for (const patient of [emptyValues(), severe]) {
    for (const risk of score(patient).subRisks) {
      assert.ok(risk.value >= 0 && risk.value <= 100, `${risk.label} = ${risk.value}`);
    }
  }
  const ids = score(severe).subRisks.map((r) => r.id);
  assert.deepEqual(ids, ['worsening', 'reHF', 'revascularization', 'crt']);
});

test('follow-up interval shortens as the zone worsens', () => {
  const from = new Date('2026-01-01T00:00:00Z');
  const days = ZONES.map((zone) => (followUpDate(zone, from) - from) / 86400000);
  assert.deepEqual(days, [180, 90, 30, 7]);
});

test('num() rejects blanks and non-numeric text', () => {
  assert.equal(num(''), null);
  assert.equal(num(null), null);
  assert.equal(num('abc'), null);
  assert.equal(num('3.5'), 3.5);
  assert.equal(num(0), 0);
});

test('BMI needs both height and weight', () => {
  assert.equal(bmiOf({ heightCm: '170' }), null);
  assert.equal(Math.round(bmiOf({ heightCm: '170', weightKg: '72' }) * 10) / 10, 24.9);
});
