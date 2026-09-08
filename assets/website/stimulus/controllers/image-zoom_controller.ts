import { Controller } from '@hotwired/stimulus';
import GLightbox from 'glightbox';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';

// data-controller="image-zoom" — „Expand view" (F12 17:80 / F13 17:93): slika preko celog ekrana sa dubinskim zoom-om.
//
// Samostalan: radi nad bilo kojom slikom čiji URL prima kroz data-image-zoom-src-value (PUNA rezolucija — tek se ovde
// učitava; lista i slajder koriste umanjene formate) i ne zna ništa o slajderu. Element je link na istu sliku, pa bez
// JS-a, ili ispod 1024px, link prosto vodi na nju.
//
// GLightbox daje overlay, zaključavanje skrola i Escape; Panzoom daje zoom do 6x točkićem i prevlačenje
// (contain 'outside': slika nikad ne otkriva prazninu u svom okviru). Ovo je spaseno iz legacy-v1
// gallery_slider_controller.ts (enableDeepZoom / addCustomCloseButton), bez sprege sa Swiperom.
//
// Okvir (main.scss, skin „monos"): od leve margine (container-offset + 240) do desne ivice viewporta, 2px gore i dole —
// na 1440×900 to je 1200×896. Slika se uklapa u okvir (uspravna je ograničena visinom, pejzažna širinom), levom ivicom
// na L240, vertikalno centrirana. Veličinu joj zadaje `fit()` iz naturalWidth/Height, jer omotač (.gslide-media)
// mora biti TAČNO veličine slike — Panzoom contain računa prema roditelju.
// „Esc" dugme na L2 T314 kao ostali elementi tog baseline-a.
//
// DESKTOP-ONLY: ispod 1024px se ne montira — na mobilnom se koristi nativni pinch-zoom (odluka vlasnika).
export default class ImageZoomController extends Controller<HTMLElement> {
    static values = {
        src: String,
        close: { type: String, default: 'Esc' },
    };

    declare srcValue: string;
    declare closeValue: string;

    private static readonly MAX_SCALE = 6;

    private readonly desktop = window.matchMedia('(min-width: 1024px)');
    private readonly onResize = (): void => this.fit();

    private lightbox: ReturnType<typeof GLightbox> | null = null;
    private panzoom: PanzoomObject | null = null;
    private image: HTMLImageElement | null = null;

    disconnect(): void {
        this.detach();
        this.lightbox?.destroy();
        this.lightbox = null;
    }

    open(event: Event): void {
        if (!this.desktop.matches || !this.srcValue) return;

        event.preventDefault();

        this.lightbox ??= this.build();
        this.lightbox.setElements([{ href: this.srcValue, type: 'image', zoomable: false, draggable: false }]);
        this.lightbox.open();
    }

    close(): void {
        this.lightbox?.close();
    }

    private build(): ReturnType<typeof GLightbox> {
        const lightbox = GLightbox({
            elements: [],
            skin: 'monos',
            openEffect: 'fade',
            closeEffect: 'fade',
            slideEffect: 'none',
            closeButton: false,
            touchNavigation: false,
            keyboardNavigation: true,
            closeOnOutsideClick: false,
            preload: false,
            loop: false,
            zoomable: false,
            draggable: false,
        });

        lightbox.on('open', () => this.addClose());
        lightbox.on('slide_after_load', (data: { slideNode: HTMLElement }) => {
            this.attach(data.slideNode.querySelector('img'));
        });
        lightbox.on('close', () => this.detach());

        return lightbox;
    }

    // „Esc": jedino dugme u overlay-u. GLightbox drži Tab unutar overlay-a samo preko `.gbtn[data-taborder]` i
    // prati fokus klasom `focused` — bez nje bi Tab pobegao iz overlay-a, zato klasa prati focus/blur.
    private addClose(): void {
        const container = document.querySelector<HTMLElement>('.glightbox-monos .gcontainer');
        if (!container || container.querySelector('.image-zoom__close')) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'image-zoom__close gbtn';
        button.dataset.taborder = '1';
        button.textContent = this.closeValue;
        button.addEventListener('click', () => this.close());
        button.addEventListener('focus', () => button.classList.add('focused'));
        button.addEventListener('blur', () => button.classList.remove('focused'));
        container.appendChild(button);
        button.focus();
    }

    private attach(image: HTMLImageElement | null): void {
        if (!image) return;

        this.detach();
        this.image = image;
        this.fit();

        this.panzoom = Panzoom(image, {
            maxScale: ImageZoomController.MAX_SCALE,
            minScale: 1,
            contain: 'outside',
            cursor: 'grab',
        });

        const wrapper = image.parentElement;
        wrapper?.addEventListener('wheel', this.panzoom.zoomWithWheel, { passive: false });
        window.addEventListener('resize', this.onResize);
    }

    private detach(): void {
        window.removeEventListener('resize', this.onResize);
        if (this.panzoom && this.image) {
            this.image.parentElement?.removeEventListener('wheel', this.panzoom.zoomWithWheel);
            this.panzoom.destroy();
        }
        this.panzoom = null;
        this.image = null;
    }

    // Uklapanje u okvir: skala = min(okvir/slika po širini, po visini) — bez gornje granice, slika uvek ispuni
    // jednu dimenziju okvira (Figma: 717×896 uspravna, 1200×816 pejzažna). Posle promene okvira zoom se vraća na 1.
    private fit(): void {
        const image = this.image;
        const box = image?.closest<HTMLElement>('.ginner-container');
        if (!image || !box || !image.naturalWidth || !image.naturalHeight) return;

        const { width, height } = box.getBoundingClientRect();
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);

        image.style.width = `${Math.round(image.naturalWidth * scale)}px`;
        image.style.height = `${Math.round(image.naturalHeight * scale)}px`;

        this.panzoom?.reset({ animate: false });
    }
}
