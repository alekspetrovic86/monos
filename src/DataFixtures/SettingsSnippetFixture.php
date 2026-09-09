<?php

declare(strict_types=1);

namespace App\DataFixtures;

use Sulu\Bundle\DocumentManagerBundle\DataFixtures\DocumentFixtureInterface;
use Sulu\Bundle\SnippetBundle\Document\SnippetDocument;
use Sulu\Bundle\SnippetBundle\Snippet\DefaultSnippetManagerInterface;
use Sulu\Component\DocumentManager\DocumentManager;
use Sulu\Component\DocumentManager\Exception\DocumentNotFoundException;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Settings snippet („webspace_settings" area) sa Monos kontakt i pravnim podacima — doslovno iz Figme F5/F19:
 *   Nikola Brajović, architect · +381 64 4146006 · info@monos.rs · nikola@monos.rs · Instagram
 *   Terms of use · Monos ©2026. All Rights Reserved. · Code by Seiora
 *
 * Ponovljiv: snippet se traži po PHPCR putanji, prepisuje i ponovo postavlja kao podrazumevani za area.
 */
final readonly class SettingsSnippetFixture implements DocumentFixtureInterface
{
    private const WEBSPACE = ProjectPagesFixture::WEBSPACE;
    private const LOCALES = ProjectPagesFixture::LOCALES;
    private const AREA = 'webspace_settings';
    // Snippet-e Sulu sam smešta pod /cmf/snippets/<template>/ (AliasFiling + StructureTypeFiling), ime iz naslova.
    private const PATH = '/cmf/snippets/settings/monos';
    private const TITLE = 'Monos';

    private const DATA = [
        'contact_name' => 'Nikola Brajović, architect',
        'contact_phone' => '+381 64 4146006',
        'contact_email' => 'info@monos.rs',
        'contact_email_secondary' => 'nikola@monos.rs',
        'instagram_url' => 'https://www.instagram.com/monos.rs/',
        'copyright' => 'Monos ©2026. All Rights Reserved.',
        'credit' => 'Code by Seiora',
    ];

    public function __construct(
        #[Autowire(service: 'sulu_snippet.default_snippet.manager')]
        private DefaultSnippetManagerInterface $defaultSnippetManager,
    ) {
    }

    public function load(DocumentManager $documentManager): void
    {
        $document = null;

        foreach (self::LOCALES as $locale) {
            try {
                $document = $documentManager->find(self::PATH, $locale);
            } catch (DocumentNotFoundException) {
                $document ??= $documentManager->create('snippet');
            }
            \assert($document instanceof SnippetDocument);

            $document->setLocale($locale);
            $document->setTitle(self::TITLE);
            $document->setStructureType('settings');
            $document->getStructure()->bind([
                ...self::DATA,
                // Uslovi korišćenja još nemaju stranicu — spoljni link na koren dok ne dobiju svoju rutu.
                // `link` tip traži i locale u vrednosti (Link::getViewData).
                'terms_link' => ['provider' => 'external', 'href' => 'https://monos.rs/', 'locale' => $locale],
            ]);

            // Putanju i ime daje Sulu (filing po template-u, ime iz naslova) — zato bez parent_path/node_name.
            $documentManager->persist($document, $locale);
            $documentManager->flush();
            $documentManager->publish($document, $locale);
            $documentManager->flush();
        }

        // Podrazumevani snippet za area (po webspace-u, ne po lokalizaciji).
        $this->defaultSnippetManager->save(self::WEBSPACE, self::AREA, $document->getUuid(), self::LOCALES[0]);
    }

    public function getOrder(): int
    {
        return 40;
    }
}
