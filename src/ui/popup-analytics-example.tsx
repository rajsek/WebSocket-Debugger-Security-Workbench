import React, { useEffect } from "react";

export default function PopupAnalyticsExample() {
  useEffect(() => {
    // Notify background that popup opened
    chrome.runtime.sendMessage({ action: "trackPopupOpen" });
    return () => {
      // Notify background that popup closed
      chrome.runtime.sendMessage({ action: "trackPopupClose" });
    };
  }, []);

  function onUseFeature() {
    chrome.runtime.sendMessage({ action: "trackFeatureUse", featureName: "connect_live_socket", extra: { protocol: "wss" } });
  }

  return (
    <div style={{ padding: 12 }}>
      <h3>Analytics Example</h3>
      <button onClick={onUseFeature}>Use feature (track)</button>
    </div>
  );
}
