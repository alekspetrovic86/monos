<?php

declare(strict_types=1);

namespace App\DataFixtures;

use Sulu\Bundle\DocumentManagerBundle\DataFixtures\DocumentFixtureInterface;
use Sulu\Bundle\PageBundle\Document\PageDocument;
use Sulu\Component\Content\Document\RedirectType;
use Sulu\Component\DocumentManager\DocumentManager;
use Sulu\Component\DocumentManager\Exception\DocumentNotFoundException;

/**
 * Stranice menija (kontekst „main") na sr/en/ja — dva nivoa navigacije (Figma F3 12:84, F5 12:109, F19 62:240).
 *
 *   Material      nivo 1, aktivan — dugme koje otvara podmeni
 *     All         nivo 2, interni link na naslovnu (lista svih projekata); u prvoj fazi jedini child
 *   Press         nivo 1, `in_preparation` — naziv se vidi svetlije sivo, nije link, nema podmeni
 *   Information   nivo 1, template `information` — tekstovi doslovno iz Figme (F5/F19)
 *
 * Naslovi su isti na sve tri lokalizacije (prevodi su Task 13R). Ponovljiv: stranica se traži po PHPCR
 * putanji pa prepisuje. `sulu:document:fixtures:load --append` (ili `sulu:build dev`).
 */
final class NavigationPagesFixture implements DocumentFixtureInterface
{
    private const LOCALES = ProjectPagesFixture::LOCALES;
    private const CONTENTS_PATH = ProjectPagesFixture::CONTENTS_PATH;
    private const NAV_CONTEXT = 'main';

    // Uvod doslovno iz Figme (F5: 11 redova u 642px; F19: 18 redova u 367px). Drugi pasus počinje u novom redu bez praznog reda.
    private const INTRO =
        '<p>'
        . 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet '
        . 'dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit '
        . 'lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit '
        . 'esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim '
        . 'qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit '
        . 'amet, cons ectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat '
        . 'volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip '
        . 'ex ea commodo consequat.'
        . '</p>'
        . '<p>'
        . 'Esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto.'
        . '</p>';

    public function load(DocumentManager $documentManager): void
    {
        $material = $this->page($documentManager, self::CONTENTS_PATH, 'material', '/material', 'Material', 'default', []);

        // „All" = interni link na naslovnu: navigacija dobija URL cilja (ContentMapper zamenjuje RL za interne linkove).
        $this->page($documentManager, $material->getPath(), 'all', '/material/all', 'All', 'default', [], true);

        $this->page($documentManager, self::CONTENTS_PATH, 'press', '/press', 'Press', 'default', ['in_preparation' => true]);

        $this->page($documentManager, self::CONTENTS_PATH, 'information', '/information', 'Information', 'information', [
            'intro_text' => self::INTRO,
            'contact_text' => '',
            'legal_text' => '',
        ]);
    }

    public function getOrder(): int
    {
        return 30;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function page(
        DocumentManager $documentManager,
        string $parentPath,
        string $nodeName,
        string $resourceSegment,
        string $title,
        string $template,
        array $data,
        bool $linkToHome = false,
    ): PageDocument {
        $path = $parentPath . '/' . $nodeName;
        $document = null;
        $created = false;

        foreach (self::LOCALES as $locale) {
            try {
                $document = $documentManager->find($path, $locale);
            } catch (DocumentNotFoundException) {
                $document ??= $documentManager->create('page');
                $created = true;
            }
            \assert($document instanceof PageDocument);

            $document->setLocale($locale);
            $document->setTitle($title);
            $document->setStructureType($template);
            $document->setResourceSegment($resourceSegment);
            $document->setNavigationContexts([self::NAV_CONTEXT]);
            $document->getStructure()->bind($data);

            if ($linkToHome) {
                $document->setRedirectType(RedirectType::INTERNAL);
                $document->setRedirectTarget($documentManager->find(self::CONTENTS_PATH, $locale));
            }

            // Isti obrazac kao ProjectPagesFixture: zadato node ime, putanja samo pri kreiranju,
            // flush PRE objave da ruta stigne u live workspace.
            $documentManager->persist($document, $locale, [
                'auto_name' => false,
                ...($created ? ['parent_path' => $parentPath, 'node_name' => $nodeName] : []),
            ]);
            $documentManager->flush();
            $documentManager->publish($document, $locale);
            $documentManager->flush();

            $created = false;
        }

        return $document;
    }
}
