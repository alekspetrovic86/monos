# Odluke o responzivnosti

Zapisano 9. septembra 2026. Sve vrednosti u ovom dokumentu su **izmerene u
pregledaču**, ne procenjene.

Sajt ima dva rasporeda: desktop (grid iz Figme) i mobilni (jedna kolona).
Tableti koriste mobilni. Ovaj dokument beleži gde je granica i, važnije,
**zašto ne diramo laptopove male visine** — jer je to odluka koju je najlakše
kasnije „popraviti" ne znajući šta se time gubi.

---

## Odluka: laptopove ne diramo

MacBook 13" i 14", kao i svaki prozor niži od 900px, pokazuju naslov
projekta ispod pregiba. To **ostaje tako**.

### Šta je izmereno

Stranica projekta je komponovana za visinu od 900px (Figma F7): slika 675 +
razmak + naslov 80 + 95px vazduha = 900. Na nižem prozoru naslov padne ispod:

| ekran | naslov ispod pregiba |
|---|---|
| MacBook 14, 1512×800 | **5px** |
| MacBook 14 + bookmarks, 1512×770 | 35px |
| MacBook Air 13, 1440×720 | 85px |
| iPad landscape, 1180×740 | 65px |
| 1024×700 | 105px |

### Zašto ne skaliramo sliku prema visini prozora

Jedini način da kompozicija stane na niži ekran je da se slika smanji. To se
**namerno ne radi**, iz pet razloga — svaki od njih je nešto što bi se izgubilo:

1. **Ništa na ovom sajtu ne zavisi od veličine prozora.** Tipografija se nikad
   ne skalira (14/16 uvek), položaji su apsolutni iz Figme, slika ima fiksno
   dno na 677. Slika koja se skuplja bila bi jedini element čija veličina
   zavisi od korisnikovog ekrana.
2. **Palo bi pravilo „dno slike je fiksno na 677"**, na kome počiva poravnanje
   slika različitih formata (poravnate su po dnu, drugi format raste naviše).
3. **Expand view bi dobio drugačiji kadar kod svakog korisnika**, jer se
   uklapanje u okvir računa iz prikazane veličine.
4. **`figma-diff` bi prestao da meri išta stabilno** — svaki snimak bi zavisio
   od visine prozora u kojoj je napravljen.
5. **Ništa se ne gubi.** Stranica se skroluje; najgori realan slučaj je 85px,
   dakle jedan mali pokret. Za 5px na MacBook-u 14 to je nesrazmerno.

### Kada bi ovo trebalo preispitati

Samo ako dizajner napravi Figma kadar za nižu visinu. Tada postoji šta da se
implementira. Bez toga bi svako skaliranje bilo improvizacija koja ruši
geometriju ostatka sajta.

---

## Šta jeste menjano

Za razliku od visine, **širina** je imala stvarne kvarove i oni su popravljeni.

### 1. Prag desktop rasporeda: 1024 → 1200

Desktop kompozicija potroši `240 + 540 + 16 = 796px` pre nego što tekstualna
kolona počne. Kolona je `širina − 796`, pa pada brzo:

| širina | tekstualna kolona |
|---|---|
| 1024 | 226px (~31 znak u redu) |
| 1080 | 282px (~39) |
| 1180 | 382px (~53) |
| 1194 | 396px (~55) |
| 1440 | 642px (~89) |

iPad Pro 12.9" u portretu je tačno 1024, pa je dobijao **najužu kolonu na
sajtu** — dok je manji iPad Pro 11" (834) dobijao tablet raspored i čitao
lepo. Veći uređaj je čitao gore od manjeg.

Prag je 1200 jer je to prva širina na kojoj kolona stigne do ~55 znakova,
unutar udobnog opsega od 45–75. Nije uzeto 1280 zato što bi ekrani 1200–1279
otišli u kolonu od 600px sa ~680px praznine desno, a oni već čitaju dobro.

Prag je zapisan na **tri mesta i moraju se pomerati zajedno**:

- `--breakpoint-lg` u `assets/website/styles/tailwind.css`
- media query-ji u `assets/website/styles/main.scss`
- `assets/website/stimulus/breakpoints.ts` (`DESKTOP`, `BELOW_DESKTOP`)

Treće mesto postoji baš zato da se ne razidu: ako se pomeri samo CSS, meni bi
se ponašao kao na mobilnom dok raspored crta desktop.

### 2. Slika na tabletima ograničena na 600px

Mobilno pravilo je „slika je 4:5 pune širine", crtano za 375. Van tog opsega
je bežalo: na 1023 slika je ispadala **1023×1279** i virila 627px preko
ekrana. Ograničenje na 600 je drži na 600×750 kroz ceo opseg.

600 nije proizvoljno — tekstualna kolona ispod `lg` već koristi
`max-w-[600px]`.

### 3. Mirna slika u listi na tabletima: 467px

Sve oko nje je naraslo na 600, a ona je ostajala na mobilnih 292 apsolutno,
pa je klik uvećavao za 105% umesto za 34% (mobilni) odnosno 13% (desktop).

467 = odnos iz mobilne Figme (292/375 = 0,78) primenjen na ograničenje od 600.

| ekran | mirna / raširena | odnos |
|---|---|---|
| 390 mobilni | 292 / 390 | 0,75 |
| 600–1199 tablet | 467 / 600 | 0,78 |
| 1200+ desktop | 480 / 540 | 0,89 |

Praznina ide **desno**, kao i u listi na mobilnom gde je tizer 292px uz levu
ivicu — tablet je uvećan mobilni, ne treći raspored.

---

## Sažetak

| opseg | raspored | odluka |
|---|---|---|
| do 599 | mobilni | netaknut, potvrđen od vlasnika |
| 600–1199 | tablet | popravljen (slika 600, mirna 467) |
| 1200+ | desktop | netaknut, potvrđen od vlasnika |
| **niski prozori (< 900 visine)** | — | **namerno ne diramo** |
