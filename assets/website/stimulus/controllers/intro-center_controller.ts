import { Controller } from '@hotwired/stimulus';

export default class IntroCenterController extends Controller {
    private _observer!: IntersectionObserver;

    connect(): void {
        const content = this.element.querySelector<HTMLElement>('.intro-center-content');

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

        if (content) this._observer.observe(content);
    }

    disconnect(): void {
        this._observer?.disconnect();
    }
}
