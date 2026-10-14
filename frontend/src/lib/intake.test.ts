import { describe, expect, it } from 'vitest';
import { validateFiles } from './intake';
import { tags } from './utils';
import type { Capabilities } from '../api/types';
const capabilities: Capabilities = {
  acceptedMimeTypes: ['text/plain', 'image/png', 'audio/webm'],
  maxFileBytes: 20,
  maxBatchFiles: 2,
  maxTextCharacters: 100,
  maxRecordingSeconds: 60,
  captureSources: ['file', 'camera', 'text', 'audio'],
  documentTypes: [],
  topics: [],
  models: [],
  multimodal: false,
  transcription: true,
};
describe('intake validation', () => {
  it('accepts a supported nonempty file', () =>
    expect(
      validateFiles([new File(['a'], 'note.txt', { type: 'text/plain' })], capabilities),
    ).toBeNull());
  it('rejects unsupported content types', () =>
    expect(
      validateFiles([new File(['a'], 'script.html', { type: 'text/html' })], capabilities),
    ).toContain('unsupported'));
  it('rejects empty files', () =>
    expect(
      validateFiles([new File([], 'empty.txt', { type: 'text/plain' })], capabilities),
    ).toContain('empty'));
  it('enforces byte and batch limits', () => {
    const file = new File(['a'.repeat(30)], 'large.txt', { type: 'text/plain' });
    expect(validateFiles([file], capabilities)).toContain('size limit');
    expect(validateFiles([file, file, file], capabilities)).toContain('no more than 2');
  });
  it('requires configured transcription', () =>
    expect(
      validateFiles([new File(['a'], 'audio.webm', { type: 'audio/webm' })], {
        ...capabilities,
        transcription: false,
      }),
    ).toContain('not configured'));
  it('normalizes topic corrections without duplicates', () =>
    expect(tags('ML, React, ML, , React ')).toEqual(['ML', 'React']));
});
