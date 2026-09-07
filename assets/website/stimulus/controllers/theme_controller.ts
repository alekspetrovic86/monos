import { Controller } from '@hotwired/stimulus';

export default class ThemeController extends Controller {
    static values = { headerMode: String, toggleEnabled: String, autoByTime: String };
    declare headerModeValue: string;
    declare toggleEnabledValue: string;
    declare autoByTimeValue: string;

    private _sunTimer: ReturnType<typeof setTimeout> | null = null;

    private get _toggleEnabled(): boolean {
        return this.toggleEnabledValue === 'true';
    }

    private get _autoByTime(): boolean {
        return this.autoByTimeValue === 'true';
    }

    connect(): void {
        if (this._autoByTime) {
            localStorage.removeItem('user_theme');

            // Apply cached theme immediately to avoid flash on page navigation
            const cached = sessionStorage.getItem('auto_theme') as 'dark' | 'light' | null;
            if (cached) {
                this.applyTheme(cached);
            } else {
                // First visit: use OS preference as instant hint while geolocation resolves
                const osPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.applyTheme(osPrefersDark ? 'dark' : 'light');
            }

            this._startAutoTheme();
            return;
        }

        if (!this._toggleEnabled) {
            sessionStorage.removeItem('auto_theme');
            localStorage.removeItem('user_theme');
            delete document.documentElement.dataset.userTheme;
            this._applyNavTheme(this.headerModeValue as 'dark' | 'light' || 'light');
            return;
        }

        // Clear any stale auto_theme so it doesn't affect future page loads
        sessionStorage.removeItem('auto_theme');

        const saved = localStorage.getItem('user_theme') as 'dark' | 'light' | null;
        if (saved === 'dark' || saved === 'light') {
            this.applyTheme(saved);
        } else {
            // No saved preference — clear any stale data-user-theme set by anti-FOUC
            delete document.documentElement.dataset.userTheme;
        }
    }

    disconnect(): void {
        if (this._sunTimer) clearTimeout(this._sunTimer);
    }

    toggle(): void {
        if (!this._toggleEnabled || this._autoByTime) return;
        const current = document.documentElement.dataset.userTheme;
        const effective = (current === 'dark' || current === 'light')
            ? current
            : (this.headerModeValue || 'light');
        this.applyTheme(effective === 'dark' ? 'light' : 'dark');
    }

    applyTheme(theme: 'dark' | 'light'): void {
        document.documentElement.dataset.userTheme = theme;
        if (!this._autoByTime) {
            localStorage.setItem('user_theme', theme);
        }
        this._applyNavTheme(theme);
    }

    // ── Auto theme by sunrise/sunset ─────────────────────────────────────────

    private _startAutoTheme(): void {
        if (!('geolocation' in navigator)) {
            this._applyThemeByHour();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => this._scheduleByLocation(pos.coords.latitude, pos.coords.longitude),
            () => this._applyThemeByHour(), // fallback: no permission
            { timeout: 5000, maximumAge: 3600000 },
        );
    }

    private _scheduleByLocation(lat: number, lon: number): void {
        const { sunrise, sunset } = this._getSunTimes(lat, lon);
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

        const isDark = nowMin < sunrise || nowMin >= sunset;
        const theme: 'dark' | 'light' = isDark ? 'dark' : 'light';
        sessionStorage.setItem('auto_theme', theme);
        this.applyTheme(theme);

        // Schedule switch at next transition
        let nextSwitch: number;
        if (nowMin < sunrise) {
            nextSwitch = sunrise - nowMin;
        } else if (nowMin < sunset) {
            nextSwitch = sunset - nowMin;
        } else {
            // Past sunset — next is tomorrow's sunrise
            nextSwitch = 1440 - nowMin + sunrise;
        }

        this._sunTimer = setTimeout(() => {
            this._scheduleByLocation(lat, lon);
        }, nextSwitch * 60 * 1000);
    }

