<?php

declare(strict_types=1);

namespace App\Controller;

use Sulu\Bundle\WebsiteBundle\Controller\DefaultController as SuluDefaultController;
use Sulu\Component\Content\Compat\StructureInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Stranice template-a `default` (Material, Press …).
 *
 * `in_preparation` (checkbox na stranici): naziv se vidi u meniju sivo i bez linka (header.html.twig), ali sama ruta
 * NE SME biti javna — inače je indeksirana i dostupna sa 200. Zato ovde ide 404, kroz standardni Sulu error pipeline.
 * U admin pregledu (preview) stranica se i dalje vidi, da urednik može da je uređuje.
 */
class DefaultController extends SuluDefaultController
{
    public function indexAction(StructureInterface $structure, $preview = false, $partial = false): Response
    {
        if (!$preview && $structure->hasProperty('in_preparation') && $structure->getPropertyValue('in_preparation')) {
            // getPropertyValueByTagName vraca mixed — Sulu compat sloj nije tipiziran. Kad rlp nije
            // upotrebljiv string, UUID je uvek dostupan identifikator za poruku izuzetka.
            $rlp = $structure->hasTag('sulu.rlp') ? $structure->getPropertyValueByTagName('sulu.rlp') : null;
            $url = \is_string($rlp) ? $rlp : $structure->getUuid();

            throw new NotFoundHttpException(\sprintf('Page "%s" is in preparation.', $url));
        }

        return parent::indexAction($structure, $preview, $partial);
    }
}
