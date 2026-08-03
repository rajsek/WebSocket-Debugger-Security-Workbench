import { setUninstallTrackingUrl, trackFeatureUse, trackPopupOpen, trackPopupClose } from "./analytics";

// The deployed GitHub Pages site serves the feedback page from this path.
const UNINSTALL_FEEDBACK_URL = 'https://rajsek.github.io/WebSocket-Debugger-Security-Workbench/docs/uninstall.html';

async function configureUninstallFeedback(): Promise<void> {
  try {
    await setUninstallTrackingUrl(UNINSTALL_FEEDBACK_URL);
    console.info('[ws-workbench] uninstall feedback URL configured');
  } catch (error) {
    console.warn('[ws-workbench] failed to configure uninstall feedback URL', error);
  }
}

// The service worker can start long after installation. Configure at startup so
// existing installations gain the uninstall path after an extension reload too.
void configureUninstallFeedback();
chrome.runtime.onInstalled.addListener(() => {
  void configureUninstallFeedback();
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
