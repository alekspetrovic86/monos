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
 * Homepage sadržaj po Figmi: jedan `project-teaser` blok (F1/F2, F14/F15) na sr/en/ja.
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
    private const IMAGE_PATH = __DIR__ . '/files/project-1.png';
    private const IMAGE_NAME = 'project-1.png';

    // Tekst doslovno iz Figme (isti na sve tri lokalizacije).
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
        $mediaId = $this->media($this->collectionId($userId), $userId);

        foreach (self::LOCALES as $locale) {
            $home = $documentManager->find('/cmf/' . self::WEBSPACE . '/contents', $locale);
            \assert($home instanceof HomeDocument);

            $home->getStructure()->bind([
                'blocks' => [
                    [
                        'type' => 'project-teaser',
                        'image' => ['id' => $mediaId, 'displayOption' => null],
                        'title' => self::TITLE,
                        'subtitle' => self::SUBTITLE,
                        // Projekti još ne postoje — „Enter" privremeno vodi na početnu.
                        'link' => ['provider' => 'page', 'href' => $home->getUuid(), 'locale' => $locale],
                    ],
                ],
            ]);

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

    private function media(int $collectionId, int $userId): int
    {
        $existing = $this->mediaRepository->findMediaWithFilenameInCollectionWithId(self::IMAGE_NAME, $collectionId);
        if (null !== $existing) {
            return $existing->getId();
        }

        // Kopija: storage čita sa putanje, a izvor u repou ostaje netaknut.
        $tmp = \tempnam(\sys_get_temp_dir(), 'monos-fixture-');
        \copy(self::IMAGE_PATH, $tmp);

        try {
            $media = $this->mediaManager->save(
                new UploadedFile($tmp, self::IMAGE_NAME, 'image/png', null, true),
                ['collection' => $collectionId, 'locale' => 'en', 'title' => 'Project 1'],
                $userId,
            );
        } finally {
            @\unlink($tmp);
        }

        return $media->getId();
    }
}
