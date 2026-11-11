import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_serializer


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
    region: list[float] | None = None

    @model_serializer(mode="wrap")
    def _omit_absent(self, handler):
        data = handler(self)
        return {key: value for key, value in data.items() if value is not None}


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


class ShareOut(APIModel):
    id: str
    email: str
    permission: Literal["view", "edit"]
    status: Literal["pending", "accepted"]


class ShareIn(APIModel):
    email: EmailStr
    permission: Literal["view", "edit"]


class SharePatchIn(APIModel):
    permission: Literal["view", "edit"]


class ShareListOut(APIModel):
    items: list[ShareOut]


class InvitationOut(APIModel):
    id: str
    documentId: str
    documentTitle: str
    ownerName: str
    permission: Literal["view", "edit"]
    status: Literal["pending", "accepted", "declined"]


class InvitationListOut(APIModel):
    items: list[InvitationOut]


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


def _calendar_date(value: str | None) -> str | None:
    if value is None:
        return None
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Use YYYY-MM-DD.")
    datetime.strptime(value, "%Y-%m-%d")
    return value


class TaskIn(APIModel):
    description: str = Field(min_length=1, max_length=2000)
    priority: Literal["low", "medium", "high"]
    dueDate: str | None
    sourceDocumentId: str = Field(min_length=1)

    @field_validator("dueDate")
    @classmethod
    def due_date(cls, value: str | None) -> str | None:
        return _calendar_date(value)

    @field_validator("description")
    @classmethod
    def description_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Description is required.")
        return cleaned


class TaskPatch(APIModel):
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    priority: Literal["low", "medium", "high"] | None = None
    dueDate: str | None = None
    status: Literal["pending", "completed"] | None = None

    @field_validator("dueDate")
    @classmethod
    def due_date(cls, value: str | None) -> str | None:
        return _calendar_date(value)

    @field_validator("description")
    @classmethod
    def description_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Description is required.")
        return cleaned


class TaskOut(APIModel):
    id: str
    description: str
    status: Literal["pending", "completed"]
    priority: Literal["low", "medium", "high"]
    dueDate: str | None
    source: SourceOut
    meetingId: str | None


class TaskPage(APIModel):
    items: list[TaskOut]
    total: int
    page: int
    pageSize: int


class MeetingIn(APIModel):
    title: str = Field(min_length=1, max_length=200)
    occurredAt: str = Field(min_length=1)


class MeetingOut(APIModel):
    id: str
    title: str
    occurredAt: str
    summary: str | None
    decisions: list[str]
    documents: list[DocumentOut]
    tasks: list[TaskOut]


class MeetingPage(APIModel):
    items: list[MeetingOut]
    total: int
    page: int
    pageSize: int


class MessageOut(APIModel):
    id: str
    role: Literal["user", "assistant"]
    text: str
    createdAt: str
    sources: list[SourceOut]
    insufficientEvidence: bool


class ConversationOut(APIModel):
    id: str
    title: str
    updatedAt: str
    messages: list[MessageOut]


class ConversationPage(APIModel):
    items: list[ConversationOut]
    total: int
    page: int
    pageSize: int


class AnswerOut(APIModel):
    conversationId: str
    userMessage: MessageOut
    answer: MessageOut


class QueryJobOut(APIModel):
    id: str
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"]
    stage: str
    conversationId: str | None
    answer: AnswerOut | None
    error: str | None


class StudyStartIn(APIModel):
    documentId: str | None = None

    @field_validator("documentId")
    @classmethod
    def _document_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned or len(cleaned) > 40:
            raise ValueError("invalid document id")
        return cleaned


class StudyRevisionIn(APIModel):
    revision: int = Field(ge=1, le=1_000_000)
