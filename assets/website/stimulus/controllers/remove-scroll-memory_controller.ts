import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    static values = { key: String };
    keyValue!: string;

    // This method will be called via `data-action="click->remove-scroll-memory#clear"`
    clear() {
        // Remove scroll memory for a specific key
        if (this.keyValue) {
            sessionStorage.removeItem(`scroll:${this.keyValue}`);
        } else {
            // Remove all scroll memory keys
            Object.keys(sessionStorage).forEach((k) => {
                if (k.startsWith("scroll:")) sessionStorage.removeItem(k);
            });
        }
    }
}
