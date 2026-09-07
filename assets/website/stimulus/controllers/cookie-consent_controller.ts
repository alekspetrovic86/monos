import { Controller } from '@hotwired/stimulus';

interface ConsentPreferences {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
    timestamp: string;
}

export default class CookieConsentController extends Controller {
    static targets = ['banner', 'backdrop', 'modal', 'analyticsToggle', 'marketingToggle'];

    declare bannerTarget: HTMLElement;
    declare backdropTarget: HTMLElement;
    declare modalTarget: HTMLElement;
    declare analyticsToggleTarget: HTMLInputElement;
    declare marketingToggleTarget: HTMLInputElement;

    private readonly COOKIE_NAME = 'cc_consent';
    private readonly COOKIE_DAYS = 365;

    connect(): void {
        const stored = this._readCookie();
        if (!stored) {
            // Slight delay so banner doesn't flash during page load
            setTimeout(() => this._showBanner(), 600);
        } else {
            this._dispatch(stored);
        }
    }

    // ── Public actions ────────────────────────────────────────────────────

    acceptAll(): void {
        this._save({ necessary: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
        this._hideBanner();
        this._closeModal();
    }

    rejectAll(): void {
        this._save({ necessary: true, analytics: false, marketing: false, timestamp: new Date().toISOString() });
        this._hideBanner();
        this._closeModal();
    }

    saveSettings(): void {
        this._save({
            necessary: true,
            analytics: this.analyticsToggleTarget.checked,
            marketing: this.marketingToggleTarget.checked,
            timestamp: new Date().toISOString(),
        });
        this._hideBanner();
        this._closeModal();
    }

    openSettings(): void {
        const stored = this._readCookie();
        if (stored) {
            this.analyticsToggleTarget.checked = stored.analytics;
            this.marketingToggleTarget.checked = stored.marketing;
        }
        this.modalTarget.setAttribute('aria-hidden', 'false');
        this.backdropTarget.setAttribute('aria-hidden', 'false');
        this.modalTarget.classList.add('cc-modal--open');
        this.backdropTarget.classList.add('cc-backdrop--open');
        document.body.style.overflow = 'hidden';
    }

    closeSettings(): void {
        this._closeModal();
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private _showBanner(): void {
        this.bannerTarget.classList.add('cc-banner--visible');
        this.bannerTarget.setAttribute('aria-hidden', 'false');
    }

    private _hideBanner(): void {
        this.bannerTarget.classList.remove('cc-banner--visible');
        this.bannerTarget.setAttribute('aria-hidden', 'true');
    }

    private _closeModal(): void {
        this.modalTarget.classList.remove('cc-modal--open');
        this.backdropTarget.classList.remove('cc-backdrop--open');
        this.modalTarget.setAttribute('aria-hidden', 'true');
        this.backdropTarget.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    private _save(prefs: ConsentPreferences): void {
        this._writeCookie(prefs);
        this._dispatch(prefs);
    }

    private _dispatch(prefs: ConsentPreferences): void {
        window.dispatchEvent(new CustomEvent('cc:consent', { detail: prefs }));

        // Update Google Consent Mode v2
        const gtag = (window as unknown as Record<string, unknown>).gtag as ((...args: unknown[]) => void) | undefined;
        if (typeof gtag === 'function') {
            gtag('consent', 'update', {
                analytics_storage:  prefs.analytics  ? 'granted' : 'denied',
                ad_storage:         prefs.marketing  ? 'granted' : 'denied',
                ad_user_data:       prefs.marketing  ? 'granted' : 'denied',
                ad_personalization: prefs.marketing  ? 'granted' : 'denied',
            });
        }
    }

    private _readCookie(): ConsentPreferences | null {
        const match = document.cookie.match(new RegExp('(?:^|; )' + this.COOKIE_NAME + '=([^;]*)'));
        if (!match) return null;
        try {
            return JSON.parse(decodeURIComponent(match[1])) as ConsentPreferences;
        } catch {
            return null;
        }
    }

    private _writeCookie(prefs: ConsentPreferences): void {
        const expires = new Date();
        expires.setDate(expires.getDate() + this.COOKIE_DAYS);
        document.cookie = [
            `${this.COOKIE_NAME}=${encodeURIComponent(JSON.stringify(prefs))}`,
            `expires=${expires.toUTCString()}`,
            'path=/',
            'SameSite=Lax',
        ].join('; ');
    }
}
