// Runs the evaluation photos through "Identify with AI" and scores the answers.
//   pnpm --filter @plantpal/api eval:photos        # once: download the photos
//   pnpm --filter @plantpal/api eval:identify      # all configurations, English
//   pnpm --filter @plantpal/api eval:identify -- --configs A --lang es --max-usd 0.5
// It calls the real Claude API with ANTHROPIC_API_KEY from .env.local, so it costs money: the run
// stops before going over --max-usd (default 2). It uses the same prompt and request code as the
// route (src/ai), so rerun it after changing the prompt. Results go to scripts/eval/results/.
import { loadEnvConfig } from '@next/env';
import type { AppLanguage, IdentifyResult } from '@plantpal/shared';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import type { Effort, ThinkingMode } from '../src/ai/config';
import { anthropicClient, identifyPlant } from '../src/ai/identify';

type Case = {
  id: string;
  kind: 'plant' | 'not-plant' | 'blurry';
  species?: string[];
  genera?: string[];
  water?: string;
};
type Config = { id: string; label: string; model: string; thinking: ThinkingMode; effort: Effort };

/** What we compare. Each runs every photo once. */
const CONFIGS: Config[] = [
  {
    id: 'A',
    label: 'Sonnet 5.5, low effort',
    model: 'claude-sonnet-5-5',
    thinking: 'adaptive',
    effort: 'low',
  },
  {
    id: 'B',
    label: 'Sonnet 5.5, no thinking',
    model: 'claude-sonnet-5-5',
    thinking: 'between_tools',
    effort: 'low',
  },
  {
    id: 'C',
    label: 'Haiku 5.5, low effort',
    model: 'claude-haiku-5-5',
    thinking: 'adaptive',
    effort: 'low',
  },
];
/** Time limit per photo. Longer than the app's 15 s on purpose: we want the real latency. */
const DEADLINE_MS = 45_000;

const here = path.dirname(fileURLToPath(import.meta.url));
const evalDir = path.join(here, 'eval');
loadEnvConfig(path.join(here, '..'));

const { values: args } = parseArgs({
  options: {
    configs: { type: 'string', default: CONFIGS.map((c) => c.id).join(',') },
    lang: { type: 'string', default: 'en' },
    only: { type: 'string' },
    'max-usd': { type: 'string', default: '2' },
  },
});

/** yes = right species (or genus when only a genus is expected); partly = right genus only;
 *  unsure = the app would not pre-fill (low confidence or "not a plant"); no = confidently wrong. */
type Verdict = 'yes' | 'partly' | 'unsure' | 'no';

