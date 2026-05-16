const viewportMargin = 12;
const minimumOverlayWidth = 320;
const minimumOverlayHeight = 360;
const minimumVisibleWidth = 80;
const minimumVisibleHeight = 40;

export interface OverlayResizeController {
  setEnabled: (enabled: boolean) => void;
}

const overlayCloseEvent = 'ws-workbench-overlay-close';

export function installOverlayClose(panel: HTMLElement, cleanup: () => void = () => undefined): () => void {
  let closed = false;

  const closePanel = () => {
    if (closed) return;
    closed = true;
    try {
      cleanup();
    } finally {
      panel.remove();
    }
  };

  panel.addEventListener(overlayCloseEvent, closePanel);
  return closePanel;
}

export function requestOverlayClose(panel: Element): void {
  panel.dispatchEvent(new Event(overlayCloseEvent));
  if (panel.isConnected) panel.remove();
}

export function applyOverlayPanelStyles(panel: HTMLElement): void {
  panel.style.position = 'fixed';
  panel.style.zIndex = '2147483647';
  panel.style.minWidth = `${minimumOverlayWidth}px`;
  panel.style.minHeight = `${minimumOverlayHeight}px`;
  panel.style.maxWidth = `calc(100vw - ${viewportMargin * 2}px)`;
  panel.style.maxHeight = `calc(100vh - ${viewportMargin * 2}px)`;
  panel.style.border = '1px solid #334155';
  panel.style.borderRadius = '8px';
  panel.style.background = '#0f172a';
  panel.style.overflow = 'hidden';
  panel.style.resize = 'none';
  panel.style.boxShadow = '0 12px 32px rgba(15, 23, 42, 0.35)';
}

export function createOverlayToolbar(titleText: string): {
  toolbar: HTMLDivElement;
  controls: HTMLDivElement;
  title: HTMLSpanElement;
} {
  const toolbar = document.createElement('div');
  toolbar.style.alignItems = 'center';
  toolbar.style.background = '#0f172a';
  toolbar.style.color = '#e2e8f0';
  toolbar.style.cursor = 'move';
  toolbar.style.display = 'flex';
  toolbar.style.font = '12px system-ui, sans-serif';
  toolbar.style.gap = '8px';
  toolbar.style.justifyContent = 'flex-start';
  toolbar.style.padding = '8px 10px';
  toolbar.style.userSelect = 'none';

  const controls = document.createElement('div');
  controls.style.alignItems = 'center';
  controls.style.display = 'flex';
  controls.style.gap = '8px';
  controls.style.marginRight = '10px';

  const title = document.createElement('span');
  title.textContent = titleText;
  title.style.flex = '1';
  title.style.overflow = 'hidden';
  title.style.textOverflow = 'ellipsis';
  title.style.whiteSpace = 'nowrap';

  return { toolbar, controls, title };
}

export function createTrafficLightButton(label: string, icon: string, background: string, color: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.style.alignItems = 'center';
  button.style.background = background;
  button.style.border = '0';
  button.style.borderRadius = '999px';
  button.style.color = color;
  button.style.cursor = 'pointer';
  button.style.display = 'inline-flex';
  button.style.flex = '0 0 12px';
  button.style.font = '10px system-ui, sans-serif';
  button.style.fontWeight = '700';
  button.style.height = '12px';
  button.style.justifyContent = 'center';
  button.style.lineHeight = '1';
  button.style.margin = '0';
  button.style.maxHeight = '12px';
  button.style.maxWidth = '12px';
  button.style.minHeight = '12px';
  button.style.minWidth = '12px';
  button.style.padding = '0';
  button.style.textAlign = 'center';
  button.style.width = '12px';

  const symbol = document.createElement('span');
  symbol.textContent = icon;
  symbol.style.display = 'block';
  symbol.style.fontSize = '9px';
  symbol.style.height = '10px';
  symbol.style.lineHeight = '10px';
  symbol.style.opacity = '0';
  symbol.style.transform = 'translateY(-0.5px)';
  symbol.style.transition = 'opacity 100ms ease';
  button.append(symbol);

  button.addEventListener('mouseenter', () => {
    symbol.style.opacity = '1';
  });
  button.addEventListener('mouseleave', () => {
    symbol.style.opacity = '0';
  });
  button.addEventListener('focus', () => {
    symbol.style.opacity = '1';
  });
  button.addEventListener('blur', () => {
    symbol.style.opacity = '0';
  });

  return button;
}

export function installOverlayDrag(panel: HTMLElement, handle: HTMLElement, ignored: HTMLElement): void {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && ignored.contains(event.target)) return;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = panel.offsetLeft;
    startTop = panel.offsetTop;
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) return;
    panel.style.left = `${clamp(startLeft + event.clientX - startX, 0, window.innerWidth - minimumVisibleWidth)}px`;
    panel.style.top = `${clamp(startTop + event.clientY - startY, 0, window.innerHeight - minimumVisibleHeight)}px`;
  });

  const releasePointer = (event: PointerEvent) => {
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };

  handle.addEventListener('pointerup', releasePointer);
  handle.addEventListener('pointercancel', releasePointer);
}

