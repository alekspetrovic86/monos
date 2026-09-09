import { Controller } from '@hotwired/stimulus';

// data-controller="loader" — traka od 1px na vrhu ekrana (.global-loader, main.scss) koja se puni tokom Turbo navigacije.
// Prenesena iz Seiore (loader_controller.ts) sa Monos vrednostima; bez spinnera, bez preklapanja ekrana.
//
//   turbo:visit → 0 → 90 % postepeno (nasumični priraštaj 1–4 % na 200 ms, staje na 90 dok zahtev traje)
//   turbo:load  → 90 → 100 % (5 % na 50 ms), pa traka nestaje posle 200 ms
//
// Element je u <body>, pa ga Turbo zamenjuje zajedno sa stranicom: STARA instanca vodi punjenje dok zahtev traje,
// NOVA se poveže već „complete" pa krene od 100 % i na turbo:load samo završi i sakrije traku. Slušači na document-u se
// skidaju u disconnect-u, tajmeri takođe — stara instanca ne sme da nastavi da radi nad izbačenim elementom.
export default class LoaderController extends Controller<HTMLElement> {
    private width = 0;
    private fillTimer: number | undefined;
    private finishTimer: number | undefined;
    private hideTimer: number | undefined;

    private readonly onVisit = (): void => this.start();
    private readonly onLoad = (): void => this.finish();

    connect(): void {
        document.addEventListener('turbo:visit', this.onVisit);
        document.addEventListener('turbo:load', this.onLoad);

        if (document.readyState === 'complete') {
            this.width = 100;
            this.render();
        }
    }

    disconnect(): void {
        document.removeEventListener('turbo:visit', this.onVisit);
        document.removeEventListener('turbo:load', this.onLoad);
        this.clearTimers();
    }

    start(): void {
        this.clearTimers();
        this.width = 0;
        this.render();
        this.element.style.display = 'block';

        this.fillTimer = window.setInterval(() => {
            if (this.width >= 90) return;
            this.width = Math.min(90, this.width + Math.random() * 3 + 1);
            this.render();
        }, 200);
    }

    finish(): void {
        this.clearTimers();

        this.finishTimer = window.setInterval(() => {
            if (this.width < 100) {
                this.width = Math.min(100, this.width + 5);
                this.render();
                return;
            }
            window.clearInterval(this.finishTimer);
            this.finishTimer = undefined;
            this.hideTimer = window.setTimeout(() => {
                this.element.style.display = 'none';
                this.width = 0;
                this.render();
            }, 200);
        }, 50);
    }

    private render(): void {
        this.element.style.width = `${this.width}%`;
    }

    private clearTimers(): void {
        window.clearInterval(this.fillTimer);
        window.clearInterval(this.finishTimer);
        window.clearTimeout(this.hideTimer);
        this.fillTimer = this.finishTimer = this.hideTimer = undefined;
    }
}
