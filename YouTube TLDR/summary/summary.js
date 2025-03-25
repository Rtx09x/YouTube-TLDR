/**
 * YouTube TLDR Extension - Summary Page JS
 * Fetches video info, transcript and generates AI summary
 */

// Get DOM elements
const videoTitle = document.getElementById('videoTitle');
const channelName = document.getElementById('channelName');
const videoStats = document.getElementById('videoStats');
const thumbnailImg = document.getElementById('thumbnailImg');
const summaryTone = document.getElementById('summaryTone');
const summaryLength = document.getElementById('summaryLength');
const summaryContent = document.getElementById('summaryContent');
const watchVideoBtn = document.getElementById('watchVideoBtn');
const copyBtn = document.getElementById('copyBtn');
const confirmDialog = document.getElementById('confirmDialog');
const confirmWatch = document.getElementById('confirmWatch');
const cancelWatch = document.getElementById('cancelWatch');
const userQuestion = document.getElementById('userQuestion');
const sendQuestion = document.getElementById('sendQuestion');
const chatMessages = document.getElementById('chatMessages');
const chatContainer = document.getElementById('chatContainer');
const themeToggle = document.getElementById('themeToggle');
const lightModeIcon = document.getElementById('lightModeIcon');
const darkModeIcon = document.getElementById('darkModeIcon');

// Store video data
let videoData = {
  videoId: null,
  title: null,
  transcript: null,
  summary: null
};

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('videoId');
videoData.videoId = videoId;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Ensure dialog is hidden on page load
  confirmDialog.style.display = 'none';
  confirmDialog.classList.add('hidden');
  
  // Load user preferences
  await loadUserPreferences();
  
  // Fetch video information
  await fetchVideoInfo();
  
  // Fetch video transcript
  await fetchTranscript();
  
  // Generate summary
  await generateSummary();
  
  // Set up event listeners
  setupEventListeners();
  
  // Apply theme (light/dark)
  applyTheme();
});

// Load user preferences from storage
async function loadUserPreferences() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
      if (settings) {
        // Set tone display
        if (settings.summaryTone) {
          const toneMap = {
            'professional': 'Professional',
            'witty': 'Witty',
            'funny': 'Funny',
            'genZ': 'Gen Z',
            'academic': 'Academic',
            'eli5': 'ELI5',
            'sarcastic': 'Sarcastic'
          };
          summaryTone.textContent = toneMap[settings.summaryTone] || 'Professional';
        }
        
        // Set length display
        if (settings.summaryLength) {
          const lengthMap = {
            'ultraShort': 'Ultra-short',
            'short': 'Short',
            'medium': 'Medium',
            'detailed': 'Detailed'
          };
          summaryLength.textContent = lengthMap[settings.summaryLength] || 'Medium';
        }
      }
      resolve();
    });
  });
}

// Apply theme based on user preference
function applyTheme() {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
    const isDarkMode = settings && settings.darkMode;
    
    // Apply dark theme if enabled
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
      lightModeIcon.style.display = 'none';
      darkModeIcon.style.display = 'block';
    } else {
      document.body.classList.remove('dark-theme');
      lightModeIcon.style.display = 'block';
      darkModeIcon.style.display = 'none';
    }
  });
}

// Toggle theme between light and dark
function toggleTheme() {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
    const currentTheme = settings && settings.darkMode;
    const newTheme = !currentTheme;
    
    // Save new theme preference
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { darkMode: newTheme }
    }, () => {
      // Apply new theme
      applyTheme();
      
      // Dispatch theme changed event
      document.dispatchEvent(new CustomEvent('themeChanged'));
    });
  });
}

