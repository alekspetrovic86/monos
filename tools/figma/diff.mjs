#!/usr/bin/env node
// Poredi lokalnu stranicu sa Figma frame-om.
// Upotreba: node tools/figma/diff.mjs <nodeId> <url> <WxH> [prag%]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Konvencija izlaznih kodova: 0 = ispod praga, 1 = iznad praga,
// 2 = harness ne može da izmeri (greška u opremi, ne u dizajnu).
process.on('uncaughtException', (e) => {
    console.error('harness greška:', e.message);
    process.exit(2);
});

const FILE_KEY = 'iHgAjZgn822c33rGUw1xJk';
const [nodeId, url, viewport, thresholdArg] = process.argv.slice(2);
// Podrazumevani prag 3.0, ne 2.0: zvanicna tipografija (kartica vlasnika) je Inter Tight sa trackingom 10
// i bojom #191c1e, a Figma fajl je crtan u obicnom Interu — taj font se u njemu nije mogao izabrati. Izvozi
// prema kojima se meri zato NE prikazuju zvanicni font, pa svaki tekstualni kadar nosi stalnu razliku koja
// nije nasa greska: izmereno na 16:2, samo font +0.59pp, samo tracking +0.54pp, samo boja +0.11pp.
// Kad Nikola sredi Figma fajl i izvezemo nove reference, vratiti na 2.0.
const threshold = parseFloat(thresholdArg ?? '3.0');

if (!nodeId || !url || !viewport) {
    console.error('Upotreba: node tools/figma/diff.mjs <nodeId> <url> <WxH> [prag%]');
    process.exit(2);
}
if (!Number.isFinite(threshold)) {
    console.error('prag nije broj');
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
// Trajna arhiva referenci: `.figma-refs/` u RODITELJSKOM direktorijumu repoa,
// van gita. Putanja se izvodi iz lokacije skripte (tools/figma/), ne hardkoduje.
const archiveDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.figma-refs');

const safeId = nodeId.replaceAll(':', '-');

// 1. Pokušaj da saznaš verziju fajla (za auto-invalidaciju keša).
// Verzija ulazi u ime keša — posle izmene dizajna stari PNG se više ne koristi.
let version = null;
try {
    const res = await fetch(
        `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(nodeId)}&depth=1`,
        { headers: { 'X-Figma-Token': token }, signal: AbortSignal.timeout(10000) },
    );
    if (res.ok) version = (await res.json()).version;
} catch { /* pada u fallback ispod */ }

// Redosled traženja reference:
//   1. var/figma/figma-<id>[-v<version>].png  — radni keš
//   2. ../.figma-refs/figma-<id>.png          — trajna arhiva (kopira se u keš)
//   3. Figma API
//   4. exit 2
const cachePng = `${outDir}/figma-${safeId}.png`;
const archivePng = `${archiveDir}/figma-${safeId}.png`;
let figmaPng = null;

// 1. Radni keš.
if (version) {
    for (const candidate of [`${outDir}/figma-${safeId}-v${version}.png`, cachePng]) {
        if (existsSync(candidate)) {
            figmaPng = candidate;
            break;
        }
    }
} else {
    // Figma nedostupna (429, mreža, timeout). Uzmi najnoviju poznatu referencu.
    // Ustajalo poređenje nikad nije tiho — upozorenje ide pri svakom takvom pokretanju.
    // Egzaktan regex, ne prefiks: `figma-22-75` bi kao prefiks uhvatio i `figma-22-750*.png`
    // — referencu DRUGOG frame-a iste veličine, i merio bi tuđi dizajn.
    const re = new RegExp(`^figma-${safeId}(-v\\d+)?\\.png$`);
    const cached = readdirSync(outDir)
        .filter((f) => re.test(f))
        .map((f) => ({ f, t: statSync(`${outDir}/${f}`).mtimeMs }))
        .sort((a, b) => b.t - a.t)[0];
    if (cached) {
        figmaPng = `${outDir}/${cached.f}`;
        console.warn(`UPOZORENJE: Figma nedostupna. Merim prema keširanoj referenci ${cached.f}, koja može biti ustajala.`);
    }
}

// 2. Trajna arhiva — kopija ide u keš da sledeće pokretanje ne zavisi ni od arhive.
if (!figmaPng && existsSync(archivePng)) {
    copyFileSync(archivePng, cachePng);
    figmaPng = cachePng;
    console.log(`koristim arhiviranu referencu figma-${safeId}.png iz .figma-refs/`);
}

// 3. Figma API — tek kad nema ni keša ni arhive.
if (!figmaPng) {
    if (!version) {
        // 4. Ništa od toga nije dostupno.
        console.error(`Figma nedostupna, nema keširane reference u ${outDir}/ ni arhivirane u ${archiveDir}/ — nema šta da se meri.`);
        process.exit(2);
    }
    figmaPng = `${outDir}/figma-${safeId}-v${version}.png`;
    const api = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(nodeId)}&format=png&scale=1`;
    const meta = await fetch(api, { headers: { 'X-Figma-Token': token }, signal: AbortSignal.timeout(30000) }).then((r) => r.json());
    const imgUrl = meta.images?.[nodeId];
    if (!imgUrl) {
        console.error('Figma nije vratila sliku:', JSON.stringify(meta));
        process.exit(2);
    }
    const buf = Buffer.from(await fetch(imgUrl, { signal: AbortSignal.timeout(30000) }).then((r) => r.arrayBuffer()));
    writeFileSync(figmaPng, buf);
    console.log(`referenca skinuta → ${figmaPng}`);
}

const shotPng = `${outDir}/shot-${safeId}.png`;
const diffPng = `${outDir}/diff-${safeId}.png`;

// 1b. Figma referenca (keširana na disku, po verziji fajla)
if (!existsSync(figmaPng)) {
    const api = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(nodeId)}&format=png&scale=1`;
    const meta = await fetch(api, { headers: { 'X-Figma-Token': token }, signal: AbortSignal.timeout(30000) }).then((r) => r.json());
    const imgUrl = meta.images?.[nodeId];
    if (!imgUrl) {
        console.error('Figma nije vratila sliku:', JSON.stringify(meta));
        process.exit(2);
    }
    const buf = Buffer.from(await fetch(imgUrl, { signal: AbortSignal.timeout(30000) }).then((r) => r.arrayBuffer()));
    writeFileSync(figmaPng, buf);
    console.log(`referenca skinuta → ${figmaPng}`);
}

