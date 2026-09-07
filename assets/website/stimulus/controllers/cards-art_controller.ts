import { Controller } from '@hotwired/stimulus';

export default class CardsArtController extends Controller {
    private _observer!: IntersectionObserver;

    connect(): void {
        this._observer = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                (e.target as HTMLElement).classList.add('ca-visible');
                this._observer.unobserve(e.target);
            });
        }, { threshold: 0.15 });

        this.element
            .querySelectorAll<HTMLElement>('.ca-heading, .ca-item')
            .forEach(el => this._observer.observe(el));
    }

    disconnect(): void {
        this._observer?.disconnect();
    }
}
