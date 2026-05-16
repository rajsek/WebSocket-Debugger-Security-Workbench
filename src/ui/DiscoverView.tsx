import { Bug, FileText, Plug, RefreshCw, Save, Square, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DiscoveredSocket, ObservedFrameSummary, WebSocketCaptureSnapshot } from '../domain/types';

export function DiscoverView(props: {
  snapshot: WebSocketCaptureSnapshot;
  selectedSocket: DiscoveredSocket | null;
  selectedRequestId: string | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onCaptureReload: () => void;
  onSelectSocket: (requestId: string) => void;
  onImportTarget: (socket: DiscoveredSocket) => void;
  onImportBootstrap: (socket: DiscoveredSocket, frameIds: string[]) => void;
  onSaveSocket: (socket: DiscoveredSocket) => void;
  onSaveBootstrap: (socket: DiscoveredSocket, frameIds: string[]) => void;
  onAddEvidence: (socket: DiscoveredSocket) => void;
}) {
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const captureActive = props.snapshot.status === 'attaching' || props.snapshot.status === 'listening';
  const bootstrapFrames = useMemo(
    () => props.selectedSocket?.firstOutboundFrames.filter((frame) => frame.payloadKind === 'text') ?? [],
    [props.selectedSocket],
  );

  useEffect(() => {
    setSelectedFrameIds([]);
  }, [props.selectedRequestId]);

  function toggleFrame(frame: ObservedFrameSummary, checked: boolean) {
    setSelectedFrameIds((current) => (checked ? [...current, frame.id] : current.filter((id) => id !== frame.id)));
  }

  return (
    <section className="discover-area" aria-label="WebSocket discovery">
      <div className="discover-toolbar">
        <div className="discover-status">
          <span className={`capture-dot capture-${props.snapshot.status}`} aria-hidden="true" />
          <div>
            <span className="label">Capture</span>
            <strong>{captureLabel(props.snapshot.status)}</strong>
          </div>
        </div>
        <button type="button" className="primary-action" onClick={props.onStart} disabled={props.busy || captureActive}>
          <Bug size={16} /> Start capture
        </button>
        <button type="button" onClick={props.onCaptureReload} disabled={props.busy || captureActive}>
          <RefreshCw size={16} /> Capture + reload
        </button>
        <button type="button" className="danger" onClick={props.onStop} disabled={props.busy || !captureActive}>
          <Square size={16} /> Stop capture
        </button>
        <span className="discover-message" title={props.snapshot.message}>
          {props.snapshot.message || 'No capture activity yet.'}
        </span>
      </div>

      <div className="discover-layout">
        <div className="socket-list-pane">
          <div className="socket-list-header" aria-hidden="true">
            <span>Socket</span>
            <span>State</span>
            <span>Frames</span>
            <span>Import</span>
          </div>
          <ol className="socket-list" aria-label="Discovered sockets">
            {props.snapshot.sockets.length === 0 ? (
              <li className="empty-state">No WebSockets observed for this capture.</li>
            ) : (
              props.snapshot.sockets.map((socket) => (
                <li key={socket.requestId}>
                  <div className={props.selectedRequestId === socket.requestId ? 'selected socket-row' : 'socket-row'}>
                    <button type="button" className="socket-select" onClick={() => props.onSelectSocket(socket.requestId)}>
                      <span className="socket-url" title={socket.url}>{socket.url}</span>
                      <span>{socket.lifecycle}</span>
                      <span>{socket.frameCounts.outbound}/{socket.frameCounts.inbound}</span>
                    </button>
                    <button type="button" className="socket-import-action" onClick={() => props.onImportTarget(socket)}>
                      <Plug size={14} /> Target
                    </button>
                  </div>
                </li>
              ))
            )}
          </ol>
        </div>

        <article className="socket-detail-pane">
          {props.selectedSocket ? (
            <>
              <div className="socket-detail-heading">
                <div>
                  <span className="label">Selected Request</span>
                  <h2>{props.selectedSocket.requestId}</h2>
                </div>
                <span className={`mode-pill mode-${props.selectedSocket.lifecycle === 'errored' ? 'active' : 'passive'}`}>{props.selectedSocket.lifecycle}</span>
              </div>

              <div className="socket-detail-grid">
                <span>URL</span>
                <code>{props.selectedSocket.url}</code>
                <span>Last activity</span>
                <span>{formatTimestamp(props.selectedSocket.lastActivityAt)}</span>
                <span>Frames</span>
                <span>{props.selectedSocket.frameCounts.outbound} outbound / {props.selectedSocket.frameCounts.inbound} inbound</span>
                <span>Error</span>
                <span>{props.selectedSocket.error ?? 'none'}</span>
              </div>

              <section className="handshake-panel" aria-label="Handshake summary">
                <div className="detail-heading">
                  <FileText size={16} />
                  <h3>Handshake</h3>
                  <span className={props.selectedSocket.handshake.observed ? 'mode-pill mode-passive' : 'mode-pill'}>{props.selectedSocket.handshake.observed ? 'observed' : 'not observed'}</span>
                </div>
                {props.selectedSocket.handshake.observed ? (
                  <div className="handshake-grid">
                    <span>Status</span>
                    <span>{props.selectedSocket.handshake.status ?? 'unknown'} {props.selectedSocket.handshake.statusText}</span>
                    <span>Protocol</span>
                    <span>{props.selectedSocket.handshake.protocol || 'none observed'}</span>
                    <span>Extensions</span>
                    <span>{props.selectedSocket.handshake.extensions || 'none observed'}</span>
                    <span>Request headers</span>
                    <HeaderList headers={props.selectedSocket.handshake.requestHeaders} />
                    <span>Response headers</span>
                    <HeaderList headers={props.selectedSocket.handshake.responseHeaders} />
                  </div>
                ) : (
                  <p className="muted-line">Handshake metadata was not observed for this request.</p>
                )}
              </section>

              <section className="bootstrap-panel" aria-label="Outbound bootstrap frames">
                <div className="detail-heading">
                  <Upload size={16} />
                  <h3>Bootstrap Frames</h3>
                  <span className="mode-pill">{bootstrapFrames.length}</span>
                </div>
                {bootstrapFrames.length === 0 ? (
                  <p className="muted-line">No text outbound bootstrap frames observed.</p>
                ) : (
                  <ol className="bootstrap-list">
                    {bootstrapFrames.map((frame, index) => (
                      <li key={frame.id}>
                        <label>
                          <input type="checkbox" checked={selectedFrameIds.includes(frame.id)} onChange={(event) => toggleFrame(frame, event.target.checked)} />
                          <span>Bootstrap frame {index + 1}</span>
                          <code>{frame.preview}</code>
                        </label>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <div className="discover-actions">
                <button type="button" onClick={() => props.onAddEvidence(props.selectedSocket as DiscoveredSocket)}>
                  <FileText size={16} /> Add observed evidence
                </button>
                <button type="button" onClick={() => props.onImportTarget(props.selectedSocket as DiscoveredSocket)}>
                  <Plug size={16} /> Import Target
                </button>
                <button type="button" onClick={() => props.onSaveSocket(props.selectedSocket as DiscoveredSocket)}>
                  <Save size={16} /> Save socket
                </button>
                <button type="button" onClick={() => props.onSaveBootstrap(props.selectedSocket as DiscoveredSocket, selectedFrameIds)} disabled={selectedFrameIds.length === 0}>
                  <Save size={16} /> Save messages
                </button>
                <button type="button" className="primary-action" onClick={() => props.onImportBootstrap(props.selectedSocket as DiscoveredSocket, selectedFrameIds)} disabled={selectedFrameIds.length === 0}>
                  <Upload size={16} /> Import With Bootstrap
                </button>
              </div>
              <p className="controlled-note">Import creates a new controlled connection seeded from observed data; it does not take over the page socket.</p>
            </>
          ) : (
            <div className="empty-state">Select an observed socket to inspect handshake context and bootstrap candidates.</div>
          )}
        </article>
      </div>
    </section>
  );
}

function HeaderList(props: { headers: { name: string; value: string }[] }) {
  if (props.headers.length === 0) return <span>none observed</span>;
  return (
    <ul className="header-list">
      {props.headers.map((header) => (
        <li key={header.name}>
          <span>{header.name}</span>
          <code>{header.value}</code>
        </li>
      ))}
    </ul>
  );
}

function captureLabel(status: WebSocketCaptureSnapshot['status']): string {
  if (status === 'detached-by-devtools') return 'detached by debugger';
  return status;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString();
}
