<?php

declare(strict_types=1);

namespace App\DataFixtures;

use Sulu\Bundle\DocumentManagerBundle\DataFixtures\DocumentFixtureInterface;
use Sulu\Bundle\PageBundle\Document\PageDocument;
use Sulu\Component\DocumentManager\DocumentManager;
use Sulu\Component\DocumentManager\Exception\DocumentNotFoundException;

/**
 * Stranice projekata (template `project`), children naslovne, na sr/en/ja — po Figmi F7/F8/F11 i F21–F24.
 *
 * Četiri projekta, jedan po tizeru sa naslovne (redosled iz HomepageTeaserFixture), i stranice crteža
 * kao children prva dva — „→Drawings" se vidi samo tamo gde child postoji.
 *
 * Tekstovi su doslovno iz Figme; svi frame-ovi su prefiksi jednog istog dugog teksta (F8). Prvi slajd svakog
 * projekta je slika njegovog tizera. Figma isti projekat crta sa različitim dužinama teksta, pa se dužine dele:
 *   corridor      F7  — kratak tekst (stane u kadar, bez „Read more")                   → merenje 16:2
 *   wardrobe      F21 — mobilni tekst (do „in congue."), F22 skrolovan do kraja        → merenja 63:274, 63:285
 *   bedroom-wide  F23 — slika drugog formata (3:2), najkraći tekst                      → merenje 63:295
 *   bedroom       F8  — dug tekst („Read more" nastavlja ispod); 2. slajd = slika F8    → merenje 17:21 (next + Read more)
 *   crteži        F11 — 19 redova tačno (304px), crtež isečen iz reference 17:67        → merenja 17:67, 63:311
 *
 * Ponovljiv: stranica se traži po PHPCR putanji, pa se prepisuje. `sulu:document:fixtures:load --append`.
 */
final class ProjectPagesFixture implements DocumentFixtureInterface
{
    public const WEBSPACE = 'monos';
    public const LOCALES = ['sr', 'en', 'ja'];
    public const CONTENTS_PATH = '/cmf/' . self::WEBSPACE . '/contents';

    /** Node imena projekata, redom kao tizeri na naslovnoj. */
    public const PROJECTS = ['project-corridor', 'project-wardrobe', 'project-bedroom-wide', 'project-bedroom', 'project-photos'];
    private const DRAWINGS_NODE = 'drawings';

    // Naslov i podnaslov doslovno iz Figme (tri reda naslova = prelomi se čuvaju), isti na svim projektima.
    private const TITLE = "Lorem ipsum dolor sit amet\nDuis autem vel eum iriure dolor\nMolestie";
    private const SUBTITLE = 'Sed diam nonummy nibh euismod tincidunt ut laoreet';

    /**
     * @var array<string, array{images: list<string>, body: string, drawings: bool}>
     */
    private const PAGES = [
        'project-corridor' => [
            // 2. slajd = ista fotografija iz F12 (17:80) u punoj veličini 717×896 — merenje expand view-a (next + Expand view).
            // Prvi slajd ostaje isečak iz F7 (540×675) da 16:2 ostane piksel-tačan.
            'images' => ['project-2.jpg', 'project-2-full.png', 'project-1.jpg', 'project-4.jpg', 'project-3-wide.jpg'],
            'body' => self::BODY_SHORT,
            'drawings' => true,
        ],
        'project-wardrobe' => [
            'images' => ['project-1.jpg', 'project-2.jpg', 'project-4.jpg', 'project-3.jpg'],
            'body' => self::BODY_MOBILE,
            'drawings' => true,
        ],
        'project-bedroom-wide' => [
            // 2. slajd = fotografija iz F13 (17:93) u punoj veličini 1200×816 — merenje expand view-a (next + Expand view).
            'images' => ['project-3-wide.jpg', 'project-5-wide.png', 'project-3.jpg', 'project-1.jpg', 'project-2.jpg'],
            'body' => self::BODY_SHORTEST,
            'drawings' => false,
        ],
        'project-bedroom' => [
            'images' => ['project-4.jpg', 'project-2.jpg', 'project-1.jpg', 'project-3-wide.jpg'],
            'body' => self::BODY_LONG,
            'drawings' => false,
        ],
        // Prave fotografije iz Photos/ (Task 11R) — granice pravila za formate i expand view:
        // photo-wide 2400×1600 (1.500, original 3240×2160) i photo-tall 1215×2160 (0.562), JPEG. Lista/slajder ih dobijaju umanjene,
        // expand view učitava w2400. Peti tizer je van kadra F1/F2 (900px), pa ne ulazi u ta merenja.
        'project-photos' => [
            'images' => ['photo-wide.jpg', 'photo-tall.jpg', 'project-1.jpg', 'project-2.jpg'],
            'body' => self::BODY_SHORT,
            'drawings' => false,
        ],
    ];

