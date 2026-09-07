declare const grecaptcha: {
    render(el: HTMLElement, options: Record<string, unknown>): void;
    ready(cb: () => void): void;
};

function recaptchaTheme(el: HTMLElement): 'dark' | 'light' {
    const section   = el.closest<HTMLElement>('section[data-mode-block]');
    const isCmsDark  = section?.dataset.modeBlock === 'dark';
    const isUserDark = document.documentElement.dataset.userTheme === 'dark';
    return (isCmsDark || isUserDark) ? 'dark' : 'light';
}

function renderOne(el: HTMLElement): void {
    const sitekey = el.dataset.sitekey ?? '';
    const size    = el.dataset.size  || 'normal';
    const type    = el.dataset.type  || 'image';

    let wrap = el.closest<HTMLElement>('.ct-recaptcha-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'ct-recaptcha-wrap';
        el.parentNode!.insertBefore(wrap, el);
        el.remove();
    }

    wrap.innerHTML = '';
    const fresh = document.createElement('div');
    fresh.className       = 'g-recaptcha-placeholder';
    fresh.dataset.sitekey = sitekey;
    fresh.dataset.size    = size;
    fresh.dataset.type    = type;
    wrap.appendChild(fresh);

    grecaptcha.render(fresh, { sitekey, theme: recaptchaTheme(wrap), size, type });
}

/**
 * Sets up reCAPTCHA rendering for all `.g-recaptcha-placeholder` elements
 * found within `scope`. Also registers `window.ctRecaptchaOnLoad` so the
 * async reCAPTCHA script fires correctly, and watches for user-theme changes.
 *
 * Returns a cleanup function that disconnects the MutationObserver.
 */
export function setupRecaptcha(scope: Element): () => void {
    let themeObserver: MutationObserver | undefined;

    function renderAll(): void {
        scope
            .querySelectorAll<HTMLElement>('.g-recaptcha-placeholder')
            .forEach(el => renderOne(el));

        if (!themeObserver) {
            themeObserver = new MutationObserver(() => {
                scope
                    .querySelectorAll<HTMLElement>('.g-recaptcha-placeholder')
                    .forEach(el => renderOne(el));
            });
            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-user-theme'],
            });
        }
    }

    (window as unknown as Record<string, unknown>).ctRecaptchaOnLoad = renderAll;

    // If grecaptcha is already present, wait for it to be fully ready
    // before calling render (avoids "render is not a function" on partial init)
    if (typeof grecaptcha !== 'undefined') {
        grecaptcha.ready(renderAll);
    }

    return () => themeObserver?.disconnect();
}
