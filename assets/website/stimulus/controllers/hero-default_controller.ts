import { Controller } from '@hotwired/stimulus';

export default class HeroDefaultController extends Controller {
    private _observer!: IntersectionObserver;

    connect(): void {
        this._observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    (this.element as HTMLElement).dataset.playing = String(e.isIntersecting);
                });
            },
            { rootMargin: '100px' }
        );

        this._observer.observe(this.element);
        this._alignGradientSup();
    }

    private _alignGradientSup(): void {
        const titleEl = this.element.querySelector<HTMLElement>('.hero-default-dark-title');
        if (!titleEl) return;
        const supEl = titleEl.querySelector<HTMLElement>('sup');
        if (!supEl) return;

        const titleRect = titleEl.getBoundingClientRect();
        const supRect   = supEl.getBoundingClientRect();
        const offsetX   = supRect.left - titleRect.left;

        supEl.style.backgroundSize      = `${titleRect.width}px 100%`;
        supEl.style.backgroundPositionX = `-${offsetX}px`;
    }

    disconnect(): void {
        this._observer?.disconnect();
    }
}
