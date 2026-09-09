import { Controller } from '@hotwired/stimulus';
import GLightbox from 'glightbox';
import Panzoom, { PanzoomObject } from '@panzoom/panzoom';

// GLightbox-ov `index.d.ts` tipizira `on` kao `(eventName, callback: () => void)`, iako isti fajl definiše
// `Payload<T>` mapu i biblioteka stvarno prosleđuje podatke handleru. Ta mapa nije eksportovana (`export = GLightbox`
// izvozi samo funkciju), pa se ovde opisuje jedino ono što koristimo, i to na jednom mestu.
//
// `on` se MORA pozvati na instanci: unutra čita `this.apiEvents`. Otkačena u promenljivu baca
// „Cannot read properties of undefined". Zato se ispravlja tip povratnog poziva, a ne tip metode.
type Lightbox = ReturnType<typeof GLightbox>;
type SlideLoaded = { slideNode?: Element };

const onSlideLoaded = (lightbox: Lightbox, callback: (data: SlideLoaded) => void): void => {
    lightbox.on('slide_after_load', callback as () => void);
};

// data-controller="image-zoom" — „Expand view" (F12 17:80 / F13 17:93): slika preko celog ekrana sa dubinskim zoom-om.
//
// Samostalan: radi nad bilo kojom slikom čiji URL prima kroz data-image-zoom-src-value (w2400 — tek se ovde
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
// Kursor prati stanje kroz `data-cursor` na slici, a crta ga CSS (main.scss): „+" dok je slika u osnovnoj
// veličini (klik ili točkić uvećava), `grab` kad je uvećana (može da se pomera), `grabbing` dok se vuče.
// Stanje vode panzoomchange (scale) i panzoomstart/panzoomend.
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
    // Posle točkića napred-nazad Panzoom vrati 1.0000000000000002, ne 1 — „osnovna veličina" je zato sa tolerancijom.
    private static readonly ZOOMED_ABOVE = 1.001;

    private readonly desktop = window.matchMedia('(min-width: 1024px)');
    private readonly onResize = (): void => this.fit();
    private readonly onChange = (event: Event): void => this.setCursor((event as CustomEvent<{ scale: number }>).detail.scale);
    private readonly onStart = (): void => {
        if (this.zoomed(this.scale())) this.cursor('grabbing');
    };
    private readonly onEnd = (): void => this.setCursor(this.scale());
    // Klik u osnovnoj veličini uvećava na 2x oko tačke klika — ono što kursor `zoom-in` obećava. Uvećana slika se
    // klikom ne menja (klik je tada kraj prevlačenja).
    private readonly onClick = (event: MouseEvent): void => {
        if (this.panzoom && !this.zoomed(this.scale())) this.panzoom.zoomToPoint(2, event);
    };

    private lightbox: Lightbox | null = null;
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

    private build(): Lightbox {
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
        onSlideLoaded(lightbox, (data) => {
            this.attach(data.slideNode?.querySelector('img') ?? null);
        });
        lightbox.on('close', () => {
            this.detach();
            // Fokus se vraća na okidač („Expand view"), kao što menu_controller vraća na logo — GLightbox ga ostavlja na <body>.
            this.element.focus();
        });

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
            // Prazno: Panzoom bi inace upisao kursor u inline stil i nadglasao CSS. Stanje nosi `data-cursor`.
            cursor: '',
        });

        const wrapper = image.parentElement;
        wrapper?.addEventListener('wheel', this.panzoom.zoomWithWheel, { passive: false });
        image.addEventListener('panzoomchange', this.onChange);
        image.addEventListener('panzoomstart', this.onStart);
        image.addEventListener('panzoomend', this.onEnd);
        image.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);
    }

    private detach(): void {
        window.removeEventListener('resize', this.onResize);
        if (this.panzoom && this.image) {
            this.image.parentElement?.removeEventListener('wheel', this.panzoom.zoomWithWheel);
            this.image.removeEventListener('panzoomchange', this.onChange);
            this.image.removeEventListener('panzoomstart', this.onStart);
            this.image.removeEventListener('panzoomend', this.onEnd);
            this.image.removeEventListener('click', this.onClick);
            this.panzoom.destroy();
        }
        this.panzoom = null;
        this.image = null;
    }

    private scale(): number {
        return this.panzoom?.getScale() ?? 1;
    }

    private zoomed(scale: number): boolean {
        return scale > ImageZoomController.ZOOMED_ABOVE;
    }

    private setCursor(scale: number): void {
        this.cursor(this.zoomed(scale) ? 'grab' : 'zoom-in');
    }

    private cursor(value: 'zoom-in' | 'grab' | 'grabbing'): void {
        if (this.image) this.image.dataset.cursor = value;
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
