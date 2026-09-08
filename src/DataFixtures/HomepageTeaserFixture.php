<?php

declare(strict_types=1);

namespace App\DataFixtures;

use Sulu\Bundle\DocumentManagerBundle\DataFixtures\DocumentFixtureInterface;
use Sulu\Bundle\PageBundle\Document\HomeDocument;
use Sulu\Bundle\PageBundle\Document\PageDocument;
use Sulu\Component\DocumentManager\DocumentManager;

/**
 * Homepage sadržaj po Figmi: lista od četiri `project-teaser` stavke (prva = F1/F2, F14/F15) na sr/en/ja.
 *
 * Ponovljiv: blok se prepisuje; slike deli sa ProjectPagesFixture kroz FixtureMedia. Pokreće se sa
 *   php bin/console sulu:document:fixtures:load --append
 * (ili preko `sulu:build dev`, koji zove isto sa --append).
 * Ide POSLE ProjectPagesFixture — „Enter" svakog tizera vodi na odgovarajuću stranicu projekta.
 */
final class HomepageTeaserFixture implements DocumentFixtureInterface
{
    private const WEBSPACE = ProjectPagesFixture::WEBSPACE;
    private const LOCALES = ProjectPagesFixture::LOCALES;

    /**
     * Četiri stavke, redom kako stoje u Figmi: F1/F14 (lista u miru) počinju sa project-2 (mračni hodnik),
     * F2/F15 (raširena stavka) prikazuju project-1 (garderober) kao DRUGU stavku, sa project-2 koji viri iznad.
     * Fotografije su isečene iz Figma frame-ova: project-2 iz F1/F7, project-1 iz F2 (12:66),
     * project-3-wide iz F9 (17:39) — format 3:2, kao treća stavka u F1 (480×320); project-4 iz F13 (17:93).
     * Slike zadržavaju svoj format — lista ih ne seče na 4:5.
     * Peta stavka: prava fotografija photo-wide (2400×1600 JPEG, iz Photos/ 3240×2160) — test Sulu formata; van kadra F1/F2 (900px).
     */
    private const IMAGES = ['project-2.jpg', 'project-1.jpg', 'project-3-wide.jpg', 'project-4.jpg', 'photo-wide.jpg'];

    // Tekst doslovno iz Figme (isti na sve tri lokalizacije i na svim tizerima — test podatak).
    private const TITLE = "Lorem ipsum dolor sit amet\nDuis autem vel eum iriure dolor\nMolestie";
    private const SUBTITLE = 'Sed diam nonummy nibh euismod tincidunt ut laoreet';

    /**
     * Dugi opis po stavci (F1: L240 T928, 540×336 — počinje oznakom „1.2", pa pasusi). Oznaka je deo teksta.
     * Prve dve stavke ga nemaju: tako sledeća slika dolazi odmah ispod (F2/F15: prethodna slika viri 2px iznad
     * raširene, a F1 sa opisom ispod prve slike se s tim ne slaže — F2/F15 su merodavni za stanje liste).
     * Treća i četvrta ga imaju — klik na treću pokazuje redosled slika → naslov → podnaslov → Enter → opis.
     */
    private const DESCRIPTIONS = [
        '',
        '',
        '<p>1.2</p>'
        . '<p>Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet '
        . 'dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit '
        . 'lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit '
        . 'esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim '
        . 'qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi.</p>'
        . '<p>Nam liber tempor cum soluta nobis eleifend option congue nihil imperdiet doming id quod mazim placerat facer possim '
        . 'assum. Typi non habent claritatem insitam; est usus legentis in iis qui facit eorum claritatem. Investigationes '
        . 'demonstraverunt lectores legere me lius quod ii legunt saepius. Claritas est etiam processus dynamicus, qui sequitur '
        . 'mutationem consuetudium lectorum. Mirum est notare quam littera gothica, quam nunc putamus parum claram, anteposuerit '
        . 'litterarum formas humanitatis per seacula quarta decima et quinta decima. Eodem modo typi, qui nunc nobis videntur '
        . 'parum clari, fiant sollemnes in futurum.</p>',
        '<p>2.1</p>'
        . '<p>Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea '
        . 'commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat.</p>',
        '',
    ];

    public function __construct(
        private readonly FixtureMedia $media,
    ) {
    }

    public function load(DocumentManager $documentManager): void
    {
        $mediaIds = $this->media->mediaIds(self::IMAGES);

        foreach (self::LOCALES as $locale) {
            $home = $documentManager->find('/cmf/' . self::WEBSPACE . '/contents', $locale);
            \assert($home instanceof HomeDocument);

            $blocks = [];
            foreach ($mediaIds as $index => $mediaId) {
                // „Enter" (i drugi klik na raširenu sliku) vodi na stranicu projekta iz ProjectPagesFixture.
                $project = $documentManager->find(
                    ProjectPagesFixture::CONTENTS_PATH . '/' . ProjectPagesFixture::PROJECTS[$index],
                    $locale,
                );
                \assert($project instanceof PageDocument);

                $blocks[] = [
                    'type' => 'project-teaser',
                    'image' => ['id' => $mediaId, 'displayOption' => null],
                    'title' => self::TITLE,
                    'subtitle' => self::SUBTITLE,
                    'description' => self::DESCRIPTIONS[$index],
                    'link' => ['provider' => 'page', 'href' => $project->getUuid(), 'locale' => $locale],
                ];
            }

            $home->getStructure()->bind(['blocks' => $blocks]);

            $documentManager->persist($home, $locale);
            $documentManager->publish($home, $locale);
        }

        $documentManager->flush();
    }

    public function getOrder(): int
    {
        return 20;
    }
}
