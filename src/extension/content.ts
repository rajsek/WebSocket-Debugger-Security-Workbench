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
  const overlayId = 'ws-workbench-overlay';
  const listenerMarker = '__wsWorkbenchContentListenersReady';
  const pageWindow = window as unknown as Window & Record<string, boolean | undefined>;

  if (!pageWindow[listenerMarker]) {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (isPageReloadNotice(message)) {
        chrome.runtime.sendMessage({ version: 1, type: 'mark-page-stale', tabId: message.tabId });
      }
    });

    window.addEventListener('beforeunload', () => {
      chrome.runtime.sendMessage({ version: 1, type: 'mark-page-stale', tabId: -1 });
    });

    pageWindow[listenerMarker] = true;
  }

  const existing = document.getElementById(overlayId);
  if (existing) {
    requestOverlayClose(existing);
    return;
  }

  const root = document.createElement('div');
  root.id = overlayId;
  applyOverlayPanelStyles(root);
  setInitialOverlayGeometry(root);
  const { toolbar, controls, title } = createOverlayToolbar('WebSocket Workbench');

  const close = createTrafficLightButton('Close overlay', '×', '#ff5f57', '#7f1d1d');

  const minimize = createTrafficLightButton('Minimize overlay', '−', '#febc2e', '#7c4a03');

  const fit = createTrafficLightButton('Fit overlay to page', '+', '#28c840', '#14532d');

  controls.append(close, minimize, fit);
  toolbar.append(controls, title);

  const iframe = document.createElement('iframe');
  iframe.title = 'WebSocket Workbench overlay';
  iframe.src = chrome.runtime.getURL('sidepanel.html');
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.style.height = 'calc(100% - 34px)';
  iframe.style.width = '100%';

  const closeOverlay = installOverlayClose(root, () => {
    iframe.src = 'about:blank';
  });
  close.addEventListener('click', closeOverlay);

  root.append(toolbar, iframe);
  document.documentElement.append(root);
  const resize = installOverlayResize(root, root);
  installOverlayDrag(root, toolbar, controls);
  minimize.addEventListener('click', () => toggleOverlayMinimize(root, iframe, toolbar, resize));
  fit.addEventListener('click', () => fitOverlayToViewport(root, iframe, resize));

  function isPageReloadNotice(value: unknown): value is { tabId: number } {
    return typeof value === 'object' && value !== null && 'tabId' in value && typeof value.tabId === 'number';
  }
})();
