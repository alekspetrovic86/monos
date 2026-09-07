#!/usr/bin/env node
// Poredi lokalnu stranicu sa Figma frame-om.
// Upotreba: node tools/figma/diff.mjs <nodeId> <url> <WxH> [prag%]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const FILE_KEY = 'iHgAjZgn822c33rGUw1xJk';
const [nodeId, url, viewport, thresholdArg] = process.argv.slice(2);
const threshold = parseFloat(thresholdArg ?? '2.0');

if (!nodeId || !url || !viewport) {
    console.error('Upotreba: node tools/figma/diff.mjs <nodeId> <url> <WxH> [prag%]');
    process.exit(2);
}

// Token iz .env.local — nikad iz gita.
const envLocal = readFileSync('.env.local', 'utf8');
const token = envLocal.match(/^FIGMA_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) {
    console.error('FIGMA_TOKEN nije nađen u .env.local');
    process.exit(2);
}

const [width, height] = viewport.split('x').map(Number);
const outDir = 'var/figma';
mkdirSync(outDir, { recursive: true });

const safeId = nodeId.replace(':', '-');
const figmaPng = `${outDir}/figma-${safeId}.png`;
const shotPng = `${outDir}/shot-${safeId}.png`;
const diffPng = `${outDir}/diff-${safeId}.png`;

// 1. Figma referenca (keširana na disku)
if (!existsSync(figmaPng)) {
    const api = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(nodeId)}&format=png&scale=1`;
    const meta = await fetch(api, { headers: { 'X-Figma-Token': token } }).then((r) => r.json());
    const imgUrl = meta.images?.[nodeId];
    if (!imgUrl) {
        console.error('Figma nije vratila sliku:', JSON.stringify(meta));
        process.exit(2);
    }
    const buf = Buffer.from(await fetch(imgUrl).then((r) => r.arrayBuffer()));
    writeFileSync(figmaPng, buf);
    console.log(`referenca skinuta → ${figmaPng}`);
}

// 2. Screenshot lokalne stranice
const browser = await chromium.launch();
// deviceScaleFactor pinovan na 1 — bez toga screenshot izlazi 2x na retina
// mašinama i poređenje postaje besmisleno.
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: shotPng });
await browser.close();

// 2b. OBAVEZNA provera dimenzija.
// `magick compare` NE puca kad se veličine ne poklapaju — poredi samo preklapajući
// deo i vrati broj koji izgleda smisleno. Bez ove provere diff može slučajno da
// PROĐE prag na potpuno pogrešnom poređenju. Provereno eksperimentalno.
const dim = (f) =>
    execFileSync('magick', ['identify', '-format', '%w %h', f], { encoding: 'utf8' })
        .trim()
        .split(' ')
        .map(Number);

const [fw, fh] = dim(figmaPng);
const [sw, sh] = dim(shotPng);

if (fw !== sw || fh !== sh) {
    console.error(`dimenzije se ne poklapaju: figma ${fw}x${fh} vs screenshot ${sw}x${sh}`);
    console.error('Poređenje bi bilo besmisleno. Proveri viewport argument i veličinu frame-a.');
    process.exit(2);
}
if (fw !== width || fh !== height) {
    console.error(`figma frame je ${fw}x${fh}, a tražen viewport ${width}x${height}`);
    process.exit(2);
}

// 3. Poređenje. magick vraća izlazni kod 1 kad ima razlike — to nije greška.
let raw;
try {
    raw = execFileSync(
        'magick',
        ['compare', '-metric', 'AE', '-fuzz', '5%', figmaPng, shotPng, diffPng],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
} catch (e) {
    raw = e.stderr ?? '';
}

const differing = parseInt(String(raw).trim().split(/\s+/)[0], 10);
if (Number.isNaN(differing)) {
    console.error('magick compare nije vratio broj:', raw);
    process.exit(2);
}

const pct = (differing / (width * height)) * 100;
console.log(`odstupanje: ${pct.toFixed(2)}%  (prag ${threshold}%)  diff → ${diffPng}`);
process.exit(pct <= threshold ? 0 : 1);
