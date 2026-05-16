import { searchFrames, resendFrame } from './frameUtils';
import type { FrameRecord } from './types';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'new-id'),
});

const frames: FrameRecord[] = [
  {
    id: 'a',
    direction: 'inbound',
    timestamp: '2026-04-29T10:00:00.000Z',
    url: 'wss://example.com/socket',
    body: '{"message":"hello"}',
    metadata: { opcode: 'text' },
  },
  {
    id: 'b',
    direction: 'outbound',
    timestamp: '2026-04-29T10:01:00.000Z',
    url: 'wss://example.com/socket',
    body: '{"resourceId":"42"}',
    metadata: { source: 'manual' },
  },
];

describe('frame utilities', () => {
  it('searches body, direction, timestamp, and metadata', () => {
    expect(searchFrames(frames, 'hello', 'all')).toHaveLength(1);
    expect(searchFrames(frames, 'outbound', 'all')).toHaveLength(1);
    expect(searchFrames(frames, '10:01', 'all')).toHaveLength(1);
    expect(searchFrames(frames, 'source:manual', 'all')).toHaveLength(1);
  });

  it('filters by direction', () => {
    expect(searchFrames(frames, '', 'inbound')).toEqual([frames[0]]);
  });

  it('resends as a new outbound frame without mutating history', () => {
    const resent = resendFrame(frames[0], '2026-04-29T10:02:00.000Z');
    expect(resent).toMatchObject({ id: 'new-id', direction: 'outbound', body: frames[0].body });
    expect(resent.metadata.resentFrom).toBe('a');
    expect(frames[0].direction).toBe('inbound');
    expect(frames[0].metadata).toEqual({ opcode: 'text' });
  });
});
