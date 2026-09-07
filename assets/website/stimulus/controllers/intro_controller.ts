import { Controller } from '@hotwired/stimulus';

export default class IntroController extends Controller {
    private _observer!: IntersectionObserver;

    connect(): void {
        const left  = this.element.querySelector<HTMLElement>('.intro-left');
        const right = this.element.querySelector<HTMLElement>('.intro-right');

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

        if (left)  this._observer.observe(left);
        if (right) this._observer.observe(right);
    }

    disconnect(): void {
        this._observer?.disconnect();
    }
}
