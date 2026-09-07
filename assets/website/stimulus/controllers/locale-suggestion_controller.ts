import { Controller } from '@hotwired/stimulus';

interface LocalizationItem {
    locale?: string;
    url?: string;
}

interface GeoLookupResponse {
    success?: boolean;
    country_code?: string;
    country?: string;
}

interface LocaleSuggestionState {
    seenAt: string;
    action: 'accepted' | 'dismissed';
    locale: string;
}

export default class LocaleSuggestionController extends Controller {
    static targets = ['popup', 'backdrop', 'text', 'switchLink'];

    static values = {
        currentLocale: String,
        localizations: String,
        localeLabels: String,
        textTemplate: String,
        acceptTemplate: String,
        endpoint: String,
    };

    declare popupTarget: HTMLElement;
    declare backdropTarget: HTMLElement;
    declare textTarget: HTMLElement;
    declare switchLinkTarget: HTMLAnchorElement;

    declare currentLocaleValue: string;
    declare localizationsValue: string;
    declare localeLabelsValue: string;
    declare textTemplateValue: string;
    declare acceptTemplateValue: string;
    declare endpointValue: string;

    private readonly STORAGE_KEY = 'locale_suggestion_state';
    private readonly SESSION_KEY = 'locale_suggestion_session_seen';
    private readonly STORAGE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

    connect(): void {
        if (sessionStorage.getItem(this.SESSION_KEY)) return;
        if (this._hasRecentState()) return;

        const availableLocalizations = this._getLocalizations();
        if (availableLocalizations.length === 0) return;

        sessionStorage.setItem(this.SESSION_KEY, '1');

        window.setTimeout(() => {
            void this._loadSuggestion();
        }, 1200);
    }

    dismiss(): void {
        const href = this.switchLinkTarget.getAttribute('href') || '';
        const locale = this._findLocaleByUrl(href) || this.currentLocaleValue;
        this._storeState('dismissed', locale);
        this._hide();
    }

    accept(): void {
        const href = this.switchLinkTarget.getAttribute('href') || '';
        const locale = this._findLocaleByUrl(href) || this.currentLocaleValue;
        this._storeState('accepted', locale);
    }

    private async _loadSuggestion(): Promise<void> {
        try {
            const response = await fetch(this.endpointValue, {
                headers: { Accept: 'application/json' },
                credentials: 'omit',
            });

            if (!response.ok) return;

            const payload = await response.json() as GeoLookupResponse;
            const detectedCountryCode = payload.country_code || payload.country;
            if (!detectedCountryCode) return;

            const suggestedLocale = this._mapCountryToLocale(detectedCountryCode);
            if (!suggestedLocale || suggestedLocale === this.currentLocaleValue) return;

            const localization = this._getLocalizations().find((item) => item.locale === suggestedLocale && item.url);
            if (!localization?.url) return;

            this._applySuggestion(suggestedLocale, localization.url);
            this._show();
        } catch {
            // Ignore lookup failures and keep the current locale.
        }
    }

    private _applySuggestion(locale: string, url: string): void {
        const localeName = this._getLocaleLabels()[locale] || locale.toUpperCase();
        this.textTarget.textContent = this._replaceLocalePlaceholder(this.textTemplateValue, localeName);
        this.switchLinkTarget.textContent = this._replaceLocalePlaceholder(this.acceptTemplateValue, localeName);
        this.switchLinkTarget.href = url;
    }

    private _show(): void {
        this.popupTarget.classList.add('ls-popup--visible');
        this.backdropTarget.classList.add('ls-backdrop--visible');
        this.popupTarget.setAttribute('aria-hidden', 'false');
        this.backdropTarget.setAttribute('aria-hidden', 'false');
    }

    private _hide(): void {
        this.popupTarget.classList.remove('ls-popup--visible');
        this.backdropTarget.classList.remove('ls-backdrop--visible');
        this.popupTarget.setAttribute('aria-hidden', 'true');
        this.backdropTarget.setAttribute('aria-hidden', 'true');
    }

    private _mapCountryToLocale(countryCode: string): string {
        const normalizedCountry = countryCode.toUpperCase();

        if (['RS', 'BA', 'ME', 'HR'].includes(normalizedCountry)) return 'sr';
        if (['DE', 'AT', 'CH', 'LI', 'LU'].includes(normalizedCountry)) return 'de';
        if (normalizedCountry === 'JP') return 'ja';

        return 'en';
    }

    private _getLocalizations(): LocalizationItem[] {
        try {
            const parsed = JSON.parse(this.localizationsValue) as LocalizationItem[] | Record<string, LocalizationItem>;
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return Object.values(parsed);
            return [];
        } catch {
            return [];
        }
    }

    private _getLocaleLabels(): Record<string, string> {
        try {
            return JSON.parse(this.localeLabelsValue) as Record<string, string>;
        } catch {
            return {};
        }
    }

    private _replaceLocalePlaceholder(template: string, localeName: string): string {
        return template.replace(/__LOCALE__/g, localeName).replace(/\s+:\s*$/, '').trim();
    }

    private _hasRecentState(): boolean {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return false;

        try {
            const state = JSON.parse(stored) as LocaleSuggestionState;
            const timestamp = new Date(state.seenAt).getTime();
            if (!timestamp || Number.isNaN(timestamp)) {
                localStorage.removeItem(this.STORAGE_KEY);
                return false;
            }

            if (Date.now() - timestamp > this.STORAGE_TTL_MS) {
                localStorage.removeItem(this.STORAGE_KEY);
                return false;
            }

            return true;
        } catch {
            localStorage.removeItem(this.STORAGE_KEY);
            return false;
        }
    }

    private _storeState(action: 'accepted' | 'dismissed', locale: string): void {
        const state: LocaleSuggestionState = {
            seenAt: new Date().toISOString(),
            action,
            locale,
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }

    private _findLocaleByUrl(url: string): string | null {
        const localization = this._getLocalizations().find((item) => item.url === url && item.locale);
        return localization?.locale?.split('_')[0] || null;
    }
}