// 2. Screenshot lokalne stranice
const browser = await chromium.launch();
// deviceScaleFactor pinovan na 1 — bez toga screenshot izlazi 2x na retina
// mašinama i poređenje postaje besmisleno.
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const res = await page.goto(url, { waitUntil: 'networkidle' });
if (!res || res.status() !== 200) {
    console.error(`stranica vratila HTTP ${res?.status() ?? '(bez odgovora)'} — nema šta da se meri`);
    await browser.close();
    process.exit(2);
}
// Oprema koje nema u Figma frame-u ne sme da ulazi u meru.
await page.evaluate(() => {
    // Symfony web profiler toolbar — dev artefakt, nije deo dizajna
    document.querySelectorAll('.sf-toolbar').forEach((el) => el.remove());
    document.querySelectorAll('.sf-minitoolbar').forEach((el) => el.remove());
    // Cookie consent banner — nije u Figma frame-u
    document.querySelectorAll('[data-controller~="cookie-consent"]').forEach((el) => el.remove());
    // Turbo progress bar i naša traka učitavanja (.global-loader) — animirani, prave šum između pokretanja
    document.querySelectorAll('.turbo-progress-bar').forEach((el) => el.remove());
    document.querySelectorAll('.global-loader').forEach((el) => el.remove());
});
await page.screenshot({ path: shotPng, animations: 'disabled' });
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
// fuzz 2%: 5% je maskirao uniformni pomak boje do ~13/255 po kanalu
// (#191C1E vs #111827 prolazio kao identičan).
let raw;
try {
    raw = execFileSync(
        'magick',
        ['compare', '-metric', 'AE', '-fuzz', '2%', figmaPng, shotPng, diffPng],
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
