/**
 * YouTube TLDR Extension - Background Script
 * Intercepts YouTube video navigations and redirects to summary page
 */

// Listen for YouTube video navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run on YouTube URLs
  if (!tab.url || !tab.url.includes("youtube.com/watch")) return;
  
  // Extract video ID from URL
  const videoId = new URL(tab.url).searchParams.get("v");
  if (!videoId) return;
  
  // Check if we should redirect (based on user settings)
  chrome.storage.local.get(["enabledStatus", "whitelistedChannels", "bypassRedirects"], (data) => {
    // Skip if extension is disabled
    if (data.enabledStatus === false) return;
    
    // Skip if this URL is in the bypass list (from "Watch Video" button)
    if (data.bypassRedirects && data.bypassRedirects[videoId]) {
      // Remove from bypass list after using it once
      const updatedBypass = { ...data.bypassRedirects };
      delete updatedBypass[videoId];
      chrome.storage.local.set({ bypassRedirects: updatedBypass });
      return;
    }
    
    // Add channel whitelist check later
    // For now, redirect if not in bypass list
    
    // Redirect to our summary page
    if (changeInfo.status === "loading") {
      const summaryUrl = chrome.runtime.getURL(`summary/summary.html?videoId=${videoId}`);
      chrome.tabs.update(tabId, { url: summaryUrl });
    }
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSettings") {
    chrome.storage.local.get(null, (settings) => {
      sendResponse(settings);
    });
    return true; // Keep channel open for async response
  }
  
  if (message.action === "saveSettings") {
    chrome.storage.local.set(message.settings, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  
  // Add YouTube video to bypass list (for "Watch Video" button)
  if (message.action === "bypassRedirect") {
    chrome.storage.local.get(["bypassRedirects"], (data) => {
      const bypassRedirects = data.bypassRedirects || {};
      bypassRedirects[message.videoId] = true;
      chrome.storage.local.set({ bypassRedirects }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // Keep channel open for async response
  }
}); 