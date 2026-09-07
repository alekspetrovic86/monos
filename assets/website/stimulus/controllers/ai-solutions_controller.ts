import { Controller } from '@hotwired/stimulus';

export default class AiSolutionsController extends Controller {
    private _colObserver!: IntersectionObserver;
    private _featObserver!: IntersectionObserver;

    connect(): void {
        const aiLeft = this.element.querySelector<HTMLElement>('.ai-left');
        const aiRight = this.element.querySelector<HTMLElement>('.ai-right');
        const aiFeatures = Array.from(this.element.querySelectorAll<HTMLElement>('.ai-feature'));

        this._colObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('in-view');
                    this._colObserver.unobserve(e.target);
                });
            },
            { rootMargin: '0px' }
        );

        if (aiLeft)  this._colObserver.observe(aiLeft);
        if (aiRight) this._colObserver.observe(aiRight);

        this._featObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    const delay = Number((e.target as HTMLElement).dataset.featureDelay) || 0;
                    setTimeout(() => e.target.classList.add('in-view'), delay);
                    this._featObserver.unobserve(e.target);
                });
            },
            { rootMargin: '0px' }
        );

        aiFeatures.forEach(f => this._featObserver.observe(f));
    }

    disconnect(): void {
        this._colObserver?.disconnect();
        this._featObserver?.disconnect();
    }
}
