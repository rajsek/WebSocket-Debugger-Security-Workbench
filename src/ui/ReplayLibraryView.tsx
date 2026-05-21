import { Download, Eraser, FileText, Play, Save, SendHorizontal, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { replaySourceMismatchReason } from '../domain/replay';
import { isSendableReplayItem } from '../domain/transcript';
import type { ConnectionStatus, ReplayQueue, SavedMessageSet, SavedReplayArtifact, SavedSocketRecipe } from '../domain/types';
import { FrameStreamTable } from './FrameStreamTable';

export function ReplayLibraryView(props: {
  artifacts: SavedReplayArtifact[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  onRefresh: () => void;
  onSaveCurrentTarget: () => void;
  onSaveCurrentOutbound: () => void;
  onLoadQueue: (socketRecipeId: string, messageSetId: string) => void;
  onDelete: (artifactId: string) => void;
  onClearLibrary: () => void;
  onExport: (artifactIds: string[]) => void;
  onImportJson: (json: string) => void;
}) {
  const socketRecipes = props.artifacts.filter((artifact): artifact is SavedSocketRecipe => artifact.kind === 'saved-socket-recipe');
  const messageSets = props.artifacts.filter((artifact): artifact is SavedMessageSet => artifact.kind === 'saved-message-set');
  const [selectedSocketRecipeId, setSelectedSocketRecipeId] = useState('');
  const [selectedMessageSetId, setSelectedMessageSetId] = useState('');
  const [importJson, setImportJson] = useState('');
  const selectedSocketRecipe = socketRecipes.find((recipe) => recipe.id === selectedSocketRecipeId) ?? null;
  const selectedMessageSet = messageSets.find((set) => set.id === selectedMessageSetId) ?? null;
  const mismatchReason = selectedSocketRecipe && selectedMessageSet ? replaySourceMismatchReason(selectedSocketRecipe, selectedMessageSet) : null;

  useEffect(() => {
    if (!selectedSocketRecipeId && socketRecipes[0]) setSelectedSocketRecipeId(socketRecipes[0].id);
    if (!selectedMessageSetId && messageSets[0]) setSelectedMessageSetId(messageSets[0].id);
  }, [messageSets, selectedMessageSetId, selectedSocketRecipeId, socketRecipes]);

  const loadDisabled = !selectedSocketRecipeId || !selectedMessageSetId;

  return (
    <section className="replay-area" aria-label="Replay library">
      <div className="replay-toolbar">
        <div>
          <span className="label">Replay Library</span>
          <strong>{props.artifacts.length} saved artifacts</strong>
          <span>{props.status === 'loading' ? 'loading' : props.error ?? 'Saved replay payloads are local and may contain secrets.'}</span>
        </div>
        <button type="button" onClick={props.onRefresh}>
          <Upload size={16} /> Refresh
        </button>
        <button type="button" className="primary-action" onClick={props.onSaveCurrentTarget}>
          <Save size={16} /> Save target
        </button>
        <button type="button" onClick={props.onSaveCurrentOutbound}>
          <FileText size={16} /> Save outbound
        </button>
        <button type="button" className="danger" onClick={props.onClearLibrary} disabled={props.artifacts.length === 0}>
          <Eraser size={16} /> Clear library
        </button>
      </div>

      <div className="replay-layout">
        <section className="replay-card" aria-label="Load replay queue">
          <div className="detail-heading">
            <Play size={16} />
            <h2>Load Queue</h2>
          </div>
          <label>
            <span className="label">Socket recipe</span>
            <select value={selectedSocketRecipeId} onChange={(event) => setSelectedSocketRecipeId(event.target.value)}>
              <option value="">Select recipe</option>
              {socketRecipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Message set</span>
            <select value={selectedMessageSetId} onChange={(event) => setSelectedMessageSetId(event.target.value)}>
              <option value="">Select messages</option>
              {messageSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name} ({set.messages.length})
                </option>
              ))}
            </select>
          </label>
          {selectedSocketRecipe || selectedMessageSet ? (
            <ReplayLoadPreview socketRecipe={selectedSocketRecipe} messageSet={selectedMessageSet} mismatchReason={mismatchReason} />
          ) : null}
          <button type="button" className="primary-action" disabled={loadDisabled} onClick={() => props.onLoadQueue(selectedSocketRecipeId, selectedMessageSetId)}>
            <Play size={16} /> Load editable queue
          </button>
        </section>

        <section className="replay-card" aria-label="Import replay artifact">
          <div className="detail-heading">
            <Upload size={16} />
            <h2>Import JSON</h2>
          </div>
          <textarea aria-label="Replay import JSON" value={importJson} onChange={(event) => setImportJson(event.target.value)} placeholder="Paste replay artifact JSON" />
          <button type="button" onClick={() => props.onImportJson(importJson)} disabled={!importJson.trim()}>
            <Upload size={16} /> Import
          </button>
        </section>
      </div>

      <ol className="replay-artifact-list" aria-label="Saved replay artifacts">
        {props.artifacts.length === 0 ? (
          <li className="empty-state">No replay artifacts saved.</li>
        ) : (
          props.artifacts.map((artifact) => (
            <li key={artifact.id}>
              <div>
                <strong>{artifact.name}</strong>
                <span>{artifact.kind === 'saved-socket-recipe' ? artifact.socketUrl : `${artifact.messages.length} messages from ${artifact.socketUrl}`}</span>
                <small>v{artifact.schemaVersion} / {artifact.updatedAt}</small>
              </div>
              <button type="button" onClick={() => props.onExport([artifact.id])}>
                <Download size={15} /> Export
              </button>
              <button type="button" className="danger" onClick={() => props.onDelete(artifact.id)}>
                <Trash2 size={15} /> Delete
              </button>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function ReplayLoadPreview(props: { socketRecipe: SavedSocketRecipe | null; messageSet: SavedMessageSet | null; mismatchReason: string | null }) {
  return (
    <section className="replay-load-preview" aria-label="Replay load preview">
      <dl>
        <div>
          <dt>Socket URL</dt>
          <dd>{props.socketRecipe?.socketUrl ?? 'select a recipe'}</dd>
        </div>
        <div>
          <dt>Engine</dt>
          <dd>{props.socketRecipe?.selectedEngine ?? 'unknown'}</dd>
        </div>
        <div>
          <dt>Subprotocol</dt>
          <dd>{props.socketRecipe?.subprotocol || 'none set'}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{sourceLabel(props.socketRecipe)}</dd>
        </div>
        <div>
          <dt>Messages</dt>
          <dd>{props.messageSet ? `${props.messageSet.messages.length} selected` : 'select messages'}</dd>
        </div>
        <div>
          <dt>Handshake</dt>
          <dd>{props.socketRecipe?.handshake.observed ? 'observed' : 'unobserved'}</dd>
        </div>
      </dl>
      {props.mismatchReason ? <p className="warning-line">{props.mismatchReason}</p> : null}
    </section>
  );
}

function sourceLabel(socketRecipe: SavedSocketRecipe | null): string {
  if (!socketRecipe) return 'unknown';
  if (socketRecipe.sourceRequestId) return `${socketRecipe.sourceType} request ${socketRecipe.sourceRequestId}`;
  return socketRecipe.sourceType;
}

export function ReplayQueuePanel(props: {
  queue: ReplayQueue;
  connectionStatus: ConnectionStatus;
  selectedIds: string[];
  onToggleItem: (itemId: string, selected: boolean) => void;
  onEditItem: (itemId: string, body: string) => void;
  onSendNext: () => void;
  onSendSelected: () => void;
  onSendAll: () => void;
  onSendWithWaits: () => void;
  onSendItem: (itemId: string) => void;
  onSkipItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onSkipWaiting: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const selectedCount = useMemo(() => props.queue.items.filter((item) => props.selectedIds.includes(item.id)).length, [props.queue.items, props.selectedIds]);
  const selectedSendableCount = useMemo(() => props.queue.items.filter((item) => props.selectedIds.includes(item.id) && isSendableReplayItem(item)).length, [props.queue.items, props.selectedIds]);
  const waitingCheckpoint = props.queue.items.find((item) => item.status === 'waiting') ?? null;
  const canSend = props.connectionStatus === 'open' && props.queue.items.some((item) => item.status !== 'sent' && isSendableReplayItem(item));
  return (
    <section className="replay-queue-panel" aria-label="Imported bootstrap transcript">
      <div className="detail-heading">
        <SendHorizontal size={16} />
        <h3>Imported Transcript</h3>
        <span className="mode-pill">{props.queue.items.length}</span>
      </div>
      {props.queue.sourceMismatch ? <p className="warning-line">{props.queue.mismatchReason}</p> : null}
      <p className="controlled-note">Inbound rows are wait checkpoints or transcript context. Only outbound text rows are sent.</p>
      <div className="stream-pane transcript-stream-pane">
        <FrameStreamTable
          rows={props.queue.items.map((item) => ({
            id: item.id,
            direction: item.direction,
            timestamp: item.sourceTimestamp ?? item.updatedAt,
            payloadKind: item.payloadKind,
            payloadLength: item.payloadLength,
            body: item.preview,
            selected: props.selectedIds.includes(item.id),
            role: item.role,
            status: item.status,
          }))}
          showStatus
          ariaLabel="Imported transcript rows"
          emptyText="No imported transcript rows."
          renderActions={(row) => {
            const item = props.queue.items.find((candidate) => candidate.id === row.id);
            if (!item) return null;
            const index = props.queue.items.findIndex((candidate) => candidate.id === row.id);
            return (
              <>
                <label className="transcript-select">
                  <input type="checkbox" checked={props.selectedIds.includes(item.id)} onChange={(event) => props.onToggleItem(item.id, event.target.checked)} />
                  <span>{item.role}</span>
                </label>
                {isSendableReplayItem(item) ? (
                  <textarea aria-label={`Replay message ${index + 1}`} value={item.body} onChange={(event) => props.onEditItem(item.id, event.target.value)} disabled={item.status === 'removed'} />
                ) : (
                  <code className="transcript-readonly" aria-label={`Transcript row ${index + 1}`}>{item.preview}</code>
                )}
                <button type="button" onClick={() => props.onSendItem(item.id)} disabled={!canSend || !isSendableReplayItem(item) || item.status === 'sent' || item.status === 'removed'}>
                  <SendHorizontal size={14} /> Send
                </button>
                {item.status === 'waiting' ? (
                  <button type="button" onClick={props.onSkipWaiting}>
                    <SquareIcon /> Skip wait
                  </button>
                ) : (
                  <button type="button" onClick={() => props.onSkipItem(item.id)} disabled={item.status === 'skipped' || item.status === 'removed' || item.status === 'sent' || item.status === 'matched'}>
                    <SquareIcon /> Skip
                  </button>
                )}
                <button type="button" className="danger" onClick={() => props.onRemoveItem(item.id)} disabled={item.status === 'removed'}>
                  <Trash2 size={14} /> Remove
                </button>
              </>
            );
          }}
        />
      </div>
      {waitingCheckpoint ? <p className="warning-line">Waiting for inbound checkpoint row {props.queue.items.findIndex((item) => item.id === waitingCheckpoint.id) + 1}; timeout {waitingCheckpoint.timeoutAt ?? 'pending'}.</p> : null}
      <div className="editor-actions">
        <button type="button" className="primary-action" onClick={props.onSendNext} disabled={!canSend}>
          <SendHorizontal size={16} /> Send next
        </button>
        <button type="button" onClick={props.onSendSelected} disabled={!canSend || selectedSendableCount === 0}>
          <SendHorizontal size={16} /> Send selected
        </button>
        <button type="button" onClick={props.onSendAll} disabled={!canSend}>
          <SendHorizontal size={16} /> Run ordered
        </button>
        <button type="button" onClick={props.onSendWithWaits} disabled={!canSend || selectedCount === 0}>
          <SendHorizontal size={16} /> Run with waits
        </button>
        <button type="button" onClick={props.onFinish}>
          <FileText size={16} /> Finish run
        </button>
        <button type="button" onClick={props.onCancel}>
          <SquareIcon /> Cancel
        </button>
        <button type="button" onClick={props.onClear}>
          <Eraser size={16} /> Clear queue
        </button>
      </div>
    </section>
  );
}

function SquareIcon() {
  return <span aria-hidden="true" className="square-icon" />;
}
