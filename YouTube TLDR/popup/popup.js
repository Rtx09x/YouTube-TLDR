/**
 * YouTube TLDR Extension - Popup JS
 * Handles user interactions with the popup interface
 */

// Verify Gemini API key
async function verifyGeminiApiKey(apiKey) {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Hello, respond with just the word "valid" to verify this API key works.'
          }]
        }]
      })
    });
    
    if (!response.ok) {
      return { valid: false, error: `Error ${response.status}: ${response.statusText}` };
    }
    
    const data = await response.json();
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Get UI elements
  const enableToggle = document.getElementById('enableToggle');
  const statusText = document.getElementById('statusText');
  const summaryTone = document.getElementById('summaryTone');
  const summaryLength = document.getElementById('summaryLength');
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKey = document.getElementById('saveApiKey');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const verifyApiKeys = document.getElementById('verifyApiKeys');
  const verificationResult = document.getElementById('verificationResult');
  
  // Load saved settings
  chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
    // Set toggle state
    if (settings && settings.enabledStatus !== undefined) {
      enableToggle.checked = settings.enabledStatus;
      statusText.textContent = settings.enabledStatus ? 'Enabled' : 'Disabled';
    } else {
      // Default to enabled if no setting exists
      chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { enabledStatus: true }
      });
    }
    
    // Set tone dropdown
    if (settings && settings.summaryTone) {
      summaryTone.value = settings.summaryTone;
    }
    
    // Set length dropdown
    if (settings && settings.summaryLength) {
      summaryLength.value = settings.summaryLength;
    }
    
    // Set Gemini API key (if exists)
    if (settings && settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
      // Show just asterisks
      apiKeyInput.placeholder = '******************';
    }
    
    // Set dark mode toggle
    if (settings && settings.darkMode) {
      darkModeToggle.checked = settings.darkMode;
      applyTheme(settings.darkMode);
    }
  });
  
  // Enable/disable toggle
  enableToggle.addEventListener('change', () => {
    const isEnabled = enableToggle.checked;
    statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
    
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { enabledStatus: isEnabled }
    });
  });
  
  // Save summary tone preference
  summaryTone.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { summaryTone: summaryTone.value }
    });
  });
  
  // Save summary length preference
  summaryLength.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { summaryLength: summaryLength.value }
    });
  });
  
  // Dark mode toggle
  darkModeToggle.addEventListener('change', () => {
    const isDarkMode = darkModeToggle.checked;
    
    chrome.runtime.sendMessage({
      action: 'saveSettings',
      settings: { darkMode: isDarkMode }
    });
    
    // Apply theme
    applyTheme(isDarkMode);
  });
  
  // Apply theme based on dark mode setting
  function applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
  
  // Save Gemini API key
  saveApiKey.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (apiKey) {
      chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: { apiKey }
      }, () => {
        // Indicate success
        saveApiKey.textContent = 'Saved!';
        saveApiKey.style.backgroundColor = 'var(--success)';
        
        setTimeout(() => {
          saveApiKey.textContent = 'Save';
          saveApiKey.style.backgroundColor = '';
        }, 1500);
      });
    }
  });
  
  // Verify API Key
  verifyApiKeys.addEventListener('click', async () => {
    // Show loading state
    verificationResult.textContent = 'Verifying API key...';
    verificationResult.className = 'verification-result loading';
    
    // Get current API key
    chrome.runtime.sendMessage({ action: 'getSettings' }, async (settings) => {
      const geminiKey = settings?.apiKey;
      
      let results = [];
      
      // Verify Gemini API key
      if (geminiKey) {
        const geminiResult = await verifyGeminiApiKey(geminiKey);
        if (geminiResult.valid) {
          results.push('✅ Gemini API key is valid');
        } else {
          results.push(`❌ Gemini API key error: ${geminiResult.error}`);
        }
      } else {
        results.push('⚠️ Gemini API key not set');
      }
      
      // Display results
      verificationResult.innerHTML = results.join('<br>');
      verificationResult.className = 'verification-result';
    });
  });
}); 