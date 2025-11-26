// assets/controllers/loader_controller.ts
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
    private width: number = 0;
    private interval: number | undefined;

    connect(): void {
        document.addEventListener("turbo:visit", () => this.start());
        document.addEventListener("turbo:load", () => this.finish());

        if (document.readyState === "complete") {
            this.width = 100;
            this.updateWidth();
        }
    }

    start(): void {
        this.width = 0;
        this.updateWidth();
        (this.element as HTMLElement).style.display = "block";

        if (this.interval) clearInterval(this.interval);

        // Start smooth incremental loading
        this.interval = window.setInterval(() => {
            // Increment smaller amounts for slow progress
            if (this.width < 90) {
                const increment = Math.random() * 3 + 1; // 1% to 4%
                this.width += increment;
                if (this.width > 90) this.width = 90; // cap at 90%
                this.updateWidth();
            }
        }, 200); // slower interval
    }

    finish(): void {
        if (this.interval) clearInterval(this.interval);

        // Animate to 100% smoothly
        const finishInterval = window.setInterval(() => {
            if (this.width < 100) {
                this.width += 5; // smooth finish
                if (this.width > 100) this.width = 100;
                this.updateWidth();
            } else {
                clearInterval(finishInterval);
                setTimeout(() => {
                    (this.element as HTMLElement).style.display = "none";
                    this.width = 0;
                    this.updateWidth();
                }, 200);
            }
        }, 50);
    }

    private updateWidth(): void {
        (this.element as HTMLElement).style.width = `${this.width}%`;
    }
}
