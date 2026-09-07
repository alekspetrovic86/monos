import { Controller } from '@hotwired/stimulus';

export default class NavbarController extends Controller {
    static targets = [
        'mobileMenu',
        'mobileServicesContent',
        'mobileServicesChevron',
        'mobileLangContent',
        'mobileLangChevron',
        'navbar',
        'desktopHoverTrigger',
    ];

    declare mobileMenuTarget: HTMLElement;
    declare hasMobileMenuTarget: boolean;
    declare mobileServicesContentTarget: HTMLElement;
    declare mobileServicesChevronTarget: HTMLElement;
    declare mobileLangContentTarget: HTMLElement;
    declare mobileLangChevronTarget: HTMLElement;
    declare navbarTarget: HTMLElement;
    declare desktopHoverTriggerTargets: HTMLElement[];
    declare hasDesktopHoverTriggerTarget: boolean;

    private navbar!: HTMLElement;
    private _scrollHandler!: () => void;
    private _beforeCacheHandler!: () => void;
    private _desktopHoverDepth = 0;
    private _desktopEnterHandlers = new Map<HTMLElement, EventListener>();
    private _desktopLeaveHandlers = new Map<HTMLElement, EventListener>();
    private _desktopOutsideClickHandler: ((e: Event) => void) | null = null;

    connect(): void {
        this.navbar = this.navbarTarget;
        this._resetMobileState();
        this._scrollHandler = this._handleScroll.bind(this);
        this._beforeCacheHandler = () => this._resetMobileState();
        window.addEventListener('scroll', this._scrollHandler, { passive: true });
        document.addEventListener('turbo:before-cache', this._beforeCacheHandler);
        this._setSafariClass();
        this._bindDesktopHoverExpand();
    }

    disconnect(): void {
        window.removeEventListener('scroll', this._scrollHandler);
        document.removeEventListener('turbo:before-cache', this._beforeCacheHandler);
        this._unbindDesktopHoverExpand();
        this._closeAllDesktopDropdowns();
    }

    // ── Mobile menu ────────────────────────────────────────────────

    private _resetMobileState(): void {
        const el = this.element as HTMLElement;
        el.dataset.mobileOpen = 'false';
        if (this.hasMobileMenuTarget) {
            this.mobileMenuTarget.dataset.navbarMobileOpenValue = 'false';
        }
        document.body.style.overflow = '';
    }

    toggleMobile(): void {
        const el = this.element as HTMLElement;
        const open = el.dataset.mobileOpen !== 'true';
        el.dataset.mobileOpen = String(open);
        if (this.hasMobileMenuTarget) {
            this.mobileMenuTarget.dataset.navbarMobileOpenValue = String(open);
        }
        document.body.style.overflow = open ? 'hidden' : '';
    }

    closeMobile(): void {
        const el = this.element as HTMLElement;
        el.dataset.mobileOpen = 'false';
        if (this.hasMobileMenuTarget) {
            this.mobileMenuTarget.dataset.navbarMobileOpenValue = 'false';
        }
        document.body.style.overflow = '';
        this.mobileServicesContentTarget.classList.remove('accordion-content--open');
        this.mobileServicesChevronTarget.classList.remove('navbar-chevron--open');
    }

    // ── Desktop dropdowns (click toggle) ─────────────────────────

    toggleDesktopDropdown(event: Event): void {
        if ((event as PointerEvent).pointerType === 'mouse') return;
        event.preventDefault();
        const trigger = (event.currentTarget as HTMLElement)
            .closest<HTMLElement>('[data-navbar-target="desktopHoverTrigger"]');
        if (!trigger) return;

        const isOpen = trigger.classList.contains('is-open');
        this._closeAllDesktopDropdowns();

        if (!isOpen) {
            trigger.classList.add('is-open');
            this.navbar.classList.add('navbar-expanded');
            this._desktopOutsideClickHandler = (e: Event) => {
                if (!trigger.contains(e.target as Node)) {
                    this._closeAllDesktopDropdowns();
                }
            };
            setTimeout(() => {
                document.addEventListener('click', this._desktopOutsideClickHandler!);
            }, 0);
        }
    }

    private _closeAllDesktopDropdowns(): void {
        if (this._desktopOutsideClickHandler) {
            document.removeEventListener('click', this._desktopOutsideClickHandler);
            this._desktopOutsideClickHandler = null;
        }
        this.desktopHoverTriggerTargets.forEach(t => t.classList.remove('is-open'));
        this._desktopHoverDepth = 0;
        this.navbar.classList.remove('navbar-expanded');
    }

    // ── Mobile accordions ─────────────────────────────────────────

    toggleMobileServices(): void {
        const open = this.mobileServicesContentTarget.classList.toggle('accordion-content--open');
        this.mobileServicesChevronTarget.classList.toggle('navbar-chevron--open', open);
    }

    toggleMobileLang(): void {
        const open = this.mobileLangContentTarget.classList.toggle('accordion-content--open');
        this.mobileLangChevronTarget.classList.toggle('navbar-chevron--open', open);
    }

    // ── Scroll ────────────────────────────────────────────────────

    private _handleScroll(): void {
        const scrolled = window.scrollY > 100;
        const current = this.navbar.dataset.scrolled === 'true';
        if (scrolled !== current) {
            this.navbar.dataset.scrolled = String(scrolled);
        }
    }

    private _bindDesktopHoverExpand(): void {
        if (!this.hasDesktopHoverTriggerTarget) return;

        this.desktopHoverTriggerTargets.forEach((trigger) => {
            const onEnter: EventListener = () => {
                if (!window.matchMedia('(min-width: 1280px)').matches) return;
                this._desktopHoverDepth += 1;
                this.navbar.classList.add('navbar-expanded');
            };

            const onLeave: EventListener = () => {
                if (!window.matchMedia('(min-width: 1280px)').matches) return;
                this._desktopHoverDepth = Math.max(0, this._desktopHoverDepth - 1);
                if (this._desktopHoverDepth === 0) {
                    this.navbar.classList.remove('navbar-expanded');
                }
            };

            trigger.addEventListener('mouseenter', onEnter);
            trigger.addEventListener('mouseleave', onLeave);

            this._desktopEnterHandlers.set(trigger, onEnter);
            this._desktopLeaveHandlers.set(trigger, onLeave);
        });
    }

    private _unbindDesktopHoverExpand(): void {
        this.desktopHoverTriggerTargets.forEach((trigger) => {
            const onEnter = this._desktopEnterHandlers.get(trigger);
            const onLeave = this._desktopLeaveHandlers.get(trigger);
            if (onEnter) trigger.removeEventListener('mouseenter', onEnter);
            if (onLeave) trigger.removeEventListener('mouseleave', onLeave);
        });

        this._desktopEnterHandlers.clear();
        this._desktopLeaveHandlers.clear();
        this._desktopHoverDepth = 0;
        this.navbar.classList.remove('navbar-expanded');
    }

    private _setSafariClass(): void {
        const ua = navigator.userAgent;
        // All iOS browsers (Chrome iOS, Firefox iOS, Edge iOS, …) use WebKit internally —
        // same rendering engine as Safari, same compositing limitations.
        const isIOS = /iPad|iPhone|iPod/.test(ua)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+
        const isDesktopSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS/.test(ua);
        document.documentElement.classList.toggle('is-safari', isIOS || isDesktopSafari);
    }
}
