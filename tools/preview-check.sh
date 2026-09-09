#!/usr/bin/env bash
# Provera uređivačkog dela bez logovanja: Sulu admin preview renderuje SAMO blok `content` (Template::renderBlock),
# pa `{% set %}` iznad bloka tamo ne postoji — javni sajt to ne otkriva jer renderuje ceo šablon.
# Isti izolovani render okida `?partial=true` na javnom URL-u (ContentRouteProvider čita `partial` iz query-ja).
#
#   yarn preview-check [baza]        podrazumevano http://127.0.0.1:8000
#
# Za svaku rutu traži 200 I da odgovor ne počinje `<html` (znak da je ipak renderovan ceo šablon).
# Izlaz 1 ako ijedna ruta padne.
set -u
BASE="${1:-http://127.0.0.1:8000}"
ROUTES=(
    /  /en  /ja
    /information  /en/information  /ja/information
    /en/project-corridor  /en/project-corridor/drawings
)
failed=0
for route in "${ROUTES[@]}"; do
    body=$(curl -s -w '\n%{http_code}' "${BASE}${route}?partial=true")
    code=${body##*$'\n'}
    head=$(printf '%s' "${body%$'\n'*}" | tr -d '\n' | sed 's/^[[:space:]]*//' | cut -c1-48)
    if [[ "$code" == "200" && "$head" != \<html* && "$head" != \<!DOCTYPE* ]]; then
        printf 'OK    %-32s %s  %s\n' "$route" "$code" "$head"
    else
        printf 'FAIL  %-32s %s  %s\n' "$route" "$code" "$head"
        failed=1
    fi
done
if (( failed )); then echo "preview-check: ima ruta koje ne rade u izolovanom (preview) renderu"; exit 1; fi
echo "preview-check: svih ${#ROUTES[@]} ruta renderuje blok content izolovano (200)"
