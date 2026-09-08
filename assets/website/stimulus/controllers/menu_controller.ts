import { ActionEvent, Controller } from '@hotwired/stimulus';

// data-controller="menu" — header: logo/CLOSE, Reset, nav i podmeniji.
// Stanje: `open` (meni) + `activeKey` (najviše jedan otvoren podmeni).
// Esc stiže deklarativno: data-action="keydown.esc@document->menu#close".
export default class MenuController extends Controller<HTMLElement> {
    static targets = ['toggle', 'logoLabel', 'reset', 'overlay', 'nav', 'item', 'submenu'];

    declare readonly toggleTarget: HTMLButtonElement;
    declare readonly logoLabelTarget: HTMLElement;
    declare readonly resetTarget: HTMLElement;
    declare readonly overlayTarget: HTMLElement;
    declare readonly navTarget: HTMLElement;
    declare readonly itemTargets: HTMLElement[];
    declare readonly submenuTargets: HTMLElement[];
    declare readonly hasOverlayTarget: boolean;

    private open = false;
    private activeKey: string | null = null;

    connect(): void {
        this.render();
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

    private render(): void {
        this.logoLabelTarget.textContent = this.open ? 'CLOSE' : 'Monos';
        this.logoLabelTarget.classList.toggle('u-tracked', this.open);
        this.toggleTarget.setAttribute('aria-expanded', String(this.open));

        this.navTarget.hidden = !this.open;
        this.resetTarget.hidden = !this.open;
        if (this.hasOverlayTarget) this.overlayTarget.hidden = !this.open;

        this.itemTargets.forEach((item) => {
            item.setAttribute('aria-expanded', String(item.dataset.menuKeyParam === this.activeKey));
        });
        this.submenuTargets.forEach((submenu) => {
            submenu.hidden = submenu.dataset.menuSubmenuKey !== this.activeKey;
        });
    }
}