    // Fallback when geolocation is unavailable: 7:00 light, 20:00 dark
    private _applyThemeByHour(): void {
        const hour = new Date().getHours();
        const theme: 'dark' | 'light' = (hour >= 7 && hour < 20) ? 'light' : 'dark';
        sessionStorage.setItem('auto_theme', theme);
        this.applyTheme(theme);
    }

    /**
     * NOAA simplified sunrise/sunset algorithm.
     * Returns sunrise and sunset as minutes since midnight (local time).
     */
    private _getSunTimes(lat: number, lon: number): { sunrise: number; sunset: number } {
        const now   = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const N     = Math.floor((now.getTime() - start.getTime()) / 86_400_000);

        const zenith   = 90.833;
        const lngHour  = lon / 15;
        const toRad    = (d: number) => (d * Math.PI) / 180;
        const toDeg    = (r: number) => (r * 180) / Math.PI;
        const norm360  = (v: number) => ((v % 360) + 360) % 360;

        const calcForCycle = (isSunrise: boolean): number => {
            const t  = N + ((isSunrise ? 6 : 18) - lngHour) / 24;
            const M  = (0.9856 * t - 3.289 + 360) % 360;
            const L  = norm360(M + 1.916 * Math.sin(toRad(M)) + 0.020 * Math.sin(toRad(2 * M)) + 282.634);
            let   RA = norm360(toDeg(Math.atan(0.91764 * Math.tan(toRad(L)))));
            RA      += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
            RA      /= 15;

            const sinDec = 0.39782 * Math.sin(toRad(L));
            const cosDec = Math.cos(Math.asin(sinDec));
            const cosH   = (Math.cos(toRad(zenith)) - sinDec * Math.sin(toRad(lat))) / (cosDec * Math.cos(toRad(lat)));

            // Polar edge-cases
            if (cosH > 1) return isSunrise ? 7 * 60 : 20 * 60;
            if (cosH < -1) return isSunrise ? 0      : 24 * 60;

            const H  = isSunrise ? 360 - toDeg(Math.acos(cosH)) : toDeg(Math.acos(cosH));
            const T  = H / 15 + RA - 0.06571 * t - 6.622;
            // Convert UTC to local minutes
            const utcMin = ((T - lngHour) % 24 + 24) % 24 * 60;
            const offset = now.getTimezoneOffset(); // minutes behind UTC
            return Math.round(((utcMin - offset) % 1440 + 1440) % 1440);
        };

        return {
            sunrise: calcForCycle(true),
            sunset:  calcForCycle(false),
        };
    }

    private _applyNavTheme(theme: 'dark' | 'light'): void {
        const navWrapper = document.querySelector<HTMLElement>('[data-controller="navbar"]');
        if (navWrapper) navWrapper.dataset.navTheme = theme;

        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (theme === 'dark') {
                navbar.style.backgroundColor = 'rgba(0,0,0,0.65)';
                navbar.style.borderColor     = 'rgba(255,255,255,0.08)';
                navbar.style.boxShadow       = 'none';
            } else {
                navbar.style.backgroundColor = 'var(--color-navbar-bg)';
                navbar.style.borderColor     = 'var(--color-navbar-border)';
                navbar.style.boxShadow       = 'var(--color-navbar-shadow)';
            }
        }

        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
            if (theme === 'dark') {
                mobileMenu.style.backgroundColor  = '#000000';
                mobileMenu.style.backgroundImage  = 'none';
                mobileMenu.style.backgroundBlendMode = '';
            } else {
                mobileMenu.style.backgroundColor  = '#ffffff';
                mobileMenu.style.backgroundImage  =
                    'linear-gradient(135deg, color-mix(in srgb, var(--color-violet-500) 5%, transparent) 0%, color-mix(in srgb, var(--color-pink-500) 5%, transparent) 50%, color-mix(in srgb, var(--color-orange-500) 5%, transparent) 100%)';
                mobileMenu.style.backgroundBlendMode = 'overlay';
            }
        }
    }
}
