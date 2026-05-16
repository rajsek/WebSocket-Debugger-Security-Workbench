import {
  clearReplayLibrary,
  deleteReplayArtifact,
  exportReplayArtifacts,
  importReplayArtifactsJson,
  loadReplayLibrary,
  saveReplayArtifact,
} from './replayStorage';
import { createSavedSocketRecipeFromTarget } from '../domain/replay';
import { initialTargetContext } from '../domain/reducer';
import type { SavedReplayArtifact } from '../domain/types';

class MemoryArea {
  data: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.data ? { [key]: this.data[key] } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    this.data = { ...this.data, ...items };
  }

  async remove(key: string): Promise<void> {
    delete this.data[key];
  }
}

describe('replay storage adapter', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${Math.random()}`) });
  });

  it('persists, exports, imports, deletes, and clears artifacts through the adapter', async () => {
    const area = new MemoryArea();
    const artifact = createSavedSocketRecipeFromTarget({
      target: { ...initialTargetContext, socketUrl: 'wss://example.com/socket' },
      now: '2026-05-16T10:00:00.000Z',
    });

    await saveReplayArtifact(artifact, area);
    expect(await loadReplayLibrary(area)).toEqual([artifact]);

    const exported = exportReplayArtifacts([artifact], true);
    expect(importReplayArtifactsJson(exported)).toEqual([artifact]);

    await deleteReplayArtifact(artifact.id, area);
    expect(await loadReplayLibrary(area)).toEqual([]);

    await saveReplayArtifact(artifact, area);
    await clearReplayLibrary(area);
    expect(await loadReplayLibrary(area)).toEqual([]);
  });

  it('requires raw-payload confirmation and rejects unsupported versions', () => {
    const artifact = createSavedSocketRecipeFromTarget({
      target: { ...initialTargetContext, socketUrl: 'wss://example.com/socket' },
      now: '2026-05-16T10:00:00.000Z',
    });

    expect(() => exportReplayArtifacts([artifact], false)).toThrow(/requires confirmation/);
    expect(() => importReplayArtifactsJson(JSON.stringify([{ ...artifact, schemaVersion: 999 }]))).toThrow(/Unsupported replay artifact version/);
  });
});
