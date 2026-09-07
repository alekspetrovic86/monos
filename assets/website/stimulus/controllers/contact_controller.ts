import { Controller } from '@hotwired/stimulus';
import { setupRecaptcha } from '../utils/recaptcha';

export default class ContactController extends Controller {
    private _intersectionObserver!: IntersectionObserver;
    private _cleanupRecaptcha?: () => void;

    connect(): void {
        // ── Fade-up animations ────────────────────────────────────────────────
        this._intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    (e.target as HTMLElement).classList.add('ct-visible');
                    this._intersectionObserver.unobserve(e.target);
                });
            },
            { threshold: 0.12 }
        );

        requestAnimationFrame(() => {
            this.element
                .querySelectorAll<HTMLElement>('.ct-fade-up')
                .forEach(el => this._intersectionObserver.observe(el));
        });

        // ── reCAPTCHA ─────────────────────────────────────────────────────────
        this._cleanupRecaptcha = setupRecaptcha(this.element);
    }

    disconnect(): void {
        this._intersectionObserver?.disconnect();
        this._cleanupRecaptcha?.();
    }
}
