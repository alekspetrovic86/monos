import { Controller } from '@hotwired/stimulus';

export default class OurProcessController extends Controller {
    private _headingObserver!: IntersectionObserver;
    private _cardObserver!: IntersectionObserver;
    private _timers: ReturnType<typeof setTimeout>[] = [];

    connect(): void {
        const heading = this.element.querySelector<HTMLElement>('.process-heading');
        const cards   = Array.from(this.element.querySelectorAll<HTMLElement>('.process-card'));

        if (heading) {
            this._headingObserver = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('in-view');
                    this._headingObserver.unobserve(e.target);
                });
            }, { rootMargin: '0px' });
            this._headingObserver.observe(heading);
        }

        this._cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const idx   = Number((e.target as HTMLElement).dataset.processIndex) || 0;
                const t1 = setTimeout(() => {
                    e.target.classList.add('in-view');
                    const arrow = e.target.querySelector<HTMLElement>('.process-arrow');
                    if (arrow) {
                        const t2 = setTimeout(() => arrow.classList.add('in-view'), 400);
                        this._timers.push(t2);
                    }
                }, idx * 150);
                this._timers.push(t1);
                this._cardObserver.unobserve(e.target);
            });
        }, { rootMargin: '50px' });

        cards.forEach(c => this._cardObserver.observe(c));
    }

    disconnect(): void {
        this._headingObserver?.disconnect();
        this._cardObserver?.disconnect();
        this._timers.forEach(clearTimeout);
        this._timers = [];
    }
}
