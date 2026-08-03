import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Globe2, PanelRightOpen, PictureInPicture2 } from 'lucide-react';
import { getActiveTabContext, injectOverlay, injectPageOverlay, openWorkbenchSidePanel } from '../extension/chromeAdapter';
import './styles.css';
import { recordUseOccurrence, shouldShowPrompt, notePromptShown, setDontAskAgain } from '../extension/feedbackPrompt';

function FeedbackPromptModal({ onClose }: { onClose: () => void }) {
  const storeUrl = `https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID`;

  async function sendTelemetry(response: string) {
    try {
      chrome.runtime.sendMessage({ action: 'trackFeatureUse', featureName: 'feedback_prompt_response', extra: { choice: response } });
    } catch (e) {}
  }

  async function handleRateNow() {
    await sendTelemetry('rate');
    await notePromptShown();
    await setDontAskAgain();
    chrome.tabs.create({ url: storeUrl });
    onClose();
  }

  async function handleFeedback() {
    await sendTelemetry('feedback');
    await notePromptShown();
    await setDontAskAgain();
    chrome.tabs.create({ url: 'https://github.com/rajsek/WebSocket-Debugger-Security-Workbench/issues/new' });
    onClose();
  }

  async function handleLater() {
    await sendTelemetry('later');
    await notePromptShown();
    onClose();
  }

  async function handleNever() {
    await sendTelemetry('never');
    await setDontAskAgain();
    await notePromptShown();
    onClose();
  }

  return (
    <div className="feedback-modal" style={{ position: 'fixed', bottom: 12, left: 12, right: 12, background: '#fff', border: '1px solid #e6e6e6', padding: 12, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>Help improve WebSocket Workbench</strong>
          <div style={{ fontSize: 13, color: '#555' }}>Would you be willing to rate the extension or share feedback? We'll only ask a couple times.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRateNow} className="btn">Rate</button>
          <button onClick={handleFeedback} className="btn" style={{ background: '#6c757d' }}>Feedback</button>
          <button onClick={handleLater} className="btn" style={{ background: '#e2e6ea', color: '#000' }}>Later</button>
          <button onClick={handleNever} className="btn" style={{ background: '#fff', border: '1px solid #ddd' }}>Don't ask</button>
        </div>
      </div>
    </div>
  );
}

function Launcher() {
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await recordUseOccurrence();
        if (await shouldShowPrompt()) {
          // notify analytics a prompt will be shown
          try { chrome.runtime.sendMessage({ action: 'trackFeatureUse', featureName: 'feedback_prompt_shown' }); } catch (e) {}
          setShowPrompt(true);
        }
      } catch (e) {
        // ignore
      }

      try {
        chrome.runtime.sendMessage({ action: 'trackPopupOpen' });
      } catch (e) {}

      return () => {
        try {
          chrome.runtime.sendMessage({ action: 'trackPopupClose' });
        } catch (e) {}
      };
    })();
  }, []);

  async function openSidePanel() {
    try {
      await openWorkbenchSidePanel();
      try {
        chrome.runtime.sendMessage({ action: 'trackFeatureUse', featureName: 'open_side_panel', extra: {} });
      } catch (e) {}
      window.close();
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  async function openOverlay() {
    try {
      const context = await getActiveTabContext();
      if (context.tabId === null) throw new Error('No active tab is available.');
      await injectOverlay(context.tabId);
      try {
        chrome.runtime.sendMessage({ action: 'trackFeatureUse', featureName: 'inject_iframe_overlay', extra: { tabId: context.tabId } });
      } catch (e) {}
      window.close();
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  async function openPageOverlay() {
    try {
      const context = await getActiveTabContext();
      if (context.tabId === null) throw new Error('No active tab is available.');
      await injectPageOverlay(context.tabId);
      try {
        chrome.runtime.sendMessage({ action: 'trackFeatureUse', featureName: 'inject_page_overlay', extra: { tabId: context.tabId } });
      } catch (e) {}
      window.close();
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  return (
    <main className="launcher">
      <h1>WebSocket Workbench</h1>
      <button type="button" onClick={openSidePanel}>
        <PanelRightOpen size={16} /> Side Panel
      </button>
      <button type="button" onClick={openOverlay}>
        <PictureInPicture2 size={16} /> Iframe Overlay
      </button>
      <button type="button" onClick={openPageOverlay}>
        <Globe2 size={16} /> Direct Page Overlay
      </button>
      {error ? <p className="error-line">{error}</p> : null}

      {showPrompt ? <FeedbackPromptModal onClose={() => setShowPrompt(false)} /> : null}
    </main>
  );
}

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return 'Unable to open the selected surface.';
  return `${error.message} Make sure the extension is reloaded from chrome://extensions and Chrome supports Side Panel extensions.`;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Launcher />
  </React.StrictMode>,
);