function judge(c: Case, r: IdentifyResult | null): Verdict {
  if (!r) return 'no';
  const unsure = !r.isPlant || r.confidence === 'low';
  if (c.kind === 'not-plant') return r.isPlant ? 'no' : 'yes';
  const name = (r.scientificName ?? '').toLowerCase();
  const genus = name.split(/\s+/)[0] ?? '';
  const speciesOk = (c.species ?? []).some((s) => name.includes(s.toLowerCase()));
  const genusOk = (c.genera ?? []).some((g) => g.toLowerCase() === genus);
  const identified: Verdict | null =
    speciesOk || (genusOk && !c.species?.length) ? 'yes' : genusOk ? 'partly' : null;
  if (c.kind === 'blurry') return unsure || identified ? 'yes' : 'no'; // admitting doubt is right
  if (unsure) return 'unsure';
  return identified ?? 'no';
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};
const usd = (micro: number) => `$${(micro / 1e6).toFixed(4)}`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set (apps/api/.env.local)');
  const language = AppLanguageOf(args.lang!);
  const maxMicroUsd = Number(args['max-usd']) * 1e6;
  const file = JSON.parse(readFileSync(path.join(evalDir, 'cases.json'), 'utf8'));
  const ranges: Record<string, { days: [number, number] }> = file.waterRanges;
  const only = args.only?.split(',');
  const cases: Case[] = (file.cases as Case[]).filter((c) => !only || only.includes(c.id));
  const configs = CONFIGS.filter((c) => args.configs!.split(',').includes(c.id));
  const client = anthropicClient(apiKey);

  let spent = 0;
  const rows: Array<Record<string, unknown>> = [];
  outer: for (const config of configs) {
    for (const c of cases) {
      if (spent >= maxMicroUsd) {
        console.log(`Stopping: reached the --max-usd budget (${usd(spent)})`);
        break outer;
      }
      const image = readFileSync(path.join(evalDir, 'photos', `${c.id}.jpg`)).toString('base64');
      const outcome = await identifyPlant(client, image, language, {
        model: config.model,
        thinking: config.thinking,
        effort: config.effort,
        deadline: Date.now() + DEADLINE_MS,
      });
      spent += outcome.usage.costMicroUsd;
      const result = 'result' in outcome ? outcome.result : null;
      const verdict = judge(c, result);
      const range = c.water ? ranges[c.water]?.days : undefined;
      const days = result?.wateringIntervalDays ?? null;
      const intervalOk =
        c.kind === 'not-plant' || !range || days === null
          ? null
          : days >= range[0] && days <= range[1];
      const row = {
        config: config.id,
        case: c.id,
        kind: c.kind,
        status: outcome.status,
        verdict,
        scientificName: result?.scientificName ?? null,
        commonName: result?.commonName ?? null,
        confidence: result?.confidence ?? null,
        days,
        range: range ? `${range[0]}-${range[1]}` : null,
        intervalOk,
        careTip: result?.careTip ?? null,
        ...outcome.usage,
      };
      rows.push(row);
      console.log(
        `${config.id} ${c.id.padEnd(24)} ${verdict.padEnd(7)} ${String(result?.scientificName).padEnd(30)} ${String(days).padStart(3)}d ${outcome.usage.latencyMs}ms ${usd(outcome.usage.costMicroUsd)}`,
      );
    }
  }

  // Summary per configuration.
  const summary = configs.map((config) => {
    const mine = rows.filter((r) => r.config === config.id);
    const plants = mine.filter((r) => r.kind === 'plant');
    const count = (xs: typeof mine, v: Verdict) => xs.filter((r) => r.verdict === v).length;
    const intervals = mine.filter((r) => r.intervalOk !== null);
    const latencies = mine.map((r) => r.latencyMs as number);
    const costs = mine.map((r) => r.costMicroUsd as number);
    return {
      config: config.id,
      label: config.label,
      photos: mine.length,
      plantsCorrect: count(plants, 'yes'),
      plantsPartly: count(plants, 'partly'),
      plantsUnsure: count(plants, 'unsure'),
      plantsWrong: count(plants, 'no'),
      plants: plants.length,
      notPlants: mine.filter((r) => r.kind === 'not-plant').length,
      blurries: mine.filter((r) => r.kind === 'blurry').length,
      notPlantCorrect: count(
        mine.filter((r) => r.kind === 'not-plant'),
        'yes',
      ),
      blurryCorrect: count(
        mine.filter((r) => r.kind === 'blurry'),
        'yes',
      ),
      intervalInRange: intervals.filter((r) => r.intervalOk).length,
      intervalChecked: intervals.length,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      avgCostMicroUsd: costs.length
        ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)
        : 0,
      avgInputTokens: Math.round(
        mine.reduce((a, r) => a + (r.inputTokens as number), 0) / (mine.length || 1),
      ),
      avgOutputTokens: Math.round(
        mine.reduce((a, r) => a + (r.outputTokens as number), 0) / (mine.length || 1),
      ),
      textRepairs: mine.reduce((a, r) => a + (r.textRepairs as number), 0),
      invalidOrError: mine.filter(
        (r) => !['ok', 'low_confidence', 'not_plant'].includes(r.status as string),
      ).length,
    };
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(evalDir, 'results');
  mkdirSync(outDir, { recursive: true });
  const md = [
    `# Identify evaluation, ${stamp} (language: ${language})`,
    '',
    '| Config | Plants right | Partly | Unsure | Wrong | Not-plant right | Blurry OK | Interval in range | p50 | p95 | Avg tokens in/out | Avg cost | Errors | Text repairs |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...summary.map(
      (s) =>
        `| ${s.config}: ${s.label} | ${s.plantsCorrect}/${s.plants} | ${s.plantsPartly} | ${s.plantsUnsure} | ${s.plantsWrong} | ${s.notPlantCorrect}/${s.notPlants} | ${s.blurryCorrect}/${s.blurries} | ${s.intervalInRange}/${s.intervalChecked} | ${(s.p50Ms / 1000).toFixed(1)} s | ${(s.p95Ms / 1000).toFixed(1)} s | ${s.avgInputTokens}/${s.avgOutputTokens} | ${usd(s.avgCostMicroUsd)} | ${s.invalidOrError} | ${s.textRepairs} |`,
    ),
    '',
    `Total spent: ${usd(spent)}`,
    '',
    '## Every answer',
    '',
    '| Config | Photo | Verdict | Scientific name | Common name | Confidence | Days (range) | Latency | Cost |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.config} | ${r.case} | ${r.verdict} | ${r.scientificName ?? '–'} | ${r.commonName ?? '–'} | ${r.confidence ?? r.status} | ${r.days ?? '–'} (${r.range ?? '–'})${r.intervalOk === false ? ' ✗' : ''} | ${((r.latencyMs as number) / 1000).toFixed(1)} s | ${usd(r.costMicroUsd as number)} |`,
    ),
  ].join('\n');
  writeFileSync(path.join(outDir, `${stamp}-${language}.md`), md + '\n');
  writeFileSync(
    path.join(outDir, `${stamp}-${language}.json`),
    JSON.stringify({ summary, rows }, null, 2) + '\n',
  );
  console.log('\n' + md.split('\n## Every answer')[0]);
}

function AppLanguageOf(value: string): AppLanguage {
  if (value === 'en' || value === 'es') return value;
  throw new Error(`--lang must be en or es, got ${value}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
