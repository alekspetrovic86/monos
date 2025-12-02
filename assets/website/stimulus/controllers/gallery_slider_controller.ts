import { Controller } from "@hotwired/stimulus";
import Swiper from "swiper";
import { Navigation } from "swiper/modules";
import GLightbox from "glightbox";

import "swiper/css";
import "swiper/css/navigation";
import "glightbox/dist/css/glightbox.css";

// data-controller="gallery-slider"
export default class extends Controller {
    static targets = ["container", "prev", "next", "open"];

    declare readonly containerTarget: HTMLElement;
    declare readonly prevTarget: HTMLElement;
    declare readonly nextTarget: HTMLElement;
    declare readonly openTarget: HTMLElement;

    swiper: Swiper | null = null;
    lightbox: ReturnType<typeof GLightbox> | null = null;

    declare readonly hasOpenTarget: boolean;

    private openHandler = (event: Event) => this.openCurrentSlide(event);

    connect() {
        this.initSwiper();
        this.initLightbox();

        if (this.hasOpenTarget) {
            this.openTarget.addEventListener("click", this.openHandler);
        }
    }

    disconnect() {
        if (this.swiper) {
            this.swiper.destroy(true, true);
            this.swiper = null;
        }

        if (this.lightbox) {
            this.lightbox.destroy();
            this.lightbox = null;
        }

        if (this.hasOpenTarget) {
            this.openTarget.removeEventListener("click", this.openHandler);
        }
    }

    initSwiper() {
        this.swiper = new Swiper(this.containerTarget, {
            modules: [Navigation],

            // one image per slide
            slidesPerView: 1,
            speed: 500,
            loop: false,
            spaceBetween: 30,

            // enable swiping
            grabCursor: true,

            navigation: {
                prevEl: this.prevTarget,
                nextEl: this.nextTarget,
            },

            // Make sure wrapper layout stays correct
            observer: true,
            observeParents: true,
        });
    }

    initLightbox() {
        this.lightbox = GLightbox({
            selector: ".glightbox-item",
            touchNavigation: false,
            loop: true,
            preload: true,
            closeOnOutsideClick: false,
            zoomable: true,
        });
    }

    openCurrentSlide(event: Event) {
        event.preventDefault();
        if (!this.swiper || !this.lightbox) return;

        const currentIndex = this.swiper.activeIndex;

        // Active image from your slider
        const img = this.containerTarget.querySelectorAll(".glightbox-item")[currentIndex] as HTMLImageElement;

        // Build a SINGLE-SLIDE GALLERY
        this.lightbox.setElements([
            {
                href: img.src,
                type: "image",
                zoomable: true,
                draggable: false,
                touchNavigation: false,
                description: "",
            }
        ]);

        document.querySelectorAll(".gprev, .gnext").forEach((btn) => {
            const el = btn as HTMLElement;
            el.style.display = "none";
            el.style.pointerEvents = "none";
            el.style.opacity = "0";
        });

        this.lightbox.open();
    }
}