// Fetch video information from YouTube API
async function fetchVideoInfo() {
  // Set initial thumbnail from ID
  thumbnailImg.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  
  try {
    // Fetch video details from YouTube's oEmbed endpoint (no API key needed)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedResponse = await fetch(oembedUrl);
    
    if (!oembedResponse.ok) {
      throw new Error('Failed to fetch video info');
    }
    
    const oembedData = await oembedResponse.json();
    
    // Update basic info from oembed
    videoTitle.textContent = oembedData.title;
    channelName.textContent = oembedData.author_name;
    
    // Store title
    videoData.title = oembedData.title;
    
    // Try to get view count from page scraping or use placeholder
    videoStats.textContent = 'YouTube Video';
    
  } catch (error) {
    console.error('Error fetching video info:', error);
    videoTitle.textContent = 'Error loading video information';
  }
}

// Format date to readable string
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Verify if YouTube API key is valid
async function verifyYouTubeApiKey(apiKey) {
  try {
    // Use a simple endpoint to check if the key is valid - videos.list requires fewer permissions
    const testUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=${apiKey}`;
    const response = await fetch(testUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('YouTube API key validation failed:', errorData);
      return {
        valid: false,
        error: errorData.error?.message || `Error: ${response.status} ${response.statusText}`
      };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('YouTube API key validation error:', error);
    return {
      valid: false,
      error: error.message || 'Network error while validating API key'
    };
  }
}

// Fetch video transcript 
async function fetchTranscript() {
  try {
    // Get settings to retrieve YouTube API key
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, async (settings) => {
        // Create loading state for transcript
        summaryContent.innerHTML = `
          <div class="loading">
            <div class="spinner"></div>
            <p>Fetching transcript...</p>
          </div>
        `;
        
        try {
          // Try the player-based method first - works with auto-generated captions
          const transcript = await getTranscriptUsingPlayerApi(videoId);
          if (transcript) {
            videoData.transcript = transcript;
            resolve();
            return;
          }
          
          // Try innertube API as backup
          const innertubeTranscript = await getTranscriptFromInnertube(videoId);
          if (innertubeTranscript) {
            videoData.transcript = innertubeTranscript;
            resolve();
            return;
          }
          
          // Try timedtext API as a last resort
          const timedTextTranscript = await getTranscriptFromTimedText(videoId);
          if (timedTextTranscript) {
            videoData.transcript = timedTextTranscript;
            resolve();
            return;
          }
          
          // If we got here, we couldn't get the transcript through any method
          videoData.transcript = "No transcript available for this video. This video may not have closed captions, or they may be disabled.";
          summaryContent.innerHTML = `
            <p>No transcript available for this video.</p>
            <p>This video may not have captions available, or they might be disabled by the creator.</p>
            <p>Try watching the video directly instead.</p>
            <button id="watchVideoNow" class="primary-button">Watch Video</button>
          `;
          
          document.getElementById('watchVideoNow')?.addEventListener('click', () => {
            chrome.runtime.sendMessage(
              { action: 'bypassRedirect', videoId: videoData.videoId },
              () => {
                window.location.href = `https://www.youtube.com/watch?v=${videoData.videoId}`;
              }
            );
          });
          
        } catch (error) {
          console.error('Error fetching transcript:', error);
          
          videoData.transcript = `Error fetching transcript: ${error.message}. Please try again later.`;
          summaryContent.innerHTML = `
            <p>Error fetching transcript: ${error.message}</p>
            <p>You can try watching the original video instead.</p>
            <button id="watchVideoNow" class="primary-button">Watch Video</button>
          `;
          
          document.getElementById('watchVideoNow')?.addEventListener('click', () => {
            chrome.runtime.sendMessage(
              { action: 'bypassRedirect', videoId: videoData.videoId },
              () => {
                window.location.href = `https://www.youtube.com/watch?v=${videoData.videoId}`;
              }
            );
          });
        }
        
        resolve();
      });
    });
  } catch (error) {
    console.error('Error in fetchTranscript:', error);
    videoData.transcript = "Error fetching transcript.";
  }
}

