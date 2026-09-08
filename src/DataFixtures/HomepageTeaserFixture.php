<?php

declare(strict_types=1);

namespace App\DataFixtures;

use Doctrine\ORM\EntityManagerInterface;
use Sulu\Bundle\DocumentManagerBundle\DataFixtures\DocumentFixtureInterface;
use Sulu\Bundle\MediaBundle\Collection\Manager\CollectionManagerInterface;
use Sulu\Bundle\MediaBundle\Entity\Collection;
use Sulu\Bundle\MediaBundle\Entity\CollectionRepositoryInterface;
use Sulu\Bundle\MediaBundle\Entity\MediaRepositoryInterface;
use Sulu\Bundle\MediaBundle\Media\Manager\MediaManagerInterface;
use Sulu\Bundle\PageBundle\Document\HomeDocument;
use Sulu\Bundle\SecurityBundle\Entity\User;
use Sulu\Component\DocumentManager\DocumentManager;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Homepage sadržaj po Figmi: lista od četiri `project-teaser` stavke (prva = F1/F2, F14/F15) na sr/en/ja.
 *
 * Ponovljiv: kolekcija se traži po ključu, medij po imenu fajla u kolekciji,
 * a blok se prepisuje. Pokreće se sa
 *   php bin/console sulu:document:fixtures:load --append
 * (ili preko `sulu:build dev`, koji zove isto sa --append).
 */
final class HomepageTeaserFixture implements DocumentFixtureInterface
{
    private const WEBSPACE = 'monos';
    private const LOCALES = ['sr', 'en', 'ja'];

    private const COLLECTION_KEY = 'monos.projects';
    private const COLLECTION_TITLE = 'Projects';
    private const FILES_DIR = __DIR__ . '/files';

    /**
     * Četiri stavke, redom kako stoje u Figmi: F1/F14 (lista u miru) počinju sa project-2 (mračni hodnik),
     * F2/F15 (raširena stavka) prikazuju project-1 (garderober) kao DRUGU stavku, sa project-2 koji viri iznad.
     * Fotografije su isečene iz Figma frame-ova: project-2 iz F1/F7, project-1 iz F2 (12:66),
     * project-3-wide iz F9 (17:39) — format 3:2, kao treća stavka u F1 (480×320); project-4 iz F13 (17:93).
     * Slike zadržavaju svoj format — lista ih ne seče na 4:5.
     */
    private const IMAGES = ['project-2.png', 'project-1.png', 'project-3-wide.png', 'project-4.png'];

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
    ];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly MediaManagerInterface $mediaManager,
        private readonly MediaRepositoryInterface $mediaRepository,
        #[Autowire(service: 'sulu_media.collection_manager')]
        private readonly CollectionManagerInterface $collectionManager,
    ) {
    }

    public function load(DocumentManager $documentManager): void
    {
        $userId = $this->userId();
        $collectionId = $this->collectionId($userId);
        $mediaIds = \array_map(
            fn (string $file): int => $this->media($file, $collectionId, $userId),
            self::IMAGES,
        );

        foreach (self::LOCALES as $locale) {
            $home = $documentManager->find('/cmf/' . self::WEBSPACE . '/contents', $locale);
            \assert($home instanceof HomeDocument);

            $blocks = [];
            foreach ($mediaIds as $index => $mediaId) {
                $blocks[] = [
                    'type' => 'project-teaser',
                    'image' => ['id' => $mediaId, 'displayOption' => null],
                    'title' => self::TITLE,
                    'subtitle' => self::SUBTITLE,
                    'description' => self::DESCRIPTIONS[$index],
                    // Projekti još ne postoje — „Enter" privremeno vodi na početnu.
                    'link' => ['provider' => 'page', 'href' => $home->getUuid(), 'locale' => $locale],
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
        return 10;
    }

    private function userId(): int
    {
        $user = $this->entityManager->getRepository(User::class)->findOneBy([], ['id' => 'ASC']);
        if (!$user instanceof User) {
            throw new \RuntimeException('Nema nijednog Sulu korisnika — prvo `sulu:security:user:create`.');
        }

        return $user->getId();
    }

    private function collectionId(int $userId): int
    {
        /** @var CollectionRepositoryInterface $repository */
        $repository = $this->entityManager->getRepository(Collection::class);
        $collection = $repository->findCollectionByKey(self::COLLECTION_KEY);
        if ($collection instanceof Collection) {
            return $collection->getId();
        }

        return $this->collectionManager->save([
            'key' => self::COLLECTION_KEY,
            'title' => self::COLLECTION_TITLE,
            'locale' => 'en',
            'type' => ['id' => 1],
        ], $userId)->getId();
    }

    private function media(string $fileName, int $collectionId, int $userId): int
    {
        $existing = $this->mediaRepository->findMediaWithFilenameInCollectionWithId($fileName, $collectionId);
        if (null !== $existing) {
            return $existing->getId();
        }

        // Kopija: storage čita sa putanje, a izvor u repou ostaje netaknut.
        $tmp = \tempnam(\sys_get_temp_dir(), 'monos-fixture-');
        \copy(self::FILES_DIR . '/' . $fileName, $tmp);

        try {
            $media = $this->mediaManager->save(
                new UploadedFile($tmp, $fileName, 'image/png', null, true),
                ['collection' => $collectionId, 'locale' => 'en', 'title' => \ucfirst(\str_replace('-', ' ', \pathinfo($fileName, \PATHINFO_FILENAME)))],
                $userId,
            );
        } finally {
            @\unlink($tmp);
        }

        return $media->getId();
    }
}