    private const DRAWINGS_IMAGES = ['drawing-1.png'];

    private const BODY_SHORT =
        '<p>'
        . 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec accumsan est sit amet nisl bibendum, eu '
        . 'ultricies augue convallis. Mauris quis nulla nec erat semper commodo iaculis vel lorem. Vestibulum sodales '
        . 'risus consequat elit varius sagittis. Maecenas ut tincidunt justo, eu porta magna. Donec id luctus lectus, '
        . 'sit amet posuere lorem. Morbi volutpat, est sit amet auctor scelerisque, ligula ante consectetur ligula, eu '
        . 'efficitur mauris ex vitae libero.'
        . '</p>';

    private const BODY_LONG =
        '<p>'
        . 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec accumsan est sit amet nisl bibendum, eu '
        . 'ultricies augue convallis. Mauris quis nulla nec erat semper commodo iaculis vel lorem. Vestibulum sodales '
        . 'risus consequat elit varius sagittis. Maecenas ut tincidunt justo, eu porta magna. Donec id luctus lectus, '
        . 'sit amet posuere lorem. Morbi volutpat, est sit amet auctor scelerisque, ligula ante consectetur ligula, eu '
        . 'efficitur mauris ex vitae libero. Cras molestie ipsum erat, non congue tortor egestas eu. Sed sit amet '
        . 'molestie risus. Etiam egestas nibh dictum, venenatis lectus eu, condimentum felis. Vestibulum tincidunt '
        . 'iaculis nisl at fermentum. Sed tincidunt sed odio id ullamcorper. Aenean facilisis libero nec erat suscipit '
        . 'ultricies. Pellentesque maximus vitae turpis ac tempus. Nam dignissim placerat consequat. Sed scelerisque '
        . 'quis velit in congue.'
        . '</p>'
        .         '<p>'
        . 'Nunc porttitor id lorem in pellentesque. Nulla neque velit, facilisis gravida ante non, convallis volutpat '
        . 'lacus. Proin ante augue, consequat sollicitudin ornare sed, iaculis eget odio. Phasellus sem ipsum, mollis '
        . 'ac ante vel, mattis tempor orci. Quisque nisi elit, tincidunt at imperdiet eu, vehicula a lorem. Nam pretium '
        . 'vitae ex et aliquam. Sed ligula magna, interdum iaculis eleifend eget, aliquet non velit. Vestibulum eu '
        . 'ipsum orci. Nulla quis justo ultrices turpis hendrerit condimentum eget nec eros. Donec varius ut ante eget '
        . 'convallis. Nunc tincidunt libero sed ultrices bibendum.'
        . '</p>'
        .         '<p>'
        . 'Nulla facilisi. Proin in faucibus tellus. Nunc hendrerit semper est, eu sodales elit convallis ac. Aenean '
        . 'egestas eu neque vel ultrices. Proin turpis massa, aliquet quis fringilla porta, ultricies quis quam. Morbi '
        . 'vestibulum arcu orci, non vulputate lectus pharetra quis. Sed porta orci vitae nibh gravida, non lobortis '
        . 'ante tristique. Vestibulum ac blandit lacus. Aliquam nisl lacus, placerat aliquet malesuada quis, sodales a '
        . 'justo. Aliquam blandit risus id semper scelerisque. Pellentesque congue imperdiet enim, eu blandit purus '
        . 'vestibulum in.'
        . '</p>'
        .         '<p>'
        . 'Nunc at facilisis velit, euismod dictum enim. Fusce velit quam, molestie ac erat et, faucibus pharetra '
        . 'felis. Nam auctor tempus urna et aliquam. Cras consectetur tempor nisi a iaculis. Nam eu orci pellentesque, '
        . 'facilisis tortor in, sagittis erat. Duis nec mauris gravida, rutrum tortor sed, convallis est. Duis tellus '
        . 'lectus, tristique sed vulputate sed, bibendum id ex. Vivamus nec est ac metus vulputate feugiat. Ut vel '
        . 'lobortis metus. Mauris nec neque facilisis, luctus dui eu, tristique nisl. Aenean posuere eu mi eget '
        . 'consectetur. Morbi egestas dignissim mattis.'
        . '</p>'
        .         '<p>'
        . 'Ut semper tempus sem, a venenatis leo vehicula vitae. Nam sit amet nunc dictum, pulvinar felis a, hendrerit '
        . 'ipsum. Suspendisse et lorem accumsan, vehicula nisl nec, congue tortor. Aliquam eget felis dictum, congue '
        . 'augue vitae, commodo augue. Sed maximus commodo mauris, id vehicula ipsum. Fusce et turpis risus. Donec at '
        . 'ante non velit bibendum fermentum et at purus. Integer eget dui at sem blandit lobortis a ut nisl.'
        . '</p>';