// Get transcript using YouTube's player API - works with auto-generated captions
async function getTranscriptUsingPlayerApi(videoId) {
  try {
    // Fetch the video page
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoPageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!videoPageResponse.ok) {
      throw new Error('Failed to fetch video page');
    }
    
    const videoPageHtml = await videoPageResponse.text();
    
    // Use a more precise regex to extract ytInitialPlayerResponse
    const YT_INITIAL_PLAYER_RESPONSE_RE = /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/;
    const playerResponseMatch = videoPageHtml.match(YT_INITIAL_PLAYER_RESPONSE_RE);
    
    if (!playerResponseMatch) {
      console.error('Unable to parse playerResponse from YouTube page');
      return null;
    }
    
    // Parse the player response
    const playerResponse = JSON.parse(playerResponseMatch[1]);
    
    // Check if captions exist
    if (!playerResponse.captions || 
        !playerResponse.captions.playerCaptionsTracklistRenderer || 
        !playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks ||
        playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks.length === 0) {
      console.log('No caption tracks found in player response');
      return null;
    }
    
    // Get the tracks and sort them by priority
    const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
    tracks.sort(compareTracks);
    
    // Get the transcript from the first (highest priority) track
    const captionUrl = tracks[0].baseUrl + '&fmt=json3';
    
    // Fetch captions
    const captionsResponse = await fetch(captionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!captionsResponse.ok) {
      console.error('Failed to fetch captions data');
      return null;
    }
    
    const captionsData = await captionsResponse.json();
    
    // Check if we have events (caption data)
    if (!captionsData.events || captionsData.events.length === 0) {
      return null;
    }
    
    // Process the transcript
    const parsedTranscript = captionsData.events
      // Remove invalid segments
      .filter(x => x.segs)
      // Concatenate into single long string
      .map(x => x.segs
        .map(y => y.utf8)
        .join(' ')
      )
      .join(' ')
      // Remove invalid characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Replace any whitespace with a single space
      .replace(/\s+/g, ' ');
    
    return parsedTranscript.trim();
    
  } catch (error) {
    console.error('Error in getTranscriptUsingPlayerApi:', error);
    return null;
  }
}

// Helper function to sort caption tracks by priority
function compareTracks(track1, track2) {
  const langCode1 = track1.languageCode;
  const langCode2 = track2.languageCode;

  if (langCode1 === 'en' && langCode2 !== 'en') {
    return -1; // English comes first
  } else if (langCode1 !== 'en' && langCode2 === 'en') {
    return 1; // English comes first
  } else if (track1.kind !== 'asr' && track2.kind === 'asr') {
    return -1; // Non-ASR (manual captions) come first
  } else if (track1.kind === 'asr' && track2.kind !== 'asr') {
    return 1; // Non-ASR (manual captions) come first
  }

  return 0; // Preserve order if both have same priority
}

// Use YouTube's innertube API to get transcript data
async function getTranscriptFromInnertube(videoId) {
  try {
    // First get the transcript list to find available languages
    const data = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20210721.00.00"
        }
      },
      params: btoa(JSON.stringify({ videoId: videoId }))
    };

    const response = await fetch("https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const transcriptData = await response.json();
    
    // Check if we have transcript items
    if (!transcriptData.actions || 
        !transcriptData.actions[0].updateEngagementPanelAction ||
        !transcriptData.actions[0].updateEngagementPanelAction.content ||
        !transcriptData.actions[0].updateEngagementPanelAction.content.transcriptRenderer ||
        !transcriptData.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body ||
        !transcriptData.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer ||
        !transcriptData.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups) {
      return null;
    }

    // Extract all transcript segments
    const cueGroups = transcriptData.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups;
    const transcriptSegments = [];

    for (const cueGroup of cueGroups) {
      if (cueGroup.transcriptCueGroupRenderer && cueGroup.transcriptCueGroupRenderer.cues) {
        for (const cue of cueGroup.transcriptCueGroupRenderer.cues) {
          if (cue.transcriptCueRenderer && cue.transcriptCueRenderer.cue) {
            const text = cue.transcriptCueRenderer.cue.simpleText || "";
            transcriptSegments.push(text);
          }
        }
      }
    }

    if (transcriptSegments.length === 0) {
      return null;
    }

    return transcriptSegments.join(' ');
  } catch (error) {
    console.error("Error fetching transcript from innertube:", error);
    return null;
  }
}

