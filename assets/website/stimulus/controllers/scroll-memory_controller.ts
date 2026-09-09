import { Controller } from '@hotwired/stimulus';

// data-controller="scroll-memory" — lista projekata se vraća tačno kako je ostavljena:
// ista raširena stavka, isti skrol (raširena stavka se podiže na vrh, pa sam scrollY nije dovoljan).
//
// Tri mesta, jedan kontroler:
//   lista      (naslovna i Information, uz project-list): `store` na klik linka beleži scrollY + id raširene
//              stavke pod KLJUČEM LISTE (`data-scroll-memory-key-value` = koren jezika — obe stranice crtaju
//              istu listu, pa dele zapis); connect() vraća oba — ali SAMO kad se stiglo kroz marker
//              (Back / Information / CLOSE), pa Reset/logo i dalje otvaraju listu od vrha.
//   Back link  (stranica projekta): `back` postavlja marker = putanja odredišta.
//   Information / CLOSE (meni): `carry` — odredište prikazuje ISTU listu (Information je stanje nad listom,
//              ne nova stranica), pa se stanje liste zabeleži (kao `store`) i odmah traži povratak (kao `back`).
//              Turbo bi inače listu vratio na vrh.
//
// Raširenu stavku vraća project-list na događaj `scroll-memory:restore` (detail.item, može biti null) — bez animacije.
// Skrol se vraća uz privremeno gašenje glatkog skrola (tehnika iz legacy-v1) da povratak ne bude animiran.
export default class ScrollMemoryController extends Controller<HTMLElement> {
    static values = { key: String };

    declare readonly hasKeyValue: boolean;

    private static readonly RETURN_KEY = 'scroll-memory:return';

    connect(): void {
        // Stanje vraća SAMO lista (nosi ključ). Linkovi (Back / Information / CLOSE) su okidači — na odredištu se
        // povezuju pre liste i ne smeju da potroše marker.
        if (!this.hasKeyValue) return;
        if (sessionStorage.getItem(ScrollMemoryController.RETURN_KEY) !== location.pathname) return;

        // Turbo prvo pokaže keširani snapshot pa sveže renderovanu stranicu — marker traje do pravog crtanja.
        if (!document.documentElement.hasAttribute('data-turbo-preview')) {
            sessionStorage.removeItem(ScrollMemoryController.RETURN_KEY);
        }

        // Lista koja nije iscrtana (Information na mobilnom: `hidden lg:block`) nema šta da vrati —
        // zapis ostaje za sledeću stranicu koja je crta.
        if (!ScrollMemoryController.isShown(this.element)) return;

        const raw = sessionStorage.getItem(ScrollMemoryController.storageKey(ScrollMemoryController.keyOf(this.element)));
        if (raw === null) return;

        const { y, id } = JSON.parse(raw) as { y: number; id: string | null };

        requestAnimationFrame(() => {
            this.dispatch('restore', { detail: { item: id ? this.findItem(id) : null } });

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

        ScrollMemoryController.save(this.element);
    }

    // „Back" na projektu: sledeće učitavanje odredišta vraća zapamćeno stanje.
    back(): void {
        const href = (this.element as HTMLAnchorElement).href;
        if (!href) return;
        sessionStorage.setItem(ScrollMemoryController.RETURN_KEY, new URL(href, location.href).pathname);
    }

    // „Information" u meniju / CLOSE na Information: lista ostaje gde je bila i na odredištu.
    // Bez iscrtane liste (mobilni Information: Esc → CLOSE) nema šta da se zabeleži — vraća se poslednji zapis.
    carry(): void {
        const list = document.querySelector<HTMLElement>('[data-scroll-memory-key-value]');
        if (list && ScrollMemoryController.isShown(list)) ScrollMemoryController.save(list);
        this.back();
    }

    // Ključ liste: `data-scroll-memory-key-value` (koren jezika — može biti i apsolutni URL, čuva se putanja), inače stranica.
    private static keyOf(list: HTMLElement): string {
        const key = list.dataset.scrollMemoryKeyValue;
        return key ? new URL(key, location.href).pathname : location.pathname;
    }

    private findItem(id: string): HTMLElement | null {
        return Array.from(this.element.querySelectorAll<HTMLElement>('[data-scroll-memory-id]'))
            .find((item) => item.dataset.scrollMemoryId === id) ?? null;
    }

    private static save(list: HTMLElement): void {
        const expanded = list.querySelector<HTMLElement>('[data-scroll-memory-id][data-expanded]');
        sessionStorage.setItem(
            ScrollMemoryController.storageKey(ScrollMemoryController.keyOf(list)),
            JSON.stringify({ y: window.scrollY, id: expanded?.dataset.scrollMemoryId ?? null }),
        );
    }

    private static isShown(element: HTMLElement): boolean {
        return element.getClientRects().length > 0;
    }

    private static storageKey(path: string): string {
        return `scroll-memory:${path}`;
    }
}
