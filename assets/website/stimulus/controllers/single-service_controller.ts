import { Controller } from '@hotwired/stimulus';

export default class SingleServiceController extends Controller {
    static values = { animation: { type: Boolean, default: false } };
    declare animationValue: boolean;

    private _fadeObserver!: IntersectionObserver;
    private _animObserver!: IntersectionObserver;

    connect(): void {
        // Fade-in: content and visual panels (one-shot, threshold 0.15)
        this._fadeObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('art-visible');
                    this._fadeObserver.unobserve(e.target);
                });
            },
            { threshold: 0.15 }
        );

        this.element
            .querySelectorAll<HTMLElement>('.art-fade-content, .art-fade-visual')
            .forEach(el => this._fadeObserver.observe(el));

        // Ring, dev nodes & accent: only set up observer when an animation is rendered
        if (this.animationValue) {
            // Immediately pause SVG SMIL animations – they start running on parse,
            // before the IntersectionObserver has a chance to fire.
            this._smilSvgs().forEach(svg => svg.pauseAnimations());

            this._animObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(e => {
                        (this.element as HTMLElement).dataset.playing = String(e.isIntersecting);
                        this._smilSvgs().forEach(svg =>
                            e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()
                        );
                    });
                },
                { rootMargin: '100px' }
            );

            this._animObserver.observe(this.element);
        }
    }

    disconnect(): void {
        this._fadeObserver?.disconnect();
        this._animObserver?.disconnect();
    }

    private _smilSvgs(): SVGSVGElement[] {
        return Array.from(this.element.querySelectorAll<SVGSVGElement>('[data-smil]'));
    }
}
