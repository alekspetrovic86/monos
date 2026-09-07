import { Controller } from '@hotwired/stimulus';

export default class IntroTextRightController extends Controller {
    private _observer!: IntersectionObserver;

    connect(): void {
        const top    = this.element.querySelector<HTMLElement>('.intro-text-right-top');
        const bottom = this.element.querySelector<HTMLElement>('.intro-text-right-bottom');

        this._observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('in-view');
                    this._observer.unobserve(e.target);
                });
            },
            { rootMargin: '0px' }
        );

        if (top)    this._observer.observe(top);
        if (bottom) this._observer.observe(bottom);
    }

    disconnect(): void {
        this._observer?.disconnect();
    }
}
