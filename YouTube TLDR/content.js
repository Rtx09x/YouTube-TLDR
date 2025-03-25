/**
 * YouTube TLDR Extension - Content Script
 * Adds additional interception for dynamically loaded videos and thumbnails
 */

// Intercept thumbnail clicks before they navigate
function setupThumbnailInterception() {
  // Select all video thumbnails
  const thumbnails = document.querySelectorAll('a.ytd-thumbnail');
  
  thumbnails.forEach(thumbnail => {
    // Only add listener if we haven't already
    if (!thumbnail.dataset.tldrIntercepted) {
      thumbnail.dataset.tldrIntercepted = 'true';
      
      thumbnail.addEventListener('click', (event) => {
        // Check if we should intercept (based on settings)
        chrome.storage.local.get(["enabledStatus"], (data) => {
          if (data.enabledStatus === false) return; // Extension disabled
          
          // Get the video ID from the href
          const href = thumbnail.getAttribute('href');
          if (href && href.includes('/watch')) {
            const videoId = new URLSearchParams(href.split('?')[1]).get('v');
            
            if (videoId) {
              // Prevent default navigation
              event.preventDefault();
              event.stopPropagation();
              
              // Redirect to our summary page
              const summaryUrl = chrome.runtime.getURL(`summary/summary.html?videoId=${videoId}`);
              window.location.href = summaryUrl;
            }
          }
        });
      }, true); // Use capture to get event before YouTube's handlers
    }
  });
}

// Run thumbnail interception on page load and periodically for SPAs
document.addEventListener('DOMContentLoaded', () => {
  setupThumbnailInterception();
  
  // Set up mutation observer for dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    setupThumbnailInterception();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}); 