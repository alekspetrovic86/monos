<?php

declare(strict_types=1);

use TwigCsFixer\Config\Config;
use TwigCsFixer\File\Finder;
use TwigCsFixer\Rules\Variable\VariableNameRule;
use TwigCsFixer\Ruleset\Ruleset;
use TwigCsFixer\Standard\TwigCsFixer;

$ruleset = new Ruleset();
$ruleset->addStandard(new TwigCsFixer());

// Podvlaka na pocetku oznacava promenljivu koja postoji samo unutar sablona (`_images`, `_parent`),
// za razliku od onih koje daje Sulu (`content`, `extension`, `app`). Pravilo za to ima ugradjenu
// opciju `optionalPrefix` — ostalo je i dalje snake_case.
$ruleset->overrideRule(new VariableNameRule(VariableNameRule::SNAKE_CASE, '_'));

$finder = new Finder();
$finder->in('templates/');

$config = new Config();
$config->allowNonFixableRules();
$config->setRuleset($ruleset);
$config->setFinder($finder);

// $config->addTwigExtension(new Sulu\Twig\Extensions\PortalExtension());
// $config->addTokenParser(new Sulu\Twig\Extensions\TokenParser\PortalTokenParser());

return $config;
