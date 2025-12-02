import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static values = { key: String };
    keyValue!: string;

    connect() {
        const pos = sessionStorage.getItem(this.storageKey);

        if (pos !== null) {
            requestAnimationFrame(() => {
                // Disable smooth scrolling temporarily
                document.documentElement.style.scrollBehavior = "auto";

                window.scrollTo(0, parseInt(pos, 10));

                // Restore smooth scrolling for the rest of the site
                requestAnimationFrame(() => {
                    document.documentElement.style.scrollBehavior = "";
                });
            });
        }
    }

    store() {
        sessionStorage.setItem(this.storageKey, String(window.scrollY));
    }

    get storageKey() {
        return `scroll:${this.keyValue}`;
    }
}
