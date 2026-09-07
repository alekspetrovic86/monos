import { Controller } from '@hotwired/stimulus';

export default class SolutionsController extends Controller {
    private _topObserver!: IntersectionObserver;
    private _bottomObserver!: IntersectionObserver;
    private _featObserver!: IntersectionObserver;
    private _shimmerTimer: ReturnType<typeof setTimeout> | null = null;
    private _drawDone = false;

    connect(): void {
        const solutionsTop    = this.element.querySelector<HTMLElement>('.solutions-top');
        const solutionsBottom = this.element.querySelector<HTMLElement>('.solutions-bottom');
        const brainSvg        = this.element.querySelector<SVGElement>('.brain-svg');
        const features        = Array.from(this.element.querySelectorAll<HTMLElement>('.solutions-feature'));

        // ── Top fade-in (one-shot) ──────────────────────────────────────
        if (solutionsTop) {
            this._topObserver = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('in-view');
                    this._topObserver.unobserve(e.target);
                });
            }, { rootMargin: '0px' });
            this._topObserver.observe(solutionsTop);
        }

        // ── Bottom: draw (one-shot) + shimmer play/pause (continuous) ───
        if (solutionsBottom) {
            this._bottomObserver = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    const el = e.target as HTMLElement;

                    if (e.isIntersecting) {
                        if (!this._drawDone) {
                            // First intersection — trigger draw animation
                            el.classList.add('in-view');
                            this._drawDone = true;

                            // Start shimmer after draw completes (only if brain SVG is present)
                            if (brainSvg) {
                                this._shimmerTimer = setTimeout(() => {
                                    el.classList.add('shimmer-playing');
                                }, 1800);
                            }
                        } else if (brainSvg) {
                            // Returning into view — resume shimmer immediately
                            el.classList.add('shimmer-playing');
                        }
                    } else if (brainSvg) {
                        // Out of view — pause shimmer, cancel pending start if any
                        if (this._shimmerTimer !== null) {
                            clearTimeout(this._shimmerTimer);
                            this._shimmerTimer = null;
                        }
                        el.classList.remove('shimmer-playing');
                    }
                });
            }, { rootMargin: '0px' });
            this._bottomObserver.observe(solutionsBottom);
        }

        // ── Feature bullets stagger (one-shot) ─────────────────────────
        this._featObserver = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const delay = Number((e.target as HTMLElement).dataset.featureDelay) || 0;
                setTimeout(() => e.target.classList.add('in-view'), delay);
                this._featObserver.unobserve(e.target);
            });
        }, { rootMargin: '0px' });
        features.forEach(f => this._featObserver.observe(f));
    }

    disconnect(): void {
        this._topObserver?.disconnect();
        this._bottomObserver?.disconnect();
        this._featObserver?.disconnect();
        if (this._shimmerTimer !== null) clearTimeout(this._shimmerTimer);
    }
}