// Use timedtext API as a last resort
async function getTranscriptFromTimedText(videoId) {
  try {
    // Try to get transcript via the timedtext API (doesn't require API key)
    // First try with English language
    const enUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
    const enResponse = await fetch(enUrl);
    const enText = await enResponse.text();

    if (enText && enText.includes('<text')) {
      return processTimedText(enText);
    }
    
    // Try auto-detect language
    const autoUrl = `https://www.youtube.com/api/timedtext?v=${videoId}`;
    const autoResponse = await fetch(autoUrl);
    const autoText = await autoResponse.text();
    
    if (autoText && autoText.includes('<text')) {
      return processTimedText(autoText);
    }
    
    // If that fails, try to get a list of available languages
    const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
    const listResponse = await fetch(listUrl);
    const listText = await listResponse.text();
    
    if (!listText || !listText.includes('lang_code')) {
      return null;
    }
    
    // Find the first language in the list
    const langCodeMatch = listText.match(/lang_code="([^"]+)"/);
    if (!langCodeMatch) {
      return null;
    }
    
    // Try to get transcript with the first available language
    const langUrl = `https://www.youtube.com/api/timedtext?lang=${langCodeMatch[1]}&v=${videoId}`;
    const langResponse = await fetch(langUrl);
    const langText = await langResponse.text();
    
    if (langText && langText.includes('<text')) {
      return processTimedText(langText);
    }
    
    return null;
  } catch (error) {
    console.error("Error in transcript fallback:", error);
    return null;
  }
}

// Process XML timedtext response
function processTimedText(xmlText) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const textNodes = xmlDoc.getElementsByTagName("text");
    
    if (textNodes.length === 0) return null;
    
    const transcriptArray = Array.from(textNodes).map(node => {
      // Decode HTML entities in the text content
      const div = document.createElement('div');
      div.innerHTML = node.textContent;
      return div.textContent.trim();
    });
    
    return transcriptArray.join(' ');
  } catch (error) {
    console.error("Error processing timed text:", error);
    return null;
  }
}

// Verify if Gemini API key is valid
async function verifyGeminiApiKey(apiKey) {
  try {
    // Use a simple prompt to check if the key is valid
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Hello, can you respond with just the word "valid" to verify this API key works?'
          }]
        }]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API key validation failed:', errorData);
      return {
        valid: false,
        error: `Error ${response.status}: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      return {
        valid: false,
        error: 'No response from Gemini API'
      };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Gemini API key validation error:', error);
    return {
      valid: false,
      error: error.message || 'Network error while validating API key'
    };
  }
}

// Format summary content with markdown conversion
function formatSummaryContent(content) {
  if (!content) return '';
  
  // Apply same markdown formatting as chat
  return markdownToHtml(content);
}

// Send question to Gemini API
sendQuestion.addEventListener('click', async () => {
  const question = userQuestion.value.trim();
  if (!question) return;
  
  // Add user question to chat
  addChatMessage('user', question);
  userQuestion.value = '';
  
  // Add loading message with separate ID
  const loadingId = addChatMessage('assistant', '<div class="loading"><div class="spinner"></div></div>');
  
  // First check if we have a transcript at all
  if (!videoData.transcript || 
      videoData.transcript.includes("No transcript available") || 
      videoData.transcript.includes("Error fetching transcript")) {
    updateChatMessage(loadingId, 'I cannot answer questions about this video because there is no transcript available.');
    return;
  }
  
  // Get settings
  chrome.runtime.sendMessage({ action: 'getSettings' }, async (settings) => {
    const apiKey = settings?.apiKey;
    
    if (!apiKey) {
      updateChatMessage(loadingId, 'Please set your Gemini API key in the extension settings to ask questions.');
      return;
    }
    
    try {
      // Call Gemini API with the question and transcript context
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `The following is a transcript from a YouTube video titled "${videoData.title}":\n\n${videoData.transcript}\n\nBased only on the information in this transcript, please answer the following question. If the information is not in the transcript, say you don't have that information: ${question}`
            }]
          }]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from Gemini API:', errorText);
        throw new Error(`API error ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated by Gemini API. This might be due to content safety filters or API limitations.');
      }
      
      const answer = data.candidates[0].content.parts[0].text;
      
      // Create a new message element instead of updating the existing one
      // This ensures we don't modify the original message
      updateChatMessage(loadingId, answer);
    } catch (error) {
      console.error('Error from Gemini API:', error);
      if (error.message.includes('403') || error.message.includes('401')) {
        updateChatMessage(loadingId, `Error: Your Gemini API key might be invalid or has expired. Please check your API key in settings.`);
      } else if (error.message.includes('429')) {
        updateChatMessage(loadingId, `Error: Rate limit exceeded. You've made too many requests to the Gemini API. Please try again later.`);
      } else {
        updateChatMessage(loadingId, `Error: ${error.message}. Please try again later.`);
      }
    }
  });
});

