import { Controller } from '@hotwired/stimulus';
import Swiper from 'swiper';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';

export default class TestimonialController extends Controller {
    private _swiper!: Swiper;
    private _cardObserver!: IntersectionObserver;
    private _onResize!: () => void;
    private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

    private _containerOffset(): number {
        const vw      = window.innerWidth;
        const maxW    = 1280;
        const padding = vw >= 1024 ? 32 : 24;
        return Math.max(padding, (vw - maxW) / 2 + padding);
    }

    private _equalizeHeights(): void {
        if (window.innerWidth < 1024) return;
        const cards = Array.from(this.element.querySelectorAll<HTMLElement>('.testimonial-card'));
        cards.forEach(c => c.style.height = '');
        const maxH = Math.max(...cards.map(c => c.offsetHeight));
        if (maxH > 0) cards.forEach(c => c.style.height = `${maxH}px`);
    }

    connect(): void {
        const swiperEl   = this.element.querySelector<HTMLElement>('.testimonial-swiper');
        const pagination = this.element.querySelector<HTMLElement>('.testimonial-pagination');

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
                    prevEl: '.testimonial-prev',
                    nextEl: '.testimonial-next',
                },
                pagination: pagination ? {
                    el: pagination,
                    type: 'progressbar',
                } : false,
                breakpoints: {
                    640:  { slidesPerView: 1.1,   spaceBetween: 20 },
                    1024: {
                        slidesPerView: 'auto',
                        spaceBetween: 24,
                        centeredSlides: false,
                        centeredSlidesBounds: false,
                        slidesOffsetAfter: this._containerOffset(),
                    },
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

            this._onResize = () => {
                if (!this._swiper) return;
                if (this._resizeTimer) clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(() => {
                    const offset = this._containerOffset();
                    this._swiper.params.slidesOffsetAfter = offset;
                    (this._swiper.params.breakpoints as any)[1024].slidesOffsetAfter = offset;
                    this._swiper.update();
                    this._equalizeHeights();
                }, 150);
            };
            window.addEventListener('resize', this._onResize, { passive: true });
        }

        this._cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const el = e.target as HTMLElement;
                this._cardObserver.unobserve(el);
                requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in-view')));
            });
        }, { rootMargin: '0px', threshold: 0 });

        this.element.querySelectorAll<HTMLElement>('.testimonial-card').forEach(card => {
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
