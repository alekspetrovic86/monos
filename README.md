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
