#!/usr/bin/env node
// Invarijanta: RASPORED NE SME DA ZAVISI OD GUSTINE PIKSELA.
// Učita istu stranicu pri istom viewportu na @1x i @2x (ili zadatim gustinama) i uporedi CSS geometriju
// (getBoundingClientRect) svakog elementa u <body>. Prijavi svaki element čija se veličina ili položaj razlikuju.
//
// Zašto postoji: diff.mjs meri isključivo na deviceScaleFactor 1 (da bi bio uporediv sa Figmom) i zato je slep za
// razred grešaka koje postoje SAMO na retini — npr. <img> sa srcset/w deskriptorima čija intrinzična veličina je
// izvor ÷ gustina, pa `width: auto` da 1/DPR okvira. Ova provera hvata upravo to.
//
// Upotreba: node tools/figma/dpr-check.mjs <url> [WxH=1440x900] [gustine=1,2]
// Izlazni kod: 0 = nema razlika, 1 = ima razlika, 2 = harness ne može da izmeri.
import { chromium } from 'playwright';

process.on('uncaughtException', (e) => {
    console.error('harness greška:', e.message);
    process.exit(2);
});

const [url, viewportArg = '1440x900', dprArg = '1,2'] = process.argv.slice(2);
if (!url) {
    console.error('Upotreba: node tools/figma/dpr-check.mjs <url> [WxH=1440x900] [gustine=1,2]');
    process.exit(2);
}
const [width, height] = viewportArg.split('x').map(Number);
const dprs = dprArg.split(',').map(Number);
if (!(width > 0 && height > 0) || dprs.length < 2 || dprs.some((d) => !(d > 0))) {
    console.error('viewport mora biti WxH, a gustine bar dve pozitivne vrednosti (npr. 1,2 ili 1,2,3)');
    process.exit(2);
}

// Razlika manja od pola CSS piksela je šum rasterizacije teksta, ne raspored.
const TOLERANCE = 0.5;

// Snimak geometrije: za svaki element u <body> stabilan ključ (putanja tag>tag:nth-child) + rect + naturalWidth za <img>.
// naturalWidth se NE poredi (legitimno je različit po gustini), služi samo kao objašnjenje u izveštaju.
const snapshot = () =>
    Array.from(document.body.querySelectorAll('*'))
        .filter((el) => !(el instanceof HTMLScriptElement || el instanceof HTMLStyleElement || el instanceof HTMLTemplateElement))
        .map((el) => {
            const path = [];
            for (let node = el; node && node !== document.body; node = node.parentElement) {
                const index = Array.from(node.parentElement.children).indexOf(node) + 1;
                path.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
            }
            const r = el.getBoundingClientRect();
            const label = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
            const natural = el instanceof HTMLImageElement ? `${el.naturalWidth}×${el.naturalHeight}` : null;
            return {
                key: path.join('>'),
                label,
                natural,
                x: Math.round(r.x * 100) / 100,
                y: Math.round(r.y * 100) / 100,
                w: Math.round(r.width * 100) / 100,
                h: Math.round(r.height * 100) / 100,
            };
        });

const browser = await chromium.launch();
const runs = new Map();

for (const dpr of dprs) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) {
        console.error(`@${dpr}x: stranica vratila HTTP ${res?.status() ?? '(bez odgovora)'} — nema šta da se meri`);
        await browser.close();
        process.exit(2);
    }
    // Oprema koja nije deo rasporeda i menja se u vremenu — ne sme da pravi lažne razlike.
    await page.evaluate(() => {
        document.querySelectorAll('.sf-toolbar, .sf-minitoolbar, .turbo-progress-bar, .global-loader').forEach((el) => el.remove());
    });
    // Lenje slike van kadra (loading="lazy") nikad ne krenu da se učitavaju, a snimak mora da bude deterministički:
    // prebaci ih na eager i sačekaj da se sve slike završe (najviše 15 s — posle toga meri šta ima).
    await page.evaluate(() => Array.from(document.images).forEach((img) => { img.loading = 'eager'; }));
    await page.evaluate(() =>
        Promise.race([
            Promise.all(Array.from(document.images).filter((img) => !img.complete).map((img) => new Promise((r) => { img.onload = img.onerror = r; }))),
            new Promise((r) => setTimeout(r, 15000)),
        ]),
    );
    runs.set(dpr, await page.evaluate(snapshot));
    await page.close();
}
await browser.close();

const [baseDpr, ...others] = dprs;
const base = runs.get(baseDpr);
const differences = [];

for (const dpr of others) {
    const other = runs.get(dpr);
    const byKey = new Map(other.map((e) => [e.key, e]));
    if (other.length !== base.length) {
        console.warn(`UPOZORENJE: @${baseDpr}x ima ${base.length} elemenata, @${dpr}x ${other.length} — DOM se razlikuje, poredim po ključu.`);
    }
    for (const a of base) {
        const b = byKey.get(a.key);
        if (!b) {
            differences.push({ dpr, label: a.label, key: a.key, reason: `nema elementa @${dpr}x` });
            continue;
        }
        const sizeDiff = Math.abs(a.w - b.w) > TOLERANCE || Math.abs(a.h - b.h) > TOLERANCE;
        const posDiff = Math.abs(a.x - b.x) > TOLERANCE || Math.abs(a.y - b.y) > TOLERANCE;
        if (sizeDiff || posDiff) {
            differences.push({
                dpr,
                label: a.label,
                key: a.key,
                reason: `${sizeDiff ? 'veličina' : ''}${sizeDiff && posDiff ? '+' : ''}${posDiff ? 'položaj' : ''}`,
                a: `${a.w}×${a.h} @ L${a.x} T${a.y}${a.natural ? ` (natural ${a.natural})` : ''}`,
                b: `${b.w}×${b.h} @ L${b.x} T${b.y}${b.natural ? ` (natural ${b.natural})` : ''}`,
            });
        }
    }
}

console.log(`${url}  ${width}×${height}  gustine ${dprs.map((d) => `@${d}x`).join(' vs ')}  — ${base.length} elemenata`);
if (differences.length === 0) {
    console.log('OK: raspored je isti na svim gustinama (0 razlika)');
    process.exit(0);
}
console.log(`${differences.length} razlika:`);
for (const d of differences) {
    console.log(`  ${d.label}  [${d.reason}]`);
    console.log(`      ${d.key}`);
    if (d.a) console.log(`      @${baseDpr}x  ${d.a}`);
    if (d.b) console.log(`      @${d.dpr}x  ${d.b}`);
}
process.exit(1);
