import { Controller } from '@hotwired/stimulus';
import { BELOW_DESKTOP } from '../breakpoints';

// data-controller="page-transition" — na linku koji NAPUŠTA stranicu što je ušla klizanjem
// (mobilni Information, „Back"). Ulazak crta CSS (`.page-information`, main.scss); izlazak ne može,
// jer Turbo zameni dokument istog trena pa animacija ne bi imala kad da se odigra.
//
// Klik se preseče, telo dobije `is-leaving` (CSS odigra klizanje nagore), pa se posle animacije klik
// ponovi — drugi put prolazi (`left`) i Turbo ga hvata kao svaki drugi. Bez Turbo API-ja: sintetički
// klik ide istim putem kao pravi, pa keš snapshota i scroll-memory rade nepromenjeno.
//
// Ne meša se kad: nije mobilni, korisnik traži manje pokreta, ili je klik namenjen novom tabu.
export default class PageTransitionController extends Controller<HTMLAnchorElement> {
    private static readonly DURATION = 320;

    private readonly mobile = window.matchMedia(BELOW_DESKTOP);
    private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    private left = false;

    disconnect(): void {
        this.left = false;
        document.body.classList.remove('is-leaving');
    }

    leave(event: MouseEvent): void {
        if (this.left || event.defaultPrevented) return;
        if (!this.mobile.matches || this.reducedMotion.matches) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        this.left = true;
        document.body.classList.add('is-leaving');

        window.setTimeout(() => this.element.click(), PageTransitionController.DURATION);
    }
}
