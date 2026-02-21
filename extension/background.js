// Background service worker
// Handles messages from content script and manages side panel

// The deployed Next.js app URL -- update this after deploying
const APP_URL = "https://your-app.vercel.app";

// Convex HTTP endpoint -- update after setup
const CONVEX_HTTP_URL = "https://your-deployment.convex.site";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CANVAS_PAGE_DETECTED") {
    // Store the page info for later use
    chrome.storage.local.set({
      currentCanvasPage: message.data,
    });
  }

  if (message.type === "OPEN_SIDE_PANEL") {
    handleOpenSidePanel(message.data, sender.tab?.id);
  }

  return true;
});

async function handleOpenSidePanel(data, tabId) {
  // Get stored Canvas token
  const stored = await chrome.storage.local.get(["canvasToken"]);
  const token = stored.canvasToken;

  if (!token) {
    // Open popup to ask for token
    if (tabId) {
      chrome.sidePanel.open({ tabId });
    }
    return;
  }

  if (data.itemType && (data.itemId || data.pageUrl)) {
    try {
      // Call Convex HTTP endpoint to fetch + store content
      const res = await fetch(`${CONVEX_HTTP_URL}/api/connect-canvas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: data.domain,
          token: token,
          courseId: data.courseId,
          itemType: data.itemType,
          itemId: data.itemId,
          pageUrl: data.pageUrl,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        // Update side panel URL with materialId
        chrome.sidePanel.setOptions({
          path: `sidepanel.html?materialId=${result.materialId}`,
        });
      }
    } catch (err) {
      console.error("Failed to fetch content:", err);
    }
  }

  // Open side panel
  if (tabId) {
    chrome.sidePanel.open({ tabId });
  }
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
