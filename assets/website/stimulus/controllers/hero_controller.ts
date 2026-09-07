import { Controller } from '@hotwired/stimulus';

export default class HeroController extends Controller {
    static values = { mode: { type: String, default: 'light' } };
    declare modeValue: string;

    private _observer!: IntersectionObserver;
    private _animated!: HTMLElement[];

    connect(): void {
        this._animated = Array.from(
            this.element.querySelectorAll<HTMLElement>(
                '#hero-ribbon1, #hero-ribbon2, #hero-wave3, #hero-wave4, #hero-wave5, ' +
                '#hero-dark-base, #hero-dark-blob1, #hero-dark-blob2, #hero-dark-blob3, #hero-dark-blob4, #hero-dark-blob5'
            )
        );

        this._observer = new IntersectionObserver(
            ([entry]) => {
                const state = entry.isIntersecting ? 'running' : 'paused';
                this._animated.forEach(el => {
                    el.style.animationPlayState = state;
                });
            },
            { rootMargin: '12% 0px 12% 0px', threshold: 0.05 }
        );

        // Double rAF: Safari fires the initial IO callback before layout is fully computed,
        // reporting isIntersecting: false for elements that ARE in the viewport.
        // This causes animations to be permanently paused on first load.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            this._observer.observe(this.element);
        }));
    }

    disconnect(): void {
        this._observer.disconnect();
    }

}
