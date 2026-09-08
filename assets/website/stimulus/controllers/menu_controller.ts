import { ActionEvent, Controller } from '@hotwired/stimulus';

// data-controller="menu" — na <body>. Header: logo/CLOSE, Reset, nav, podmeniji.
// Sadržaj stranice (target `content`) je `inert` dok je meni otvoren pod mobilnim overlayem.
// Stanje: `open` (meni) + `activeKey` (najviše jedan otvoren podmeni).
// Esc stiže deklarativno: data-action="keydown.esc@document->menu#close".
//
// Progresivno poboljšanje: server šalje meni OTVOREN (bez `hidden`); CSS ga sakriva samo
// na `html.js:not(.menu-ready)`. connect() prvo primeni zatvoreno stanje kroz `hidden`,
// pa doda `menu-ready` — nema treperenja, a bez JS-a je sva navigacija dostupna.
export default class MenuController extends Controller<HTMLElement> {
    static targets = ['toggle', 'logoLabel', 'reset', 'overlay', 'nav', 'item', 'submenu', 'content'];

    declare readonly toggleTarget: HTMLButtonElement;
    declare readonly logoLabelTarget: HTMLElement;
    declare readonly resetTarget: HTMLElement;
    declare readonly overlayTarget: HTMLElement;
    declare readonly navTarget: HTMLElement;
    declare readonly itemTargets: HTMLElement[];
    declare readonly submenuTargets: HTMLElement[];
    declare readonly contentTarget: HTMLElement;
    declare readonly hasOverlayTarget: boolean;
    declare readonly hasContentTarget: boolean;

    private open = false;
    private activeKey: string | null = null;

    // Isti prag kao Tailwind `lg:` (64rem) — ispod njega postoji overlay.
    private readonly desktop = window.matchMedia('(min-width: 1024px)');

    connect(): void {
        this.render();
        document.documentElement.classList.add('menu-ready');
        this.desktop.addEventListener('change', this.onViewportChange);
    }

    disconnect(): void {
        this.desktop.removeEventListener('change', this.onViewportChange);
        document.documentElement.classList.remove('menu-ready');
        if (this.hasContentTarget) this.contentTarget.removeAttribute('inert');
    }

    toggle(): void {
        this.open = !this.open;
        if (!this.open) this.activeKey = null;
        this.render();
    }

    close(): void {
        if (!this.open) return;
        this.open = false;
        this.activeKey = null;
        this.render();
        // Fokus se vraća na dugme koje je meni otvorilo.
        this.toggleTarget.focus();
    }

    // Klik na Material / Press / En. Ista stavka drugi put → zatvara svoj podmeni.
    // „Information" nema podmeni — to je običan link, ne prolazi ovuda.
    select(event: ActionEvent): void {
        const key = String(event.params.key);
        this.activeKey = this.activeKey === key ? null : key;
        this.render();
    }

    // Promena širine dok je meni otvoren: overlay se pojavi/nestane, `inert` prati.
    private onViewportChange = (): void => {
        this.render();
    };

    private render(): void {
        this.logoLabelTarget.textContent = this.open ? 'CLOSE' : 'Monos';
        this.logoLabelTarget.classList.toggle('u-tracked', this.open);
        this.toggleTarget.setAttribute('aria-expanded', String(this.open));

        this.navTarget.hidden = !this.open;
        this.resetTarget.hidden = !this.open;
        if (this.hasOverlayTarget) this.overlayTarget.hidden = !this.open;

        // Mobilni overlay prekriva sadržaj — sadržaj tada ne sme biti u tab redosledu.
        if (this.hasContentTarget) {
            this.contentTarget.toggleAttribute('inert', this.open && !this.desktop.matches);
        }

        this.itemTargets.forEach((item) => {
            item.setAttribute('aria-expanded', String(item.dataset.menuKeyParam === this.activeKey));
        });
        this.submenuTargets.forEach((submenu) => {
            submenu.hidden = submenu.dataset.menuSubmenuKey !== this.activeKey;
        });
    }
}
