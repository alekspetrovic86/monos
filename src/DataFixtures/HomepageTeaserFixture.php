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
 * Homepage sadržaj po Figmi: četiri `project-teaser` bloka (prvi = F1/F2, F14/F15) na sr/en/ja.
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
     * Četiri tizera, redom kako stoje na stranici. Fotografije su isečene iz Figma frame-ova:
     * project-1 iz F1/F2 (12:66), project-2 iz F7 (16:2), project-3 iz F9 (17:39), project-4 iz F13 (17:93).
     */
    private const IMAGES = ['project-1.png', 'project-2.png', 'project-3.png', 'project-4.png'];

    // Tekst doslovno iz Figme (isti na sve tri lokalizacije i na svim tizerima — test podatak).
    private const TITLE = "Lorem ipsum dolor sit amet\nDuis autem vel eum iriure dolor\nMolestie";
    private const SUBTITLE = 'Sed diam nonummy nibh euismod tincidunt ut laoreet';

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
            foreach ($mediaIds as $mediaId) {
                $blocks[] = [
                    'type' => 'project-teaser',
                    'image' => ['id' => $mediaId, 'displayOption' => null],
                    'title' => self::TITLE,
                    'subtitle' => self::SUBTITLE,
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
