from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class UserOut(APIModel):
    id: str
    name: str
    email: str
    role: Literal["user", "admin"]
    onboardingComplete: bool


class SessionOut(APIModel):
    user: UserOut | None
    csrfToken: str


class LoginInput(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegisterInput(APIModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)


class PasswordInput(APIModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=12, max_length=128)


class ConfirmInput(APIModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=1, max_length=128)


class SettingsOut(APIModel):
    name: str
    email: str
    captureSource: str
    modelId: str | None


class OnboardingInput(APIModel):
    complete: Literal[True]


class ModelOption(APIModel):
    id: str
    label: str
    available: bool


class CapabilitiesOut(APIModel):
    acceptedMimeTypes: list[str]
    maxFileBytes: int
    maxBatchFiles: int
    maxTextCharacters: int
    maxRecordingSeconds: int
    captureSources: list[str]
    documentTypes: list[str]
    topics: list[str]
    models: list[ModelOption]
    multimodal: bool
    transcription: bool


class AdminConfigOut(APIModel):
    storageLimitBytes: int
    defaultModelId: str | None
    captureSources: list[str]


class ServiceHealth(APIModel):
    name: str
    status: Literal["ready", "unavailable", "degraded"]
    message: str


class AdminStatusOut(APIModel):
    storageUsedBytes: int
    documentCount: int
    queuedJobs: int
    failedJobs: int
    services: list[ServiceHealth]


class JobItemOut(APIModel):
    name: str
    status: Literal["queued", "running", "succeeded", "failed"]
    documentId: str | None
    error: str | None


class JobOut(APIModel):
    id: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    stage: str
    progress: float
    items: list[JobItemOut]
    error: str | None
    retryable: bool
    meetingId: str | None


class FileSourceOut(APIModel):
    url: str
    mediaType: str
    name: str


class SourceOut(APIModel):
    documentId: str
    title: str
    page: int | None = None
    excerpt: str | None = None


class DocumentOut(APIModel):
    id: str
    title: str
    createdAt: str
    sourceType: Literal["scanned", "digital", "text", "audio"]
    documentType: str
    tags: list[str]
    text: str
    original: FileSourceOut | None
    processed: FileSourceOut | None
    thumbnailUrl: str | None
    summary: str | None
    meetingId: str | None
    permission: Literal["owner", "edit", "view"]


class DocumentPage(APIModel):
    items: list[DocumentOut]
    total: int
    page: int
    pageSize: int


class TimelineOut(APIModel):
    id: str
    occurredAt: str
    title: str
    type: str
    source: SourceOut | None
    meetingId: str | None


class TimelinePage(APIModel):
    items: list[TimelineOut]
    total: int
    page: int
    pageSize: int


class DocumentPatchIn(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    documentType: str | None = None
    tags: list[str] | None = None
    text: str | None = None
