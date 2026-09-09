<?php

declare(strict_types=1);

namespace App\DataFixtures;

use Doctrine\ORM\EntityManagerInterface;
use Sulu\Bundle\MediaBundle\Collection\Manager\CollectionManagerInterface;
use Sulu\Bundle\MediaBundle\Entity\Collection;
use Sulu\Bundle\MediaBundle\Entity\CollectionRepositoryInterface;
use Sulu\Bundle\MediaBundle\Entity\MediaRepositoryInterface;
use Sulu\Bundle\MediaBundle\Media\Manager\MediaManagerInterface;
use Sulu\Bundle\SecurityBundle\Entity\User;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Zajednički deo fixture-a: kolekcija „Projects" i slike iz `files/`.
 *
 * Ponovljiv: kolekcija se traži po ključu, medij po imenu fajla u kolekciji —
 * drugo pokretanje ne pravi duplikate.
 */
final class FixtureMedia
{
    private const COLLECTION_KEY = 'monos.projects';
    private const COLLECTION_TITLE = 'Projects';
    private const FILES_DIR = __DIR__ . '/files';

    private ?int $userId = null;
    private ?int $collectionId = null;

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly MediaManagerInterface $mediaManager,
        private readonly MediaRepositoryInterface $mediaRepository,
        #[Autowire(service: 'sulu_media.collection_manager')]
        private readonly CollectionManagerInterface $collectionManager,
    ) {
    }

    public function userId(): int
    {
        if (null !== $this->userId) {
            return $this->userId;
        }

        $user = $this->entityManager->getRepository(User::class)->findOneBy([], ['id' => 'ASC']);
        if (!$user instanceof User) {
            throw new \RuntimeException('Nema nijednog Sulu korisnika — prvo `sulu:security:user:create`.');
        }

        return $this->userId = $user->getId();
    }

    /**
     * @param list<string> $files
     *
     * @return list<int>
     */
    public function mediaIds(array $files): array
    {
        return \array_map($this->mediaId(...), $files);
    }

    public function mediaId(string $fileName): int
    {
        $collectionId = $this->collectionId();

        $existing = $this->mediaRepository->findMediaWithFilenameInCollectionWithId($fileName, $collectionId);
        if (null !== $existing) {
            return $existing->getId();
        }

        // Kopija: storage čita sa putanje, a izvor u repou ostaje netaknut.
        $tmp = \tempnam(\sys_get_temp_dir(), 'monos-fixture-');
        \copy(self::FILES_DIR . '/' . $fileName, $tmp);

        // Fotografije su JPEG (max 2400px; prave q82, Figma isečci za merenje q95 — razvojni podaci, ne smeju da opterete git).
        // PNG samo tamo gde merenje traži piksel-tačnost: crtež i dva isečka F12/F13 za expand view (w2400 ih ne prekodira).
        $mimeType = match (\strtolower(\pathinfo($fileName, \PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'image/png',
        };

        try {
            $media = $this->mediaManager->save(
                new UploadedFile($tmp, $fileName, $mimeType, null, true),
                [
                    'collection' => $collectionId,
                    'locale' => 'en',
                    'title' => \ucfirst(\str_replace('-', ' ', \pathinfo($fileName, \PATHINFO_FILENAME))),
                ],
                $this->userId(),
            );
        } finally {
            @\unlink($tmp);
        }

        return $media->getId();
    }

    private function collectionId(): int
    {
        if (null !== $this->collectionId) {
            return $this->collectionId;
        }

        /** @var CollectionRepositoryInterface $repository */
        $repository = $this->entityManager->getRepository(Collection::class);
        $collection = $repository->findCollectionByKey(self::COLLECTION_KEY);
        if ($collection instanceof Collection) {
            return $this->collectionId = $collection->getId();
        }

        return $this->collectionId = $this->collectionManager->save([
            'key' => self::COLLECTION_KEY,
            'title' => self::COLLECTION_TITLE,
            'locale' => 'en',
            'type' => ['id' => 1],
        ], $this->userId())->getId();
    }
}
