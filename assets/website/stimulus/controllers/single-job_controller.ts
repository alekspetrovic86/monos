import { Controller } from '@hotwired/stimulus';
import { setupRecaptcha } from '../utils/recaptcha';

export default class SingleJobController extends Controller {
    private _observer!: IntersectionObserver;
    private _cleanupRecaptcha?: () => void;

    connect(): void {
        // ── Fade-up animations ────────────────────────────────────────────────
        this._observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    (e.target as HTMLElement).classList.add('sjb-visible');
                    this._observer.unobserve(e.target);
                });
            },
            { threshold: 0.08 }
        );

        requestAnimationFrame(() => {
            this.element
                .querySelectorAll<HTMLElement>('.sjb-fade-up')
                .forEach(el => this._observer.observe(el));
        });

        // ── reCAPTCHA ─────────────────────────────────────────────────────────
        this._cleanupRecaptcha = setupRecaptcha(this.element);

        // ── File input: show filename on the upload label ─────────────────────
        this.element
            .querySelectorAll<HTMLInputElement>('input[type="file"]')
            .forEach(input => {
                const wrap  = input.closest<HTMLElement>('.ct-file-wrap');
                const label = wrap?.querySelector<HTMLElement>('.ct-file-label-text');
                if (!label) return;

                const defaultText = label.textContent ?? '';
                input.addEventListener('change', () => {
                    label.textContent = input.files?.[0]?.name ?? defaultText;
                });
            });
    }

    disconnect(): void {
        this._observer?.disconnect();
        this._cleanupRecaptcha?.();
    }
}