export function installOverlayResize(panel: HTMLElement, handleLayer: HTMLElement): OverlayResizeController {
  const handles = [
    createResizeHandle('right', 'ew-resize'),
    createResizeHandle('bottom', 'ns-resize'),
    createResizeHandle('corner', 'nwse-resize'),
  ];

  handles.forEach((handle) => handleLayer.append(handle));

  return {
    setEnabled(enabled) {
      handles.forEach((handle) => {
        handle.style.display = enabled ? 'block' : 'none';
      });
    },
  };

  function createResizeHandle(direction: 'right' | 'bottom' | 'corner', cursor: string): HTMLDivElement {
    const handle = document.createElement('div');
    handle.dataset.resizeDirection = direction;
    handle.title = `Resize overlay ${direction}`;
    handle.setAttribute('aria-hidden', 'true');
    handle.style.background = 'transparent';
    handle.style.cursor = cursor;
    handle.style.position = 'absolute';
    handle.style.touchAction = 'none';
    handle.style.zIndex = '2147483647';

    if (direction === 'right') {
      handle.style.bottom = '18px';
      handle.style.right = '0';
      handle.style.top = '34px';
      handle.style.width = '12px';
    } else if (direction === 'bottom') {
      handle.style.bottom = '0';
      handle.style.height = '12px';
      handle.style.left = '0';
      handle.style.right = '18px';
    } else {
      handle.style.background = 'linear-gradient(135deg, transparent 52%, rgba(125, 211, 252, 0.65) 52%, rgba(125, 211, 252, 0.65) 62%, transparent 62%)';
      handle.style.bottom = '0';
      handle.style.height = '18px';
      handle.style.right = '0';
      handle.style.width = '18px';
    }

    installResizePointerBehavior(handle, direction);
    return handle;
  }

  function installResizePointerBehavior(handle: HTMLElement, direction: 'right' | 'bottom' | 'corner'): void {
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startLeft = 0;
    let startTop = 0;

    handle.addEventListener('pointerdown', (event) => {
      if (panel.dataset.minimized === 'true') return;
      event.preventDefault();
      event.stopPropagation();
      startX = event.clientX;
      startY = event.clientY;
      startWidth = panel.offsetWidth;
      startHeight = panel.offsetHeight;
      startLeft = panel.offsetLeft;
      startTop = panel.offsetTop;
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener('pointermove', (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      if (direction === 'right' || direction === 'corner') {
        const maxWidth = Math.max(minimumOverlayWidth, window.innerWidth - startLeft - viewportMargin);
        panel.style.width = `${clamp(startWidth + event.clientX - startX, minimumOverlayWidth, maxWidth)}px`;
      }
      if (direction === 'bottom' || direction === 'corner') {
        const maxHeight = Math.max(minimumOverlayHeight, window.innerHeight - startTop - viewportMargin);
        panel.style.height = `${clamp(startHeight + event.clientY - startY, minimumOverlayHeight, maxHeight)}px`;
      }
    });

    const releasePointer = (event: PointerEvent) => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };

    handle.addEventListener('pointerup', releasePointer);
    handle.addEventListener('pointercancel', releasePointer);
  }
}

export function toggleOverlayMinimize(panel: HTMLElement, content: HTMLElement, toolbar: HTMLElement, resize: OverlayResizeController): void {
  const minimized = panel.dataset.minimized === 'true';
  if (minimized) {
    panel.dataset.minimized = 'false';
    panel.style.height = panel.dataset.restoreHeight ?? `${initialOverlayHeight()}px`;
    panel.style.minHeight = `${minimumOverlayHeight}px`;
    content.style.display = 'block';
    resize.setEnabled(true);
    return;
  }

  panel.dataset.minimized = 'true';
  panel.dataset.restoreHeight = panel.style.height;
  content.style.display = 'none';
  panel.style.minHeight = '0';
  panel.style.height = `${toolbar.getBoundingClientRect().height}px`;
  resize.setEnabled(false);
}

export function fitOverlayToViewport(panel: HTMLElement, content: HTMLElement, resize: OverlayResizeController): void {
  panel.dataset.minimized = 'false';
  content.style.display = 'block';
  panel.style.left = `${viewportMargin}px`;
  panel.style.top = `${viewportMargin}px`;
  panel.style.minHeight = `${minimumOverlayHeight}px`;
  panel.style.width = `calc(100vw - ${viewportMargin * 2}px)`;
  panel.style.height = `calc(100vh - ${viewportMargin * 2}px)`;
  resize.setEnabled(true);
}

export function setInitialOverlayGeometry(panel: HTMLElement): void {
  panel.style.left = `${Math.max(viewportMargin, window.innerWidth - initialOverlayWidth() - 16)}px`;
  panel.style.top = `${viewportMargin}px`;
  panel.style.width = `${initialOverlayWidth()}px`;
  panel.style.height = `${initialOverlayHeight()}px`;
}

export function initialOverlayWidth(): number {
  return clamp(Math.round(window.innerWidth * 0.42), 420, Math.max(minimumOverlayWidth, window.innerWidth - viewportMargin * 2));
}

export function initialOverlayHeight(): number {
  return clamp(Math.round(window.innerHeight * 0.78), 460, Math.max(minimumOverlayHeight, window.innerHeight - viewportMargin * 2));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
