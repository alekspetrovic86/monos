import { Controller } from '@hotwired/stimulus';

// data-controller="read-more" — tekst desno od slike na stranici projekta (F7 16:2 → F8 17:21).
// Kadar (target `excerpt`) je na desktopu sečen na 19 redova (CSS, samo sa JS-om). Ako tekst ne stane,
// pokaže se „Read more" (target `toggle`); klik otkriva nastavak (target `rest`) ispod baseline reda,
// „Read less" ga sklanja. Na mobilnom ovoga nema — kadar nije sečen, tekst skroluje.
export default class ReadMoreController extends Controller<HTMLElement> {
    static targets = ['excerpt', 'toggle', 'rest'];
    static values = { more: String, less: String };

    declare readonly excerptTarget: HTMLElement;
    declare readonly toggleTarget: HTMLButtonElement;
    declare readonly restTarget: HTMLElement;
    declare readonly moreValue: string;
    declare readonly lessValue: string;

    private expanded = false;
    private readonly desktop = window.matchMedia('(min-width: 1024px)');

    connect(): void {
        this.render();
        this.desktop.addEventListener('change', this.render);
        window.addEventListener('resize', this.render);
    }

    disconnect(): void {
        this.desktop.removeEventListener('change', this.render);
        window.removeEventListener('resize', this.render);
    }

    toggle(): void {
        this.expanded = !this.expanded;
        this.render();
    }

    private render = (): void => {
        // Kadar je sečen samo na desktopu (CSS) — tamo prelivanje znači da postoji nastavak.
        const overflows = this.desktop.matches && this.excerptTarget.scrollHeight > this.excerptTarget.clientHeight;
        if (!overflows) this.expanded = false;

        this.toggleTarget.hidden = !overflows;
        this.toggleTarget.textContent = this.expanded ? this.lessValue : this.moreValue;
        this.toggleTarget.setAttribute('aria-expanded', String(this.expanded));
        this.restTarget.hidden = !this.expanded;
    };
}
