import { Controller } from '@hotwired/stimulus';

export default class extends Controller {
    connect() {
        console.log('✅ Hello TS Stimulus controller connected!');
    }
}