# Monos

Sajt arhitektonskog studija Monos. Sulu 2.6 na Symfony 7.3.

Frontend: Tailwind v4, SCSS, Stimulus + TypeScript, Webpack Encore.

## Lokalno pokretanje

Potrebni su PHP 8.2+, Composer, Node 22 (nvm), Yarn, Docker i Symfony CLI.

Svež klon prvo dobija `.env.local` — `.env` je podešen na `APP_ENV=prod`:

```
APP_ENV=dev
FIGMA_TOKEN=<token>        # samo za yarn figma-diff, vidi dole
```

Zatim:

```bash
nvm use 22
composer install
yarn install
docker compose up -d
php bin/console sulu:build dev
yarn encore dev
symfony serve
```

Sajt je na `http://127.0.0.1:8000`, admin na `http://127.0.0.1:8000/admin/`.

`docker compose` podiže MySQL (`su_monos`, port 3306) i Mailpit (SMTP 1025,
web UI 8025, iz `compose.override.yaml`). `sulu:build dev` kreira šeme i
učitava fixtures. Za rad na stilovima koristi `yarn encore dev --watch`.

## Produkcija

**`sulu:build prod` je ZABRANJEN na produkciji.** Sulu-ov `prod` build target
uključuje `fixtures`. Naše fixture klase su zato registrovane samo u `dev` i
`test` kontejneru (`config/services.yaml`) — u produkciji ih nema:

```bash
php bin/console debug:container --env=prod | grep -i "App\\DataFixtures"   # ništa
```

Produkcijski build:

```bash
composer build-clean-prod
```

Skripta prvo proveri tu činjenicu i STANE ako naša fixture klasa ipak dospe u
prod kontejner, pa tek onda pusti build.

**Ne pokušavaj da izbegneš `fixtures` builder.** Taj target pored naših
dokumenata učitava i Sulu-ove ORM fixture — tipove medija, kolekcija i
bezbednosti. Bez njih `system_collections` pukne sa
`Collection Type with the ID 2 not found`. Provereno: `security`, `user` i
`system_collections` svi zavise od `fixtures`, pa ih `--nodeps` obara.

Takođe: `sulu:build` prima **jedan** target. Lista od više targeta pukne sa
`Too many arguments to "sulu:build" command`.

### Prazna osnova lokalno

```bash
composer build-clean
```

BRIŠE lokalnu bazu i gradi praznu osnovu: Sulu-ovi referentni podaci ostaju,
naš lorem sadržaj se preskače. Radi preko `APP_FIXTURES=0`
(`src/DataFixtures/SkippableFixture.php`).

Bez tog prekidača `sulu:build dev --destroy` na praznoj bazi **padne**:
`FixtureMedia` traži da Sulu korisnik već postoji, a u `dev` targetu se
`fixtures` izvršava pre `user`-a.

Povratak na test podatke:

```bash
php bin/console sulu:document:fixtures:load --no-interaction
```

`public/uploads` se pri tome ne čisti — brisanjem baze nestaju zapisi o
medijima, a fajlovi ostaju na disku kao siročići.

## Jezici

- `sr` (podrazumevani, na `/`)
- `en` (na `/en`)
- `ja` (na `/ja`)

## Provera dizajna

Layout se verifikuje protiv Figma frame-a:

```bash
yarn figma-diff <nodeId> <url> <WxH>
```

Primer: `yarn figma-diff 22:75 http://127.0.0.1:8000/ 1440x900`.

Skripta traži referentni PNG ovim redom:

1. `var/figma/figma-<id>[-v<verzija>].png` — radni keš (gitignored)
2. `../.figma-refs/figma-<id>.png` — trajna arhiva u roditeljskom direktorijumu
   repoa, van gita; kad se nađe tu, kopira se u `var/figma/`
3. Figma API (`FIGMA_TOKEN` iz `.env.local`)

Ako nijedan izvor nije dostupan, izlazi sa kodom 2 (harness ne može da meri;
0 = ispod praga, 1 = iznad praga). Dok referenca postoji u arhivi, Figma API se
ne poziva za nju — za osvežavanje reference obriši ili zameni fajl u
`.figma-refs/`. Screenshot i diff idu u `var/figma/`.
