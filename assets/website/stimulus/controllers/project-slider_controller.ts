import { Controller } from '@hotwired/stimulus';
import Swiper from 'swiper';

// data-controller="project-slider" — slajder slika na stranici projekta (F7 16:2, F21 63:274).
// Swiper, jedan slajd u kadru, kružno. Listanje: klik na LEVU polovinu slike = prethodna, na DESNU = sledeća
// (dva providna dugmeta preko slike — rade i tastaturom). Prevlačenje prstom radi kao i inače.
// Brojač (target `counter`) je 1-based indeks tekućeg slajda, desno poravnat na desnu ivicu slike.
// „Expand view" (target `expand`, opciono): href i data-image-zoom-src-value prate w2400 tekućeg slajda
// (data-full na <img>; src/srcset slajda su umanjeni formati). Sam fullscreen radi image-zoom kontroler na tom linku.
export default class ProjectSliderController extends Controller<HTMLElement> {
    static targets = ['swiper', 'counter', 'expand'];

    declare readonly swiperTarget: HTMLElement;
    declare readonly counterTarget: HTMLElement;
    declare readonly expandTarget: HTMLAnchorElement;
    declare readonly hasExpandTarget: boolean;

    private swiper: Swiper | null = null;

    connect(): void {
        const count = this.swiperTarget.querySelectorAll('.swiper-slide').length;

        this.swiper = new Swiper(this.swiperTarget, {
            slidesPerView: 1,
            spaceBetween: 0,
            speed: 400,
            loop: count > 1,
            // Klik posle prevlačenja ne sme da prelista još jednom.
            preventClicks: true,
            preventClicksPropagation: true,
            on: {
                slideChange: () => this.render(),
            },
        });

        this.render();
    }

    disconnect(): void {
        this.swiper?.destroy(true, true);
        this.swiper = null;
    }

    prev(): void {
        this.swiper?.slidePrev();
    }

    next(): void {
        this.swiper?.slideNext();
    }

    private render(): void {
        if (!this.swiper) return;

        const index = this.swiper.realIndex;
        this.counterTarget.textContent = String(index + 1);

        if (this.hasExpandTarget) {
            const image = this.swiper.slides[this.swiper.activeIndex]?.querySelector('img');
            if (image) {
                const full = image.dataset.full || image.currentSrc || image.src;
                this.expandTarget.href = full;
                if (this.expandTarget.hasAttribute('data-image-zoom-src-value')) {
                    this.expandTarget.setAttribute('data-image-zoom-src-value', full);
                }
            }
        }
    }
}
