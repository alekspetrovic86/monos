import { Controller } from '@hotwired/stimulus';

export default class OurServicesController extends Controller {
    private _headingObserver!: IntersectionObserver;
    private _cardObserver!: IntersectionObserver;

    connect(): void {
        const headingEl = this.element.querySelector<HTMLElement>('.services-heading');
        const cards = Array.from(this.element.querySelectorAll<HTMLElement>('.service-card'));

        if (headingEl) {
            this._headingObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(e => {
                        if (e.isIntersecting) {
                            e.target.classList.add('in-view');
                            this._headingObserver.unobserve(e.target);
                        }
                    });
                },
                { rootMargin: '-50px' }
            );
            this._headingObserver.observe(headingEl);
        }

        this._cardObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        const idx = Number((e.target as HTMLElement).dataset.cardIndex);
                        setTimeout(() => e.target.classList.add('in-view'), idx * 100);
                        this._cardObserver.unobserve(e.target);
                    }
                });
            },
            { rootMargin: '-50px' }
        );

        cards.forEach((card, i) => {
            card.dataset.cardIndex = String(i);
            this._cardObserver.observe(card);
        });
    }

    disconnect(): void {
        this._headingObserver?.disconnect();
        this._cardObserver?.disconnect();
    }
}
