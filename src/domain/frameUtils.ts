import type { FrameDirection, FrameRecord } from './types';
import { summarizeTextPayload } from './binaryPayload';

export function createFrame(params: {
  direction: FrameDirection;
  url: string;
  body: string;
  metadata?: Record<string, string>;
  now?: string;
}): FrameRecord {
  const timestamp = params.now ?? new Date().toISOString();
  const payload = summarizeTextPayload(params.body);
  return {
    id: crypto.randomUUID(),
    direction: params.direction,
    timestamp,
    url: params.url,
    body: params.body,
    metadata: {
      ...payload.metadata,
      ...(params.metadata ?? {}),
    },
  };
}

export function searchFrames(
  frames: FrameRecord[],
  query: string,
  direction: 'all' | FrameDirection,
): FrameRecord[] {
  const normalized = query.trim().toLowerCase();
  return frames.filter((frame) => {
    if (direction !== 'all' && frame.direction !== direction) return false;
    if (!normalized) return true;

    const metadataText = Object.entries(frame.metadata)
      .map(([key, value]) => `${key}:${value}`)
      .join(' ');

    return [frame.body, frame.direction, frame.timestamp, frame.url, metadataText]
      .join(' ')
      .toLowerCase()
      .includes(normalized);
  });
}

export function resendFrame(frame: FrameRecord, now: string): FrameRecord {
  return {
    ...frame,
    id: crypto.randomUUID(),
    direction: 'outbound',
    timestamp: now,
    metadata: {
      ...frame.metadata,
      resentFrom: frame.id,
    },
  };
}

export function isReplayableTextFrame(frame: FrameRecord): boolean {
  return frame.metadata.payloadKind !== 'binary';
}

export function previewBody(value: string, maxLength = 240): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
