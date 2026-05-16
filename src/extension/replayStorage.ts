import {
  assertReplayArtifactSize,
  maxReplayArtifacts,
  validateReplayArtifacts,
} from '../domain/replay';
import type { SavedReplayArtifact } from '../domain/types';

const replayStorageKey = 'ws-workbench:replay-library:v1';
let memoryReplayLibrary: SavedReplayArtifact[] = [];

export interface ReplayStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export async function loadReplayLibrary(area = defaultReplayStorageArea()): Promise<SavedReplayArtifact[]> {
  const result = await area.get(replayStorageKey);
  if (!(replayStorageKey in result)) return [];
  return validateReplayArtifacts(result[replayStorageKey]);
}

export async function saveReplayArtifact(artifact: SavedReplayArtifact, area = defaultReplayStorageArea()): Promise<SavedReplayArtifact[]> {
  assertReplayArtifactSize(artifact);
  const current = await loadReplayLibrary(area);
  const next = [artifact, ...current.filter((candidate) => candidate.id !== artifact.id)];
  await persistReplayLibrary(next, area);
  return next;
}

export async function saveReplayArtifacts(artifacts: SavedReplayArtifact[], area = defaultReplayStorageArea()): Promise<SavedReplayArtifact[]> {
  const current = await loadReplayLibrary(area);
  artifacts.forEach(assertReplayArtifactSize);
  const ids = new Set(artifacts.map((artifact) => artifact.id));
  const next = [...artifacts, ...current.filter((candidate) => !ids.has(candidate.id))];
  await persistReplayLibrary(next, area);
  return next;
}

export async function deleteReplayArtifact(artifactId: string, area = defaultReplayStorageArea()): Promise<SavedReplayArtifact[]> {
  const current = await loadReplayLibrary(area);
  const next = current.filter((artifact) => artifact.id !== artifactId);
  await persistReplayLibrary(next, area);
  return next;
}

export async function clearReplayLibrary(area = defaultReplayStorageArea()): Promise<void> {
  await area.remove(replayStorageKey);
}

export function exportReplayArtifacts(artifacts: SavedReplayArtifact[], rawPayloadConfirmed: boolean): string {
  if (!rawPayloadConfirmed) throw new Error('Export requires confirmation because replay artifacts may contain raw secrets.');
  artifacts.forEach(assertReplayArtifactSize);
  return JSON.stringify(artifacts, null, 2);
}

export function importReplayArtifactsJson(json: string): SavedReplayArtifact[] {
  return validateReplayArtifacts(JSON.parse(json));
}

async function persistReplayLibrary(artifacts: SavedReplayArtifact[], area: ReplayStorageArea): Promise<void> {
  if (artifacts.length > maxReplayArtifacts) throw new Error('Replay library exceeds the v1 artifact limit.');
  await area.set({ [replayStorageKey]: artifacts });
}

function defaultReplayStorageArea(): ReplayStorageArea {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local as unknown as ReplayStorageArea;
  }
  return {
    async get(key: string) {
      return { [key]: memoryReplayLibrary };
    },
    async set(items: Record<string, unknown>) {
      const value = items[replayStorageKey];
      memoryReplayLibrary = Array.isArray(value) ? validateReplayArtifacts(value) : [];
    },
    async remove() {
      memoryReplayLibrary = [];
    },
  };
}
