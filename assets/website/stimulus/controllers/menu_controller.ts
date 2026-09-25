import { ActionEvent, Controller } from '@hotwired/stimulus';
import { DESKTOP } from '../breakpoints';

// data-controller="menu" — na <body>. Header: logo/CLOSE, Reset, nav, podmeniji.
// Sadržaj stranice (target `content`) je `inert` dok je meni otvoren pod mobilnim overlayem.
// Stanje: `open` (meni) + `activeKey` (najviše jedan otvoren podmeni).
// Esc stiže deklarativno: data-action="keydown.esc@document->menu#close".
//
// Progresivno poboljšanje: server šalje meni OTVOREN (bez `hidden`); CSS ga sakriva samo
// na `html.js:not(.menu-ready)`. connect() prvo primeni početno stanje kroz `hidden`,
// pa doda `menu-ready` — nema treperenja, a bez JS-a je sva navigacija dostupna.
//
// Na mobilnom se meni spušta odozgo i vraća nagore (`menu-plate` u main.scss, isti pokret kao Information
// popup). Otvaranje ne traži ništa od kontrolera — animacija krene čim sloj prestane da bude `hidden`.
// Zatvaranje traži: sloj mora ostati iscrtan dok se animacija odigra, pa `hidden` stiže tek posle nje
// (`menu-closing` na <body>). Bez toga bi `display: none` presekao pokret u prvom kadru.
//
// Početno stanje zadaje server (values): naslovna je zatvorena; Information stranica je otvorena
// sa podmenijem „information" (tri tekstualne zone su podmeni tog ključa — vidi header.html.twig).
// Tamo je `toggle` LINK (CLOSE → lista, scroll-memory#carry), ne dugme: Information bez menija nema smisla,
// pa i Esc vodi na listu — close() prati link umesto da gasi meni.
// Nivoi menija su u HTML-u (Sulu navigacija) — kontroler zna samo za ključeve stavki i podmenija.
export default class MenuController extends Controller<HTMLElement> {
    static targets = ['toggle', 'logoLabel', 'reset', 'overlay', 'nav', 'item', 'submenu', 'content'];
    static values = { open: Boolean, activeKey: String };

    declare readonly toggleTarget: HTMLElement;
    declare readonly logoLabelTarget: HTMLElement;
    declare readonly resetTarget: HTMLElement;
    declare readonly overlayTarget: HTMLElement;
    declare readonly navTarget: HTMLElement;
    declare readonly itemTargets: HTMLElement[];
    declare readonly submenuTargets: HTMLElement[];
    declare readonly contentTarget: HTMLElement;
    declare readonly hasOverlayTarget: boolean;
    declare readonly hasContentTarget: boolean;
    declare readonly openValue: boolean;
    declare readonly activeKeyValue: string;

    private open = false;
    private activeKey: string | null = null;

    // Isti prag kao Tailwind `lg:` (64rem) — ispod njega postoji overlay.
    private readonly desktop = window.matchMedia(DESKTOP);
    private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Mora se poklapati sa trajanjem `menu-lift` u main.scss.
    private static readonly EXIT = 320;

    // „Back" sa Information vraća na listu SA otvorenim menijem — njime se i došlo tamo.
    private static readonly RETURN_KEY = 'menu:return';

    private closeTimer = 0;

    connect(): void {
        const vracanje = this.returning();
        this.open = this.openValue || vracanje;
        this.activeKey = this.open ? this.restKey : null;

        // Povratak zatiče meni otvoren — ne otvara ga pred korisnikom, nego je već tu.
        // Klasa se NE skida odmah: `menu-drop` je animacija, a ne prelaz, pa bi skidanje klase vratilo
        // `animation` sa `none` na `menu-drop` i time je POKRENULO. Zato ostaje do prvog dodira korisnika
        // (`toggle`), gde se skida pre promene stanja da bi zatvaranje normalno odigralo.
        if (vracanje) this.element.classList.add('menu-instant');
        this.render();

        document.documentElement.classList.add('menu-ready');
        this.desktop.addEventListener('change', this.onViewportChange);
    }

    disconnect(): void {
        this.stopClosing();
        this.desktop.removeEventListener('change', this.onViewportChange);
        document.documentElement.classList.remove('menu-ready');
        if (this.hasContentTarget) this.contentTarget.removeAttribute('inert');
    }

    toggle(): void {
        // Prvi dodir posle povratka vraća animacije — vidi `menu-instant` u connect().
        this.element.classList.remove('menu-instant');
        this.open = !this.open;
        this.activeKey = this.open ? this.restKey : null;
        this.render();
    }