// Apply markdown formatting to the summary when displaying it
async function generateSummary() {
  try {
    // Check if we have a transcript first
    if (!videoData.transcript || 
        videoData.transcript.includes("No transcript available") || 
        videoData.transcript.includes("Error fetching transcript")) {
      // If we've already shown an error message from the transcript function, don't try to summarize
      console.log("Not attempting to generate summary due to transcript issues");
      return;
    }
    
    // Get user preferences
    chrome.runtime.sendMessage({ action: 'getSettings' }, async (settings) => {
      const apiKey = settings?.apiKey;
      const tone = settings?.summaryTone || 'professional';
      const length = settings?.summaryLength || 'medium';
      
      // Create loading state
      summaryContent.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Generating summary...</p>
        </div>
      `;
      
      // Check if we have an API key
      if (!apiKey) {
        summaryContent.innerHTML = `
          <p>Please set your Gemini API key in the extension settings to generate summaries.</p>
          <button id="openSettings" class="secondary-button">Open Settings</button>
        `;
        
        document.getElementById('openSettings').addEventListener('click', () => {
          chrome.runtime.openOptionsPage();
        });
        
        return;
      }
      
      // Verify the Gemini API key
      const keyVerification = await verifyGeminiApiKey(apiKey);
      if (!keyVerification.valid) {
        summaryContent.innerHTML = `
          <p>Your Gemini API key appears to be invalid: ${keyVerification.error}</p>
          <p>Please check your API key in the extension settings.</p>
          <button id="openSettings" class="secondary-button">Open Settings</button>
        `;
        
        document.getElementById('openSettings').addEventListener('click', () => {
          chrome.runtime.openOptionsPage();
        });
        
        return;
      }
      
      // Call Gemini API
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Please summarize the following YouTube video transcript in a ${tone} tone with ${length} length.\n\nVideo Title: ${videoData.title}\n\nTranscript: ${videoData.transcript}`
              }]
            }]
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response from Gemini API:', errorText);
          throw new Error(`API error ${response.status}: ${errorText || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error('No response from Gemini API. This might be due to content safety filters or API limitations.');
        }
        
        const summary = data.candidates[0].content.parts[0].text;
        
        // Apply markdown formatting to summary
        const formattedSummary = formatSummaryContent(summary);
        
        // Update UI with summary
        summaryContent.innerHTML = formattedSummary;
        
        // Store summary
        videoData.summary = formattedSummary;
        
        // Show chat container once we have a summary
        chatContainer.classList.remove('hidden');
      } catch (error) {
        console.error('Error from Gemini API:', error);
        summaryContent.innerHTML = `
          <p>Error generating summary: ${error.message}</p>
          <p>You can try watching the original video instead.</p>
          <button id="watchVideoError" class="primary-button">Watch Video</button>
        `;
        
        document.getElementById('watchVideoError')?.addEventListener('click', () => {
          chrome.runtime.sendMessage(
            { action: 'bypassRedirect', videoId: videoData.videoId },
            () => {
              window.location.href = `https://www.youtube.com/watch?v=${videoData.videoId}`;
            }
          );
        });
      }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    summaryContent.innerHTML = '<p>Error generating summary. Please try again later.</p>';
  }
}

