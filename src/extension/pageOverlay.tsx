import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import appStyles from '../ui/styles.css?inline';
import {
  applyOverlayPanelStyles,
  createOverlayToolbar,
  createTrafficLightButton,
  fitOverlayToViewport,
  installOverlayClose,
  installOverlayDrag,
  installOverlayResize,
  requestOverlayClose,
  setInitialOverlayGeometry,
  toggleOverlayMinimize,
} from './overlayWindow';

(() => {
  const overlayId = 'ws-workbench-page-overlay';
  const extensionContext = (window as Window & { __wsWorkbenchExtensionContext?: { tabId?: number } }).__wsWorkbenchExtensionContext;
  const existing = document.getElementById(overlayId);
  if (existing) {
    requestOverlayClose(existing);
    return;
  }

  const host = document.createElement('div');
  host.id = overlayId;
  applyOverlayPanelStyles(host);
  setInitialOverlayGeometry(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    ${appStyles}
    :host {
      background: #0b1120;
      color-scheme: dark;
      display: block;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-style: normal;
      font-weight: 400;
      height: 100%;
      letter-spacing: 0;
      line-height: 1.35;
      text-align: left;
      width: 100%;
    }
    .overlay-shell {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      height: 100%;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
      position: relative;
      width: 100%;
    }
    #root {
      background: #0b1120;
      color: #d7dee8;
      font-family: inherit;
      font-size: 13px;
      height: 100%;
      line-height: 1.35;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }
    .app-shell {
      background: #0b1120;
      color: #d7dee8;
      height: 100%;
    }
    button,
    input,
    select,
    textarea {
      font-family: inherit;
      font-size: 13px;
      line-height: 1.25;
    }
    .label,
    .frame-time,
    .target-context span,
    .evidence-list span {
      font-size: 11px;
    }
  `;

  const { toolbar, controls, title } = createOverlayToolbar('WebSocket Workbench');

  const close = createTrafficLightButton('Close direct page overlay', '×', '#ff5f57', '#7f1d1d');

  const minimize = createTrafficLightButton('Minimize direct page overlay', '−', '#febc2e', '#7c4a03');

  const fit = createTrafficLightButton('Fit direct page overlay to page', '+', '#28c840', '#14532d');

  const mount = document.createElement('div');
  mount.id = 'root';
  const shell = document.createElement('div');
  shell.className = 'overlay-shell';
  let reactRoot: ReturnType<typeof createRoot> | null = null;
  const closeOverlay = installOverlayClose(host, () => {
    reactRoot?.unmount();
  });

  controls.append(close, minimize, fit);
  toolbar.append(controls, title);
  shell.append(toolbar, mount);
  shadow.append(style, shell);
  document.documentElement.append(host);
  const resize = installOverlayResize(host, shell);
  installOverlayDrag(host, toolbar, controls);
  close.addEventListener('click', closeOverlay);
  minimize.addEventListener('click', () => toggleOverlayMinimize(host, mount, toolbar, resize));
  fit.addEventListener('click', () => fitOverlayToViewport(host, mount, resize));

  reactRoot = createRoot(mount);
  reactRoot.render(
    <React.StrictMode>
      <App
        surface="page-overlay"
        transport="page"
        loadTabContext={async () => ({
          tabId: typeof extensionContext?.tabId === 'number' ? extensionContext.tabId : null,
          origin: window.location.origin,
        })}
      />
    </React.StrictMode>,
  );

})();