    close(): void {
        if (!this.open) return;
        // Information: CLOSE je link nazad na listu — Esc radi isto (menu bez zona ne postoji kao stanje).
        if (this.toggleTarget instanceof HTMLAnchorElement) {
            this.toggleTarget.click();
            return;
        }
        this.open = false;
        this.activeKey = null;
        this.render();
        // Fokus se vraća na dugme koje je meni otvorilo.
        this.toggleTarget.focus();
    }

    // „Back" na Information (mobilni): natpis kaže povratak, ne zatvaranje — pa se lista otvara sa
    // menijem, onakvim kakav je bio kad se otišlo. Na desktopu je na tom mestu „CLOSE" i tamo se meni
    // zaista gasi; ovo je `lg:hidden`, pa ga ne dodiruje.
    keepOpen(): void {
        sessionStorage.setItem(MenuController.RETURN_KEY, '1');
    }

    // Marker traje do PRAVOG crtanja: Turbo prvo pokaže keširani snapshot, pa tek onda sveže renderovanu
    // stranicu — isto kao u scroll-memory kontroleru.
    private returning(): boolean {
        if (sessionStorage.getItem(MenuController.RETURN_KEY) !== '1') return false;

        if (!document.documentElement.hasAttribute('data-turbo-preview')) {
            sessionStorage.removeItem(MenuController.RETURN_KEY);
        }

        return true;
    }

    // Klik na Material / En (stavke sa podmenijem). Ista stavka drugi put → zatvara svoj podmeni i vraća
    // podmeni mirovanja stranice (na Information: tekstualne zone; na naslovnoj: ništa).
    // „Information" nema decu — to je običan link, ne prolazi ovuda.
    select(event: ActionEvent): void {
        const key = String(event.params.key);
        this.activeKey = this.activeKey === key ? this.restKey : key;
        this.render();
    }

    // Podmeni u mirovanju otvorenog menija: `data-menu-active-key-value` (Information: „information"), inače nijedan.
    private get restKey(): string | null {
        return this.activeKeyValue || null;
    }

    // Promena širine dok je meni otvoren: overlay se pojavi/nestane, `inert` prati.
    private onViewportChange = (): void => {
        this.render();
    };

    private render(): void {
        // Natpisi dolaze iz Twig-a (data-label-open = prevedeno „CLOSE", data-label-closed = „Monos").
        const { labelOpen = 'CLOSE', labelClosed = 'Monos' } = this.logoLabelTarget.dataset;
        this.logoLabelTarget.textContent = this.open ? labelOpen : labelClosed;
        this.logoLabelTarget.classList.toggle('u-tracked', this.open);
        if (this.toggleTarget instanceof HTMLButtonElement) this.toggleTarget.setAttribute('aria-expanded', String(this.open));

        if (this.open) {
            this.stopClosing();
            this.setPlateHidden(false);
        } else if (this.slides()) {
            this.startClosing();
        } else {
            this.stopClosing();
            this.setPlateHidden(true);
        }

        // Mobilni overlay prekriva sadržaj — sadržaj tada ne sme biti u tab redosledu.
        // `inert` prati overlay koji je STVARNO iscrtan: na Information stranici na mobilnom overlaya nema
        // (F19 — zone su u toku stranice i moraju ostati klikabilne).
        if (this.hasContentTarget) {
            const covered =
                this.open && !this.desktop.matches && this.hasOverlayTarget && this.overlayTarget.getClientRects().length > 0;
            this.contentTarget.toggleAttribute('inert', covered);
        }

        this.itemTargets.forEach((item) => {
            item.setAttribute('aria-expanded', String(item.dataset.menuKeyParam === this.activeKey));
        });
        this.submenuTargets.forEach((submenu) => {
            submenu.hidden = submenu.dataset.menuSubmenuKey !== this.activeKey;
        });
    }

    // Kliza samo tamo gde ploča i postoji: mobilni, sa overlayem koji je STVARNO iscrtan
    // (na Information stranici na mobilnom ga nema) i kad korisnik ne traži manje pokreta.
    private slides(): boolean {
        if (this.desktop.matches || this.reducedMotion.matches) return false;

        return this.hasOverlayTarget && this.overlayTarget.getClientRects().length > 0;
    }

    private startClosing(): void {
        if (this.closeTimer) return;

        this.element.classList.add('menu-closing');
        this.closeTimer = window.setTimeout(() => {
            this.closeTimer = 0;
            this.element.classList.remove('menu-closing');
            this.setPlateHidden(true);
        }, MenuController.EXIT);
    }

    private stopClosing(): void {
        window.clearTimeout(this.closeTimer);
        this.closeTimer = 0;
        this.element.classList.remove('menu-closing');
    }

    private setPlateHidden(hidden: boolean): void {
        this.navTarget.hidden = hidden;
        this.resetTarget.hidden = hidden;
        if (this.hasOverlayTarget) this.overlayTarget.hidden = hidden;
    }
}
