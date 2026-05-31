// Main JavaScript entry point
// Import Bootstrap JavaScript and expose globally
import * as bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";

// Make Bootstrap available globally for WordPress customizer and other scripts
window.bootstrap = bootstrap;

// Import custom JavaScript modules
import "./carousel.js";
import "./facebook-sdk.js";
import "./emdash-save-gate.js";
