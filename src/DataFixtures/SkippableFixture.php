<?php

declare(strict_types=1);

namespace App\DataFixtures;

/**
 * Prekidač za naše fixture: `APP_FIXTURES=0` ih preskače.
 *
 * Postoji zbog dve stvari koje se ne mogu rešiti redosledom buildera:
 *
 * 1. Prazna osnova. `fixtures` builder učitava i Sulu-ove ORM fixture (tipovi medija, kolekcija,
 *    bezbednosti) bez kojih `system_collections` puca sa „Collection Type with the ID 2 not found".
 *    Taj target zato MORA da se izvrši i onda kad ne želimo naš lorem sadržaj.
 * 2. Prazna baza. `FixtureMedia` traži da Sulu korisnik već postoji, a u `dev` targetu se `fixtures`
 *    izvršava PRE `user`-a — pa `sulu:build dev --destroy` na praznoj bazi padne. Sa `APP_FIXTURES=0`
 *    naši fixture se preskoče i lanac prolazi do kraja.
 *
 * Na produkciji ovo nije potrebno: naše klase tamo nisu ni registrovane kao servisi
 * (`config/services.yaml`, `when@dev` / `when@test`).
 */
trait SkippableFixture
{
    private function fixturesDisabled(): bool
    {
        return '0' === ($_ENV['APP_FIXTURES'] ?? $_SERVER['APP_FIXTURES'] ?? '1');
    }
}
