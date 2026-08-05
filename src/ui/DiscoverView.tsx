import { Bug, FileText, Plug, RefreshCw, Save, Square, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { handshakeHeaderUsage, observedHandshakeExtensions, observedHandshakeSubprotocol } from '../domain/discovery';
import type { BootstrapTranscriptRow, DiscoveredSocket, WebSocketCaptureSnapshot } from '../domain/types';
import { FrameStreamTable } from './FrameStreamTable';

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
  const bootstrapTranscript = useMemo(
    () => props.selectedSocket?.bootstrapTranscript ?? [],
    [props.selectedSocket],
  );

  useEffect(() => {
    setSelectedFrameIds([]);
  }, [props.selectedRequestId]);

  function toggleFrame(frame: BootstrapTranscriptRow, checked: boolean) {
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
                <span className="label">URL</span>
                <code>{props.selectedSocket.url}</code>
                <span className="label">Activity</span>
                <span>{formatTimestamp(props.selectedSocket.lastActivityAt)}</span>
                <span className="label">Frames</span>
                <span>{props.selectedSocket.frameCounts.outbound} ↑ / {props.selectedSocket.frameCounts.inbound} ↓</span>
                {props.selectedSocket.error && (
                  <>
                    <span className="label">Error</span>
                    <span className="error-text">{props.selectedSocket.error}</span>
                  </>
                )}
              </div>

              <section className="handshake-panel" aria-label="Handshake summary">
                <div className="detail-heading">
                  <FileText size={16} />
                  <h3>Handshake</h3>
                  <span className={props.selectedSocket.handshake.observed ? 'mode-pill mode-passive' : 'mode-pill'}>{props.selectedSocket.handshake.observed ? 'observed' : 'not observed'}</span>
                </div>
                {props.selectedSocket.handshake.observed ? (
                  <div className="handshake-grid">
                    <span className="label">Status</span>
                    <span>{props.selectedSocket.handshake.status ?? 'unknown'} {props.selectedSocket.handshake.statusText}</span>
                    <span className="label">Protocol</span>
                    <span className="protocol-value">{observedHandshakeSubprotocol(props.selectedSocket.handshake) || 'none observed'}</span>
                    <span className="label">Extensions</span>
                    <span>{observedHandshakeExtensions(props.selectedSocket.handshake) || 'none observed'}</span>
                    <span className="label">Request</span>
                    <HeaderList headers={props.selectedSocket.handshake.requestHeaders} />
                    <span className="label">Response</span>
                    <HeaderList headers={props.selectedSocket.handshake.responseHeaders} />
                  </div>
                ) : (
                  <p className="muted-line">Handshake metadata was not observed for this request.</p>
                )}
              </section>

              <section className="bootstrap-panel" aria-label="Ordered bootstrap transcript">
                <div className="detail-heading">
                  <Upload size={16} />
                  <h3>Bootstrap Transcript</h3>
                  <span className="mode-pill">{bootstrapTranscript.length}</span>
                </div>
                <div className="stream-pane transcript-stream-pane discover-transcript-pane">
                  <FrameStreamTable
                    rows={bootstrapTranscript.map((frame) => ({
                      id: frame.id,
                      direction: frame.direction,
                      timestamp: frame.timestamp,
                      payloadKind: frame.payloadKind,
                      payloadLength: frame.payloadLength,
                      body: frame.preview,
                      selected: selectedFrameIds.includes(frame.id),
                      role: frame.role,
                    }))}
                    ariaLabel="Discovered bootstrap transcript rows"
                    emptyText="No ordered transcript rows observed for this socket. Restart capture or use Capture + reload to observe startup traffic."
                    renderActions={(row) => {
                      const frame = bootstrapTranscript.find((candidate) => candidate.id === row.id);
                      if (!frame) return null;
                      const index = bootstrapTranscript.findIndex((candidate) => candidate.id === row.id);
                      const rowLabel = `${frame.direction === 'outbound' ? 'outbound' : 'inbound'} row ${index + 1}`;
                      return (
                        <label className="transcript-select discover-transcript-select">
                          <input
                            type="checkbox"
                            aria-label={`Select ${rowLabel}`}
                            checked={selectedFrameIds.includes(frame.id)}
                            onChange={(event) => toggleFrame(frame, event.target.checked)}
                          />
                          <span>{rowLabel}</span>
                          <small>{frame.role}</small>
                        </label>
                      );
                    }}
                  />
                </div>
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
                  <Save size={16} /> Save transcript
                </button>
                <button type="button" className="primary-action" onClick={() => props.onImportBootstrap(props.selectedSocket as DiscoveredSocket, selectedFrameIds)} disabled={selectedFrameIds.length === 0}>
                  <Upload size={16} /> Import Transcript
                </button>
              </div>
              <p className="controlled-note">Import creates a new controlled connection seeded from observed data. Inbound rows are checkpoints or context, not sendable responses.</p>
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
      {props.headers.map((header) => {
        const usage = handshakeHeaderUsage(header.name);
        return (
          <li key={header.name}>
            <span>{header.name}</span>
            <code>{header.value}</code>
            <small className={`header-usage header-usage-${usage.role}`} title={usage.description}>
              {usage.label}
            </small>
          </li>
        );
      })}
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
