import React from 'react';
import { createRoot } from 'react-dom/client';
import { Globe2, PanelRightOpen, PictureInPicture2 } from 'lucide-react';
import { useState } from 'react';
import { getActiveTabContext, injectOverlay, injectPageOverlay, openWorkbenchSidePanel } from '../extension/chromeAdapter';
import './styles.css';

function Launcher() {
  const [error, setError] = useState<string | null>(null);

  async function openSidePanel() {
    try {
      await openWorkbenchSidePanel();
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
