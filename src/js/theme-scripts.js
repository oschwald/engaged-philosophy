// Theme-specific JavaScript functionality
// Migrated from original Bootstrap 2 theme

// Handle responsive navigation
function initResponsiveNav() {
  const navToggle = document.querySelector('.navbar-toggler');
  const navCollapse = document.querySelector('.navbar-collapse');
  
  if (navToggle && navCollapse) {
    navToggle.addEventListener('click', function() {
      navCollapse.classList.toggle('show');
    });
  }
}

// Handle carousel functionality (if needed)
function initCarousel() {
  const carouselElements = document.querySelectorAll('.carousel');
  
  carouselElements.forEach(function(carousel) {
    // Bootstrap 5 carousel is auto-initialized
    // Add any custom carousel functionality here
  });
}

// Handle gallery functionality
function initGallery() {
  const galleryItems = document.querySelectorAll('.gallery-item');
  
  galleryItems.forEach(function(item) {
    // Add any gallery-specific functionality here
  });
}

// Handle search functionality
function initSearch() {
  const searchForm = document.querySelector('.form-search');
  const searchInput = document.querySelector('#s');
  
  if (searchForm && searchInput) {
    // Add search enhancements here
  }
}

// Load Facebook SDK externally
function initFacebookSDK() {
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.0";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
}

// Initialize all theme functionality
function initTheme() {
  initResponsiveNav();
  initCarousel();
  initGallery();
  initSearch();
  initFacebookSDK();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initTheme();
});

// Export for use in main index.js
export { initTheme };