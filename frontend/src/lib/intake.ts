import type { Capabilities } from '../api/types';
export function validateFiles(files: File[], limits: Capabilities): string | null {
  if (files.length > limits.maxBatchFiles)
    return `Choose no more than ${limits.maxBatchFiles} files per batch.`;
  for (const file of files) {
    if (!file.size) return `${file.name} is empty.`;
    if (!limits.acceptedMimeTypes.includes(file.type))
      return `${file.name} has an unsupported or unknown file type.`;
    if (file.type.startsWith('audio/') && !limits.transcription)
      return 'Audio transcription is not configured on the server.';
    if (file.size > limits.maxFileBytes) return `${file.name} exceeds the upload size limit.`;
  }
  return null;
}