    private const BODY_MOBILE =
        '<p>'
        . 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec accumsan est sit amet nisl bibendum, eu '
        . 'ultricies augue convallis. Mauris quis nulla nec erat semper commodo iaculis vel lorem. Vestibulum sodales '
        . 'risus consequat elit varius sagittis. Maecenas ut tincidunt justo, eu porta magna. Donec id luctus lectus, '
        . 'sit amet posuere lorem. Morbi volutpat, est sit amet auctor scelerisque, ligula ante consectetur ligula, eu '
        . 'efficitur mauris ex vitae libero. Cras molestie ipsum erat, non congue tortor egestas eu. Sed sit amet '
        . 'molestie risus. Etiam egestas nibh dictum, venenatis lectus eu, condimentum felis. Vestibulum tincidunt '
        . 'iaculis nisl at fermentum. Sed tincidunt sed odio id ullamcorper. Aenean facilisis libero nec erat suscipit '
        . 'ultricies. Pellentesque maximus vitae turpis ac tempus. Nam dignissim placerat consequat. Sed scelerisque '
        . 'quis velit in congue.'
        . '</p>';

    private const BODY_DRAWINGS =
        '<p>'
        . 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec accumsan est sit amet nisl bibendum, eu '
        . 'ultricies augue convallis. Mauris quis nulla nec erat semper commodo iaculis vel lorem. Vestibulum sodales '
        . 'risus consequat elit varius sagittis. Maecenas ut tincidunt justo, eu porta magna. Donec id luctus lectus, '
        . 'sit amet posuere lorem. Morbi volutpat, est sit amet auctor scelerisque, ligula ante consectetur ligula, eu '
        . 'efficitur mauris ex vitae libero. Cras molestie ipsum erat, non congue tortor egestas eu. Sed sit amet '
        . 'molestie risus. Etiam egestas nibh dictum, venenatis lectus eu, condimentum felis. Vestibulum tincidunt '
        . 'iaculis nisl at fermentum. Sed tincidunt sed odio id ullamcorper. Aenean facilisis libero nec erat suscipit '
        . 'ultricies. Pellentesque maximus vitae turpis ac tempus. Nam dignissim placerat consequat. Sed scelerisque '
        . 'quis velit in congue.'
        . '</p>'
        .         '<p>'
        . 'Nunc porttitor id lorem in pellentesque. Nulla neque velit, facilisis gravida ante non, convallis volutpat '
        . 'lacus. Proin ante augue, consequat sollicitudin ornare sed, iaculis eget odio. Phasellus sem ipsum, mollis '
        . 'ac ante vel, mattis tempor orci. Quisque nisi elit, tincidunt at imperdiet eu, vehicula a lorem. Nam pretium '
        . 'vitae ex et aliquam. Sed ligula magna, interdum iaculis eleifend eget, aliquet non velit. Vestibulum eu '
        . 'ipsum orci. Nulla quis justo ultrices turpis hendrerit condimentum eget nec eros. Donec varius ut ante eget '
        . 'convallis. Nunc tincidunt libero sed ultrices bibendum.'
        . '</p>';

