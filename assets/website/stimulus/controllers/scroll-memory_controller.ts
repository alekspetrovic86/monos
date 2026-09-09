import { Controller } from '@hotwired/stimulus';

// data-controller="scroll-memory" — „Back" sa projekta vraća listu tačno kako je ostavljena:
// ista raširena stavka, isti skrol (raširena stavka se podiže na vrh, pa sam scrollY nije dovoljan).
//
// Dva mesta, jedan kontroler:
//   lista      (naslovna, uz project-list): `store` na klik linka beleži scrollY + id raširene stavke
//              pod ključem putanje liste; connect() vraća oba — ali SAMO kad se stiglo kroz „Back"
//              (marker), pa Reset/logo i dalje otvaraju listu od vrha.
//   Back link  (stranica projekta): `back` postavlja marker = putanja liste na koju link vodi.
//
// Raširenu stavku vraća project-list na događaj `scroll-memory:restore` (detail.item) — bez animacije.
// Skrol se vraća uz privremeno gašenje glatkog skrola (tehnika iz legacy-v1) da povratak ne bude animiran.
export default class ScrollMemoryController extends Controller<HTMLElement> {
    private static readonly RETURN_KEY = 'scroll-memory:return';

    connect(): void {
        const key = location.pathname;
        if (sessionStorage.getItem(ScrollMemoryController.RETURN_KEY) !== key) return;

        // Turbo prvo pokaže keširani snapshot pa sveže renderovanu stranicu — marker traje do pravog crtanja.
        if (!document.documentElement.hasAttribute('data-turbo-preview')) {
            sessionStorage.removeItem(ScrollMemoryController.RETURN_KEY);
        }

        const raw = sessionStorage.getItem(ScrollMemoryController.storageKey(key));
        if (raw === null) return;

        const { y, id } = JSON.parse(raw) as { y: number; id: string | null };

        requestAnimationFrame(() => {
            const item = id ? this.findItem(id) : null;
            if (item) this.dispatch('restore', { detail: { item } });

            document.documentElement.style.scrollBehavior = 'auto';
            window.scrollTo(0, y);
            requestAnimationFrame(() => {
                document.documentElement.style.scrollBehavior = '';
            });
        });
    }

    // Klik na link ka projektu. Prvi klik na sliku širi stavku i ne vodi nikud (project-list ga preseče) — preskače se.
    store(event: Event): void {
        if (event.defaultPrevented) return;
        if (!(event.target as Element).closest('a[href]')) return;

        const expanded = this.element.querySelector<HTMLElement>('[data-scroll-memory-id][data-expanded]');
        sessionStorage.setItem(
            ScrollMemoryController.storageKey(location.pathname),
            JSON.stringify({ y: window.scrollY, id: expanded?.dataset.scrollMemoryId ?? null }),
        );
    }

    // „Back" na projektu: sledeće učitavanje odredišta vraća zapamćeno stanje.
    back(): void {
        const href = (this.element as HTMLAnchorElement).href;
        if (!href) return;
        sessionStorage.setItem(ScrollMemoryController.RETURN_KEY, new URL(href, location.href).pathname);
    }

    private findItem(id: string): HTMLElement | null {
        return Array.from(this.element.querySelectorAll<HTMLElement>('[data-scroll-memory-id]'))
            .find((item) => item.dataset.scrollMemoryId === id) ?? null;
    }

    private static storageKey(path: string): string {
        return `scroll-memory:${path}`;
    }
}
