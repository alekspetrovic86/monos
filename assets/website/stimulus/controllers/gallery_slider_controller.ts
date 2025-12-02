import { Controller } from "@hotwired/stimulus";
import Swiper from "swiper";
import { Navigation } from "swiper/modules";
import GLightbox from "glightbox";
import Panzoom from "@panzoom/panzoom";

import "swiper/css";
import "swiper/css/navigation";
import "glightbox/dist/css/glightbox.css";

// data-controller="gallery-slider"
export default class extends Controller {
    static targets = ["container", "prev", "next", "open", "counter"];

    declare readonly containerTarget: HTMLElement;
    declare readonly prevTarget: HTMLElement;
    declare readonly nextTarget: HTMLElement;
    declare readonly openTarget: HTMLElement;
    declare readonly counterTarget: HTMLElement;
    declare readonly hasCounterTarget: boolean;

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
            on: {
                slideChange: () => {
                    this.updateCounter();
                }
            }
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

        this.lightbox.on("slide_after_load", () => {
            this.addCustomCloseButton();
            this.disableLightboxNav();
            this.enableDeepZoom();
        });

        this.lightbox.open();
    }

    private disableLightboxNav() {
        document.querySelectorAll(".gprev, .gnext").forEach((btn) => {
            const el = btn as HTMLElement;
            el.style.display = "none";
            el.style.pointerEvents = "none";
            el.style.opacity = "0";
        });
    }

    private enableDeepZoom() {
        const img = document.querySelector(".gslide-image img") as HTMLElement;
        if (!img) return;

        // image container must allow overflow
        const wrapper = img.parentElement as HTMLElement;
        wrapper.style.overflow = "hidden";

        // initialize Panzoom on the IMAGE
        const panzoom = Panzoom(img, {
            maxScale: 6,         // deep zoom
            minScale: 1,
            contain: "outside",
        });

        wrapper.addEventListener("wheel", panzoom.zoomWithWheel, { passive: false });
    }

    private addCustomCloseButton() {
        if (document.querySelector(".custom-glightbox-close")) return;

        const btn = document.createElement("button");
        btn.className = "custom-glightbox-close";
        btn.innerHTML = "&times;";

        btn.addEventListener("click", () => {
            this.lightbox?.close();
        });

        const container = document.querySelector(".gcontainer") as HTMLElement;
        if (container) container.appendChild(btn);
    }

    updateCounter() {
        if (!this.swiper || !this.hasCounterTarget) return;

        const current = this.swiper.activeIndex + 1;
        const total = this.containerTarget.querySelectorAll('.swiper-slide').length;

        this.counterTarget.textContent = `${current}/${total}`;
    }
}