// Set up event listeners
function setupEventListeners() {
  // Theme toggle
  themeToggle.addEventListener('click', () => {
    toggleTheme();
  });
  
  // Watch video button
  watchVideoBtn.addEventListener('click', () => {
    confirmDialog.style.display = 'flex';
    confirmDialog.classList.remove('hidden');
  });
  
  // Confirm watch - Fixed to properly redirect to YouTube without looping
  confirmWatch.addEventListener('click', () => {
    confirmDialog.style.display = 'none';
    confirmDialog.classList.add('hidden');
    
    // Add to bypass list before navigating
    chrome.runtime.sendMessage(
      { action: 'bypassRedirect', videoId: videoData.videoId },
      () => {
        // Navigate to YouTube after adding to bypass list
        window.location.href = `https://www.youtube.com/watch?v=${videoData.videoId}`;
      }
    );
  });
  
  // Cancel watch - Fixed to properly hide the dialog
  cancelWatch.addEventListener('click', () => {
    confirmDialog.style.display = 'none';
    confirmDialog.classList.add('hidden');
  });
  
  // Close dialog when clicking outside of it
  confirmDialog.addEventListener('click', (e) => {
    if (e.target === confirmDialog) {
      confirmDialog.style.display = 'none';
      confirmDialog.classList.add('hidden');
    }
  });
  
  // Copy summary button
  copyBtn.addEventListener('click', () => {
    // Remove HTML tags for plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = videoData.summary;
    const plainText = tempDiv.textContent || tempDiv.innerText;
    
    navigator.clipboard.writeText(plainText).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1500);
    });
  });
  
  // Submit question on Enter key
  userQuestion.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendQuestion.click();
    }
  });
  
  // Theme toggle
  document.addEventListener('themeChanged', () => {
    applyTheme();
  });
}

// Convert markdown to HTML for better chat formatting
function markdownToHtml(text) {
  if (!text) return '';
  
  // Handle code blocks with triple backticks
  text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Handle inline code with single backticks
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Handle bold with double asterisks or double underscores
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Handle italic with single asterisk or single underscore
  text = text.replace(/\*([^\s*].*?[^\s*])\*/g, '<em>$1</em>');
  text = text.replace(/_([^\s_].*?[^\s_])_/g, '<em>$1</em>');
  
  // Handle strikethrough
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
  
  // Handle bullet lists
  text = text.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
  
  // Handle numbered lists
  text = text.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<li>$2</li>');
  text = text.replace(/(<li>.*?<\/li>)/gs, '<ol>$1</ol>');
  
  // Handle links
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Handle headers
  text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Handle paragraphs
  text = text.replace(/\n\n/g, '<br><br>');
  
  return text;
}

// Update a chat message by ID
function updateChatMessage(messageId, content) {
  const messageEl = document.getElementById(messageId);
  if (messageEl) {
    // Format markdown to HTML
    const formattedContent = markdownToHtml(content);
    messageEl.innerHTML = formattedContent;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Add a message to the chat
function addChatMessage(role, content) {
  const messageId = 'msg-' + Date.now();
  const messageEl = document.createElement('div');
  messageEl.id = messageId;
  messageEl.className = `message ${role}-message`;
  
  // For user messages, content is already HTML (typically just text)
  // For assistant messages, we need to check if it's plain text that needs formatting
  if (role === 'assistant' && typeof content === 'string' && !content.includes('<div class="loading">')) {
    messageEl.innerHTML = markdownToHtml(content);
  } else {
    messageEl.innerHTML = content;
  }
  
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageId;
} 