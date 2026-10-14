export type Role = 'user' | 'admin';
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  onboardingComplete: boolean;
};
export type Session = { user: User | null; csrfToken: string };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type FileSource = { url: string; mediaType: string; name: string };
export type Source = {
  documentId: string;
  title: string;
  page?: number;
  excerpt?: string;
  region?: [number, number, number, number];
};
export type DocumentRecord = {
  id: string;
  title: string;
  createdAt: string;
  sourceType: 'scanned' | 'digital' | 'text' | 'audio';
  documentType: string;
  tags: string[];
  text: string;
  original: FileSource | null;
  processed: FileSource | null;
  thumbnailUrl: string | null;
  summary: string | null;
  meetingId: string | null;
  permission: 'owner' | 'edit' | 'view';
};
export type Task = {
  id: string;
  description: string;
  status: 'pending' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  source: Source;
  meetingId: string | null;
};
export type Job = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  stage: string;
  progress: number;
  items: {
    name: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    documentId: string | null;
    error: string | null;
  }[];
  error: string | null;
  retryable: boolean;
  meetingId: string | null;
};
export type Meeting = {
  id: string;
  title: string;
  occurredAt: string;
  summary: string | null;
  decisions: string[];
  documents: DocumentRecord[];
  tasks: Task[];
};
export type ModelOption = { id: string; label: string; available: boolean };
export type Capabilities = {
  acceptedMimeTypes: string[];
  maxFileBytes: number;
  maxBatchFiles: number;
  maxTextCharacters: number;
  maxRecordingSeconds: number;
  captureSources: string[];
  documentTypes: string[];
  topics: string[];
  models: ModelOption[];
  multimodal: boolean;
  transcription: boolean;
};
export type Settings = {
  name: string;
  email: string;
  captureSource: string;
  modelId: string | null;
};
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  sources: Source[];
  insufficientEvidence: boolean;
};
export type Conversation = { id: string; title: string; updatedAt: string; messages: Message[] };
export type Answer = { conversationId: string; userMessage: Message; answer: Message };
export type TimelineEvent = {
  id: string;
  occurredAt: string;
  title: string;
  type: string;
  source: Source | null;
  meetingId: string | null;
};
export type Share = {
  id: string;
  email: string;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted';
};
export type Analytics = {
  documentCount: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  studyMinutes: number | null;
  studyTimeDefinition: string;
  topicCoverage: { topic: string; count: number }[];
  activity: { date: string; documents: number; completedTasks: number }[];
  period: { from: string; to: string };
};
export type AdminConfig = {
  storageLimitBytes: number;
  defaultModelId: string | null;
  captureSources: string[];
};
export type AdminStatus = {
  storageUsedBytes: number;
  documentCount: number;
  queuedJobs: number;
  failedJobs: number;
  services: { name: string; status: 'ready' | 'unavailable' | 'degraded'; message: string }[];
};
export type Invitation = {
  id: string;
  documentId: string;
  documentTitle: string;
  ownerName: string;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted' | 'declined';
};
