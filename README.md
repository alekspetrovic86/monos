# Monos

Sajt arhitektonskog studija Monos. Sulu 2.6 na Symfony 7.3.

Frontend: Tailwind v4, SCSS, Stimulus + TypeScript, Webpack Encore.

## Lokalno pokretanje

Potrebni su PHP 8.2+, Composer, Node 22 (nvm), Yarn, Docker i Symfony CLI.

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

`docker compose` podiže samo MySQL (`su_monos`); `sulu:build dev` kreira šeme i
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

Skripta čita `FIGMA_TOKEN` iz `.env.local`. Referentni snimci žive u
`.figma-refs/` u roditeljskom direktorijumu, van ovog repoa; izlaz merenja ide
u `var/figma/` (ignorisan u gitu).
