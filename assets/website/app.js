/*
 * Welcome to your app's main JavaScript file!
 * We recommend including the built version of this JavaScript file
 * (and its CSS file) in your base layout (base.html.twig).
 */

// Vendor CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'swiper/css/bundle';

// Main SCSS
import './styles/app.scss';

// Bootstrap JS (optional – keep only if needed)
import 'bootstrap';
import "./stimulus/bootstrap";

// Stimulus auto-loader
import * as Turbo from "@hotwired/turbo";

// Optional debugging
window.Turbo = Turbo;

// Enable Turbo navigation
Turbo.session.drive = true;

// Your custom JS (site-specific logic)
import './main.js';