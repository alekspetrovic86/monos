import { Controller } from '@hotwired/stimulus';

export default class JobsController extends Controller {
    private _observer!: IntersectionObserver;

    connect(): void {
        this._observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    (e.target as HTMLElement).classList.add('jobs-visible');
                    this._observer.unobserve(e.target);
                });
            },
            { threshold: 0.12 }
        );

        requestAnimationFrame(() => {
            this.element
                .querySelectorAll<HTMLElement>('.jobs-fade-up')
                .forEach(el => this._observer.observe(el));
        });
    }

    disconnect(): void {
        this._observer?.disconnect();
    }
}
