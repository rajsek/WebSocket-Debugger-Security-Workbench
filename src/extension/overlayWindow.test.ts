import { applyOverlayPanelStyles, createOverlayToolbar, fitOverlayToViewport, installOverlayClose, installOverlayResize, requestOverlayClose, toggleOverlayMinimize } from './overlayWindow';

describe('overlayWindow', () => {
  it('uses explicit resize handles instead of native CSS resize', () => {
    const panel = document.createElement('div');
    applyOverlayPanelStyles(panel);

    const resize = installOverlayResize(panel, panel);
    const handles = panel.querySelectorAll('[data-resize-direction]');

    expect(panel.style.resize).toBe('none');
    expect(handles).toHaveLength(3);
    expect([...handles].map((handle) => (handle as HTMLElement).dataset.resizeDirection)).toEqual(['right', 'bottom', 'corner']);

    resize.setEnabled(false);
    expect([...handles].every((handle) => (handle as HTMLElement).style.display === 'none')).toBe(true);
  });

  it('keeps resize handles aligned with minimize and fit state', () => {
    const panel = document.createElement('div');
    const content = document.createElement('div');
    const { toolbar } = createOverlayToolbar('Test Overlay');
    document.body.append(panel);
    panel.append(toolbar, content);
    applyOverlayPanelStyles(panel);
    panel.style.height = '520px';

    const resize = installOverlayResize(panel, panel);
    toggleOverlayMinimize(panel, content, toolbar, resize);

    expect(panel.dataset.minimized).toBe('true');
    expect(content.style.display).toBe('none');
    expect([...panel.querySelectorAll('[data-resize-direction]')].every((handle) => (handle as HTMLElement).style.display === 'none')).toBe(true);

    fitOverlayToViewport(panel, content, resize);

    expect(panel.dataset.minimized).toBe('false');
    expect(content.style.display).toBe('block');
    expect(panel.style.left).toBe('12px');
    expect(panel.style.top).toBe('12px');
    expect([...panel.querySelectorAll('[data-resize-direction]')].every((handle) => (handle as HTMLElement).style.display === 'block')).toBe(true);
  });

  it('routes close requests through overlay cleanup before removal', () => {
    const panel = document.createElement('div');
    const cleanup = vi.fn();
    document.body.append(panel);

    installOverlayClose(panel, cleanup);
    requestOverlayClose(panel);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(panel.isConnected).toBe(false);
  });
});