    private const BODY_SHORTEST =
        '<p>'
        . 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec accumsan est sit amet nisl bibendum, eu '
        . 'ultricies augue convallis. Mauris quis nulla nec erat semper commodo iaculis vel lorem. Vestibulum sodales '
        . 'risus consequat elit varius sagittis. Maecenas ut tincidunt justo, eu porta magna. Donec id luctus lectus, '
        . 'sit amet posuere lorem.'
        . '</p>';

    public function __construct(
        private readonly FixtureMedia $media,
    ) {
    }

    public function load(DocumentManager $documentManager): void
    {
        foreach (self::PAGES as $nodeName => $page) {
            $project = $this->page(
                $documentManager,
                self::CONTENTS_PATH,
                $nodeName,
                '/' . $nodeName,
                self::TITLE,
                $this->media->mediaIds($page['images']),
                $page['body'],
            );

            if ($page['drawings']) {
                $this->page(
                    $documentManager,
                    $project->getPath(),
                    self::DRAWINGS_NODE,
                    '/' . $nodeName . '/' . self::DRAWINGS_NODE,
                    // Crteži nose naslov projekta (F11): ista stranica, druge slike.
                    self::TITLE,
                    $this->media->mediaIds(self::DRAWINGS_IMAGES),
                    self::BODY_DRAWINGS,
                );
            }
        }

        $documentManager->flush();
    }

    public function getOrder(): int
    {
        return 10;
    }

    /**
     * @param list<int> $mediaIds
     */
    private function page(
        DocumentManager $documentManager,
        string $parentPath,
        string $nodeName,
        string $resourceSegment,
        string $title,
        array $mediaIds,
        string $body,
    ): PageDocument {
        $path = $parentPath . '/' . $nodeName;
        $document = null;
        $created = false;

        foreach (self::LOCALES as $locale) {
            try {
                $document = $documentManager->find($path, $locale);
            } catch (DocumentNotFoundException) {
                $document = $document ?? $documentManager->create('page');
                $created = true;
            }
            \assert($document instanceof PageDocument);

            $document->setLocale($locale);
            $document->setTitle($title);
            $document->setStructureType('project');
            $document->setResourceSegment($resourceSegment);
            $document->getStructure()->bind([
                'images' => ['ids' => $mediaIds, 'displayOption' => null],
                'subtitle' => self::SUBTITLE,
                'body' => $body,
            ]);

            // Node ime je zadato (svi projekti imaju isti Figma naslov, pa auto-ime iz naslova ne sme ni da
            // kreira ni da preimenuje); putanja se zadaje samo pri kreiranju.
            $documentManager->persist($document, $locale, [
                'auto_name' => false,
                ...($created ? ['parent_path' => $parentPath, 'node_name' => $nodeName] : []),
            ]);
            // Flush PRE objave: ruta nastala pri persist-u mora biti snimljena da bi je objava našla
            // i prepisala u live workspace (jackalope-doctrine-dbal ne vidi reference iz nesnimljene sesije).
            $documentManager->flush();
            $documentManager->publish($document, $locale);
            $documentManager->flush();
        }

        \assert($document instanceof PageDocument);

        return $document;
    }
}
