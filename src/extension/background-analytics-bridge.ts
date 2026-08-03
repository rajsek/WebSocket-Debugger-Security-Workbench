import { setUninstallTrackingUrl, trackFeatureUse, trackPopupOpen, trackPopupClose } from "./analytics";

// Set uninstall URL on install. Using GitHub Pages uninstall feedback page.
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await setUninstallTrackingUrl("https://rajsek.github.io/WebSocket-Debugger-Security-Workbench/docs/uninstall.html");
    console.log("Uninstall tracking URL set to GitHub Pages uninstall page");
  } catch (e) {
    console.warn("Failed to set uninstall URL", e);
  }
});

// Message-based bridge so UI pages (popup/options) can ask the background to record events.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || typeof message.action !== "string") return;
      switch (message.action) {
        case "trackPopupOpen":
          await trackPopupOpen();
          break;
        case "trackPopupClose":
          await trackPopupClose();
          break;
        case "trackFeatureUse":
          await trackFeatureUse(message.featureName || "unknown", message.extra || {});
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("bridge handler error", e);
    }
  })();
  // async response not required
  return false;
});
