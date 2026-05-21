import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FrameDirection, ReplayQueueItemRole, ReplayQueueItemStatus } from '../domain/types';

export interface FrameStreamTableRow {
  id: string;
  direction: FrameDirection;
  timestamp: string;
  payloadKind: 'text' | 'binary';
  payloadLength: number;
  body: string;
  selected?: boolean;
  role?: ReplayQueueItemRole;
  status?: ReplayQueueItemStatus;
}

export function FrameStreamTable(props: {
  rows: FrameStreamTableRow[];
  ariaLabel: string;
  emptyText: string;
  onSelect?: (rowId: string) => void;
  renderActions?: (row: FrameStreamTableRow) => ReactNode;
}) {
  return (
    <>
      <div className="frame-header" aria-hidden="true">
        <span>Dir</span>
        <span>Time</span>
        <span>Length</span>
        <span>Wire</span>
        <span>Data Preview</span>
        {props.renderActions ? <span>Actions</span> : null}
      </div>
      <ol className="frame-list" aria-label={props.ariaLabel}>
        {props.rows.length === 0 ? (
          <li className="empty-state">{props.emptyText}</li>
        ) : (
          props.rows.map((row) => (
            <li key={row.id}>
              {props.onSelect ? (
                <button type="button" className={row.selected ? 'selected frame-row' : 'frame-row'} onClick={() => props.onSelect?.(row.id)}>
                  <FrameRowCells row={row} />
                </button>
              ) : (
                <div className={row.selected ? 'selected frame-row transcript-frame-row' : 'frame-row transcript-frame-row'}>
                  <FrameRowCells row={row} />
                  {props.renderActions ? <div className="frame-row-actions">{props.renderActions(row)}</div> : null}
                </div>
              )}
            </li>
          ))
        )}
      </ol>
    </>
  );
}

export function DirectionMarker(props: { direction: FrameDirection }) {
  const Icon = props.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className={`direction-marker ${props.direction}`} title={props.direction} aria-label={props.direction}>
      <Icon size={13} strokeWidth={2.4} />
    </span>
  );
}

export function formatFrameTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.toTimeString().slice(0, 8)}.${ms}`;
}

function FrameRowCells(props: { row: FrameStreamTableRow }) {
  return (
    <>
      <DirectionMarker direction={props.row.direction} />
      <time className="frame-time">{formatFrameTime(props.row.timestamp)}</time>
      <span className="frame-size">{props.row.payloadLength} B</span>
      <span className={`frame-wire ${props.row.payloadKind}`}>{props.row.status ?? props.row.payloadKind}</span>
      <span className="frame-body">{props.row.body}</span>
    </>
  );
}
