import { Controller } from '@hotwired/stimulus';

export default class HelloController extends Controller {
    static values = {
        name: { type: String, default: 'TypeScript' }
    };

    declare nameValue: string;

    connect(): void {
        console.log(`[HelloController] Connected! Running with ${this.nameValue} ✓`);
        this.element.setAttribute('data-hello-active', 'true');
    }

    disconnect(): void {
        console.log('[HelloController] Disconnected');
    }
}
