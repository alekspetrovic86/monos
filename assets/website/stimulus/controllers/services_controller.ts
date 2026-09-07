import { Controller } from '@hotwired/stimulus';
import Swiper from 'swiper';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';

export default class ServicesController extends Controller {
    private _swiper!: Swiper;
    private _cardObserver!: IntersectionObserver;
    private _onResize!: () => void;

    // Returns the right-side offset so the last slide stops at the container edge.
    // Mirrors the CSS: max(padding, (100vw - 1280px) / 2 + padding)
    private _containerOffset(): number {
        const vw      = window.innerWidth;
        const maxW    = 1280; // 80rem
        const padding = vw >= 1024 ? 32 : 24; // lg:px-8 = 2rem, px-6 = 1.5rem
        return Math.max(padding, (vw - maxW) / 2 + padding);
    }

    private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

    private _equalizeHeights(): void {
        // Only needed on desktop where slidesPerView is 'auto'
        if (window.innerWidth < 1024) return;
        const cards = Array.from(this.element.querySelectorAll<HTMLElement>('.services-card'));
        cards.forEach(c => c.style.height = '');
        const maxH = Math.max(...cards.map(c => c.offsetHeight));
        if (maxH > 0) cards.forEach(c => c.style.height = `${maxH}px`);
    }

    connect(): void {
        const swiperEl   = this.element.querySelector<HTMLElement>('.services-swiper');
        const pagination = this.element.querySelector<HTMLElement>('.services-pagination');

        if (swiperEl) {
            this._swiper = new Swiper(swiperEl, {
                modules: [Navigation, Pagination],
                slidesPerView: 1.1,
                spaceBetween: 16,
                loop: false,
                centeredSlides: true,
                centeredSlidesBounds: true,
                slidesOffsetAfter: this._containerOffset(),
                navigation: {
                    prevEl: '.services-prev',
                    nextEl: '.services-next',
                },
                pagination: pagination ? {
                    el: pagination,
                    type: 'progressbar',
                } : false,
                breakpoints: {
                    640:  { slidesPerView: 2.2,   spaceBetween: 20, centeredSlides: false, centeredSlidesBounds: false },
                    1024: { slidesPerView: 'auto', spaceBetween: 24, centeredSlides: false, centeredSlidesBounds: false },
                },
            });

            this._equalizeHeights();

            // Re-run after fonts load: Google Fonts swap causes a reflow on first load
            // (Safari only) which leaves Swiper with stale slide dimensions.
            void document.fonts.ready.then(() => {
                if (!this._swiper) return;
                this._swiper.update();
                this._equalizeHeights();
            });

            // Debounced resize: offset recalculates immediately, height equalization waits
            this._onResize = () => {
                if (!this._swiper) return;
                this._swiper.params.slidesOffsetAfter = this._containerOffset();
                this._swiper.update();
                if (this._resizeTimer) clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(() => this._equalizeHeights(), 150);
            };
            window.addEventListener('resize', this._onResize, { passive: true });
        }

        // Each card observed individually — fires only when card itself enters viewport
        this._cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const el = e.target as HTMLElement;
                this._cardObserver.unobserve(el);
                requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in-view')));
            });
        }, { rootMargin: '-20px' });

        this.element.querySelectorAll<HTMLElement>('.services-card').forEach(card => {
            this._cardObserver.observe(card);
        });
    }

    disconnect(): void {
        this._swiper?.destroy(true, true);
        this._cardObserver?.disconnect();
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        if (this._resizeTimer) clearTimeout(this._resizeTimer);
    }
}
