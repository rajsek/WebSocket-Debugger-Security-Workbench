import { Download, Eraser, FileText, Play, Save, SendHorizontal, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ConnectionStatus, ReplayQueue, SavedMessageSet, SavedReplayArtifact, SavedSocketRecipe } from '../domain/types';

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

export function ReplayQueuePanel(props: {
  queue: ReplayQueue;
  connectionStatus: ConnectionStatus;
  selectedIds: string[];
  onToggleItem: (itemId: string, selected: boolean) => void;
  onEditItem: (itemId: string, body: string) => void;
  onSendNext: () => void;
  onSendSelected: () => void;
  onSendAll: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const selectedCount = useMemo(() => props.queue.items.filter((item) => props.selectedIds.includes(item.id)).length, [props.queue.items, props.selectedIds]);
  const canSend = props.connectionStatus === 'open' && props.queue.items.some((item) => item.status !== 'sent');
  return (
    <section className="replay-queue-panel" aria-label="Editable replay queue">
      <div className="detail-heading">
        <SendHorizontal size={16} />
        <h3>Replay Queue</h3>
        <span className="mode-pill">{props.queue.items.length}</span>
      </div>
      {props.queue.sourceMismatch ? <p className="warning-line">{props.queue.mismatchReason}</p> : null}
      <ol className="replay-queue-list">
        {props.queue.items.map((item, index) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={props.selectedIds.includes(item.id)} onChange={(event) => props.onToggleItem(item.id, event.target.checked)} />
              <span>Message {index + 1}</span>
              <small>{item.status}{item.editedAt ? ' / edited' : ''}</small>
            </label>
            <textarea aria-label={`Replay message ${index + 1}`} value={item.body} onChange={(event) => props.onEditItem(item.id, event.target.value)} />
          </li>
        ))}
      </ol>
      <div className="editor-actions">
        <button type="button" className="primary-action" onClick={props.onSendNext} disabled={!canSend}>
          <SendHorizontal size={16} /> Send next
        </button>
        <button type="button" onClick={props.onSendSelected} disabled={!canSend || selectedCount === 0}>
          <SendHorizontal size={16} /> Send selected
        </button>
        <button type="button" onClick={props.onSendAll} disabled={!canSend}>
          <SendHorizontal size={16} /> Send all
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
