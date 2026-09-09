import { Controller } from '@hotwired/stimulus';

export default class ErrorController extends Controller {
    connect(): void {
        this.element
            .querySelector<HTMLButtonElement>('.err-refresh-btn')
            ?.addEventListener('click', () => window.location.reload());
    }
}
