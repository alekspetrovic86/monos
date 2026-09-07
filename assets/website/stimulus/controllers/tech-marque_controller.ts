import { Controller } from '@hotwired/stimulus';

export default class TechMarqueController extends Controller {
    private _observer!: IntersectionObserver;
    private _track!: HTMLElement | null;

    connect(): void {
        this._track = this.element.querySelector<HTMLElement>('.tech-marque-track');

        this._observer = new IntersectionObserver(
            ([entry]) => {
                if (!this._track) return;
                this._track.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
            },
            { rootMargin: '12% 0px 12% 0px', threshold: 0.05 }
        );

        // Double rAF: prevents Safari's first-load false-negative IO callback from
        // permanently pausing the marquee animation.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            this._observer.observe(this.element);
        }));
    }

    disconnect(): void {
        this._observer.disconnect();
    }
}
