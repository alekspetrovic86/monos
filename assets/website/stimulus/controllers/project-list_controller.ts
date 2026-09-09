import { Controller } from '@hotwired/stimulus';

// data-controller="project-list" — lista projekata na naslovnoj (F1 → klik → F2).
// Stavka (<article>) ima dva stanja; `data-expanded` na stavci je jedini prekidač, CSS iz njega
// izvodi širine (480→540 / 292→375). Najviše jedna stavka je raširena.
//
// Klik na sliku (trigger = <a href=projekat>):
//   1. obična stavka  → preseče link, raširi je i podigne na vrh tako da se vidi 22px (mobile 46px)
//                       prethodnog projekta + 2px razmaka = slika na T24 / T48.
//   2. raširena stavka → link prolazi, ulazi se u projekat (isto što i „Enter").
//
// Animacija je FLIP: novo stanje se primeni odmah (layout je odmah konačan, pa se cilj skrola meri tačno),
// a zatim se širina okvira slike animira od stare do nove vrednosti (Web Animations), detalji se pojave
// prelivom, a skrol se vodi kroz rAF ka CILJU KOJI SE MERI SVAKOG KADRA — stavka iznad koja se skuplja
// pomera cilj, i ovako se sleće tačno bez obzira na to. Bez poskakivanja, bez efekata.
//
// Bez JS-a: detalji su vidljivi (CSS ih krije samo na html.js:not(.project-list-ready)), slika je običan link.
export default class ProjectListController extends Controller<HTMLElement> {
    static targets = ['item', 'trigger', 'detail'];

    declare readonly itemTargets: HTMLElement[];

    private readonly desktop = window.matchMedia('(min-width: 1024px)');
    private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    private static readonly DURATION = 600;
    private static readonly EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';

    private scrollFrame = 0;

    connect(): void {
        // Stanje može stići iz Turbo snapshota (povratak sa projekta) — samo se uskladi, ne resetuje.
        this.itemTargets.forEach((item) => this.sync(item));
        document.documentElement.classList.add('project-list-ready');
    }

    disconnect(): void {
        cancelAnimationFrame(this.scrollFrame);
        document.documentElement.classList.remove('project-list-ready');
    }

    // Povratak na listu (scroll-memory:restore — Back sa projekta, Information, CLOSE): stavka se raširi odmah,
    // bez animacije i bez skrola — skrol vraća scroll-memory. Animacija podizanja liste pri učitavanju se preskače
    // (CSS `project-list--restored`) i kad ništa nije bilo rašireno (item = null) — lista se zatiče, ne stiže.
    restore(event: CustomEvent<{ item: HTMLElement | null }>): void {
        this.element.classList.add('project-list--restored');

        const item = event.detail?.item ?? null;
        if (!item || !this.itemTargets.includes(item)) return;

        this.itemTargets.forEach((candidate) => {
            candidate.toggleAttribute('data-expanded', candidate === item);
            this.sync(candidate);
        });
        this.reserveTail(item);
    }

    activate(event: Event): void {
        const item = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-project-list-target~="item"]');
        if (!item) return;
        // Drugi klik na raširenu sliku: link vodi na projekat.
        if (item.hasAttribute('data-expanded')) return;

        event.preventDefault();
        this.expand(item);
    }

    private expand(item: HTMLElement): void {
        const previous = this.itemTargets.find((candidate) => candidate.hasAttribute('data-expanded')) ?? null;
        const changed = previous && previous !== item ? [previous, item] : [item];

        // FLIP „first": širine okvira pre promene.
        const widthBefore = new Map(changed.map((entry) => [entry, this.frame(entry).getBoundingClientRect().width]));

        if (previous && previous !== item) {
            previous.removeAttribute('data-expanded');
            this.sync(previous);
        }
        item.setAttribute('data-expanded', '');
        this.sync(item);
        this.reserveTail(item);

        const duration = this.reducedMotion.matches ? 0 : ProjectListController.DURATION;

        if (duration) {
            // FLIP „last/invert/play": okvir slike od stare do nove širine (visina prati format slike).
            changed.forEach((entry) => {
                const frame = this.frame(entry);
                const from = widthBefore.get(entry) ?? 0;
                const to = frame.getBoundingClientRect().width;
                if (Math.abs(from - to) < 0.5) return;
                frame.animate([{ width: `${from}px` }, { width: `${to}px` }], {
                    duration,
                    easing: ProjectListController.EASING,
                });
            });
            this.detail(item).animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });
        }

        this.scrollTo(item, duration);
    }

    private sync(item: HTMLElement): void {
        const expanded = item.hasAttribute('data-expanded');
        this.detail(item).hidden = !expanded;
        this.frame(item).setAttribute('aria-expanded', String(expanded));

        // Responzivna slika: `sizes` prati stanje (480/292 obična → 540/375 istaknuta), pa browser po potrebi
        // doučita veći kandidat iz srcset-a. Vrednosti nosi stavka (data-sizes / data-sizes-expanded).
        const sizes = expanded ? item.dataset.sizesExpanded : item.dataset.sizes;
        if (sizes) item.querySelectorAll('[sizes]').forEach((source) => source.setAttribute('sizes', sizes));
    }

    private frame(item: HTMLElement): HTMLElement {
        return item.querySelector<HTMLElement>('[data-project-list-target~="trigger"]') ?? item;
    }

    private detail(item: HTMLElement): HTMLElement {
        return item.querySelector<HTMLElement>('[data-project-list-target~="detail"]') ?? item;
    }

    // Koliko se prethodnog projekta vidi iznad + 2px razmaka → slika na T24 (desktop) / T48 (mobile).
    private peek(): number {
        return this.desktop.matches ? 24 : 48;
    }

    // Položaj u dokumentu nezavisan od transformacija (animacija podizanja pri učitavanju).
    private documentTop(element: HTMLElement): number {
        let top = 0;
        for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null) {
            top += node.offsetTop;
        }
        return top;
    }

    // Poslednje stavke ne bi mogle da stignu do vrha — lista dobije donji padding tačno koliko fali.
    private reserveTail(item: HTMLElement): void {
        this.element.style.paddingBottom = '';
        const target = this.documentTop(item) - this.peek();
        const deficit = target + window.innerHeight - document.documentElement.scrollHeight;
        if (deficit > 0) this.element.style.paddingBottom = `${Math.ceil(deficit)}px`;
    }

    private scrollTo(item: HTMLElement, duration: number): void {
        cancelAnimationFrame(this.scrollFrame);

        const target = (): number => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            return Math.max(0, Math.min(this.documentTop(item) - this.peek(), max));
        };

        if (!duration) {
            window.scrollTo(0, target());
            return;
        }

        const start = window.scrollY;
        const startedAt = performance.now();
        const ease = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

        const step = (now: number): void => {
            const progress = Math.min(1, (now - startedAt) / duration);
            window.scrollTo(0, start + (target() - start) * ease(progress));
            if (progress < 1) this.scrollFrame = requestAnimationFrame(step);
        };
        this.scrollFrame = requestAnimationFrame(step);
    }
}
