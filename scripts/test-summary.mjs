// Writes a Markdown test report (tests per package + coverage) for the GitHub job summary.
import { existsSync, readFileSync } from 'node:fs';

const pkgs = [
  { name: 'packages/shared', junit: 'packages/shared/reports/junit.xml', cov: null },
  { name: 'apps/api', junit: 'apps/api/reports/junit.xml', cov: 'apps/api/coverage/coverage-summary.json' },
  { name: 'apps/mobile', jest: 'apps/mobile/reports/jest.json', cov: 'apps/mobile/coverage/coverage-summary.json' },
];

const attr = (xml, name) => Number((xml.match(new RegExp(`<testsuites[^>]*\\b${name}="(\\d+)"`)) ?? [])[1] ?? 0);
const lines = ['## Test report', '', '| Package | Tests | Failures | Skipped | Line coverage | Branch coverage |', '|---|---|---|---|---|---|'];
let total = 0;
for (const p of pkgs) {
  let tests, failures, skipped;
  if (p.junit && existsSync(p.junit)) {
    // Vitest: JUnit XML
    const xml = readFileSync(p.junit, 'utf8');
    [tests, failures, skipped] = [attr(xml, 'tests'), attr(xml, 'failures') + attr(xml, 'errors'), attr(xml, 'skipped')];
  } else if (p.jest && existsSync(p.jest)) {
    // Jest: built-in --json report (no jest-junit: its uuid@14 dependency breaks Expo's mocks)
    const r = JSON.parse(readFileSync(p.jest, 'utf8'));
    [tests, failures, skipped] = [r.numTotalTests, r.numFailedTests, r.numPendingTests];
  } else continue;
  total += tests;
  const cov = p.cov && existsSync(p.cov) ? JSON.parse(readFileSync(p.cov, 'utf8')).total : null;
  const pct = (k) => (cov ? `${cov[k].pct}%` : 'n/a');
  lines.push(`| ${p.name} | ${tests} | ${failures} | ${skipped} | ${pct('lines')} | ${pct('branches')} |`);
}
lines.push('', `**Total: ${total} tests.** Maestro E2E flows run on an emulator outside CI (see apps/mobile/e2e).`);
console.log(lines.join('\n'));
