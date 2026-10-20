// Downloads the evaluation photos from Wikimedia Commons and prepares them like the app does:
// square crop, 1024 px, JPEG. "blurry" cases are shrunk to 40 px and scaled back up.
//   pnpm --filter @plantpal/api eval:photos
// Writes scripts/eval/photos/*.jpg (git-ignored) and scripts/eval/sources.json (author, license
// and link for each photo, committed for attribution). Uses macOS `sips` for image processing.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Case = { id: string; commons: string; kind: 'plant' | 'not-plant' | 'blurry' };
type ImageInfo = {
  url: string;
  thumburl?: string;
  descriptionurl: string;
  extmetadata?: Record<string, { value: string } | undefined>;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const evalDir = path.join(here, 'eval');
const photosDir = path.join(evalDir, 'photos');
const { cases } = JSON.parse(readFileSync(path.join(evalDir, 'cases.json'), 'utf8')) as {
  cases: Case[];
};
// Wikimedia asks API clients to identify themselves.
const headers = { 'User-Agent': 'PlantPal-eval/0.1 (https://samilabud.com)' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status !== 429 || attempt === 5) return res;
    await sleep(10_000 * attempt); // Commons rate-limits bursts
  }
}

async function main() {
  mkdirSync(photosDir, { recursive: true });
  const sources: Record<string, unknown>[] = [];
  for (const c of cases) {
    const api = new URL('https://commons.wikimedia.org/w/api.php');
    api.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: `File:${c.commons}`,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '1600',
    }).toString();
    const info = (await (await fetchWithRetry(api.toString())).json()) as {
      query: { pages: Record<string, { imageinfo?: ImageInfo[] }> };
    };
    const ii = Object.values(info.query.pages)[0]?.imageinfo?.[0];
    if (!ii) throw new Error(`Not found on Commons: ${c.commons}`);
    const meta = ii.extmetadata ?? {};

    const raw = path.join(photosDir, `${c.id}.source.jpg`);
    const out = path.join(photosDir, `${c.id}.jpg`);
    const image = await fetchWithRetry(ii.thumburl ?? ii.url);
    if (!image.ok) throw new Error(`Download failed (${image.status}): ${c.commons}`);
    writeFileSync(raw, Buffer.from(await image.arrayBuffer()));

    // Square crop and 1024 px, like the app (which crops 1:1 and resizes before sending).
    const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', raw], {
      encoding: 'utf8',
    });
    const [w, h] = [...size.matchAll(/pixel(?:Width|Height): (\d+)/g)].map((m) => Number(m[1]));
    const side = String(Math.min(w!, h!));
    execFileSync('sips', ['-c', side, side, raw, '--out', out], { stdio: 'ignore' });
    execFileSync('sips', ['-z', '1024', '1024', out], { stdio: 'ignore' });
    if (c.kind === 'blurry') {
      execFileSync('sips', ['-z', '40', '40', out], { stdio: 'ignore' });
      execFileSync('sips', ['-z', '1024', '1024', out], { stdio: 'ignore' });
    }
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', out], {
      stdio: 'ignore',
    });
    execFileSync('rm', [raw]);

    sources.push({
      id: c.id,
      title: c.commons,
      page: ii.descriptionurl,
      author: stripTags(meta.Artist?.value ?? 'unknown'),
      license: meta.LicenseShortName?.value ?? 'unknown',
      licenseUrl: meta.LicenseUrl?.value ?? null,
      changes: c.kind === 'blurry' ? 'cropped, resized, blurred' : 'cropped and resized',
    });
    console.log(`${c.id}: ${meta.LicenseShortName?.value ?? '?'}`);
    await sleep(1500);
  }
  writeFileSync(path.join(evalDir, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
