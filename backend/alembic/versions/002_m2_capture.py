"""M2 capture, durable jobs, documents and timeline."""

from alembic import op
import sqlalchemy as sa

revision = "002_m2_capture"
down_revision = "001_m1_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name, column in (
        ("updated_at", sa.Column("updated_at", sa.DateTime(timezone=True))),
        ("source_type", sa.Column("source_type", sa.String(16), nullable=False, server_default="text")),
        ("document_type", sa.Column("document_type", sa.String(64), nullable=False, server_default="other")),
        ("tags", sa.Column("tags", sa.Text(), nullable=False, server_default="[]")),
        ("text", sa.Column("text", sa.Text(), nullable=False, server_default="")),
        ("summary", sa.Column("summary", sa.Text())),
        ("meeting_id", sa.Column("meeting_id", sa.String(40))),
        ("original_key", sa.Column("original_key", sa.String(240))),
        ("original_name", sa.Column("original_name", sa.String(200))),
        ("original_type", sa.Column("original_type", sa.String(120))),
        ("processed_key", sa.Column("processed_key", sa.String(240))),
        ("thumbnail_key", sa.Column("thumbnail_key", sa.String(240))),
        ("index_state", sa.Column("index_state", sa.String(16), nullable=False, server_default="pending")),
    ):
        op.add_column("documents", column)
    for name, column in (
        ("updated_at", sa.Column("updated_at", sa.DateTime(timezone=True))),
        ("stage", sa.Column("stage", sa.String(160), nullable=False, server_default="Waiting for the next processing step.")),
        ("progress", sa.Column("progress", sa.Integer(), nullable=False, server_default="0")),
        ("error", sa.Column("error", sa.Text())),
        ("retryable", sa.Column("retryable", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("meeting_id", sa.Column("meeting_id", sa.String(40))),
        ("lease_until", sa.Column("lease_until", sa.DateTime(timezone=True))),
        ("cancel_requested", sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("payload_json", sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}")),
    ):
        op.add_column("jobs", column)
    op.create_table(
        "job_items",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("job_id", sa.String(40), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("document_id", sa.String(40)),
        sa.Column("error", sa.Text()),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("media_type", sa.String(120)),
        sa.Column("object_key", sa.String(240)),
        sa.Column("text_payload", sa.Text()),
        sa.Column("step", sa.String(24), nullable=False),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("partial_text", sa.Text(), nullable=False),
        sa.Column("processed_key", sa.String(240)),
        sa.Column("thumbnail_key", sa.String(240)),
        sa.Column("preprocess_note", sa.Text()),
        sa.Column("attempts", sa.Integer(), nullable=False),
    )
    op.create_table(
        "meetings",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "timeline_events",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("excerpt", sa.Text()),
        sa.Column("page", sa.Integer()),
        sa.Column("meeting_id", sa.String(40)),
    )
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idem_key", sa.String(200), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("job_id", sa.String(40), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "idem_key", name="uq_idem_user_key"),
    )


def downgrade() -> None:
    op.drop_table("idempotency_records")
    op.drop_table("timeline_events")
    op.drop_table("meetings")
    op.drop_table("job_items")
    for name in (
        "payload_json",
        "cancel_requested",
        "lease_until",
        "meeting_id",
        "retryable",
        "error",
        "progress",
        "stage",
        "updated_at",
    ):
        op.drop_column("jobs", name)
    for name in (
        "index_state",
        "thumbnail_key",
        "processed_key",
        "original_type",
        "original_name",
        "original_key",
        "meeting_id",
        "summary",
        "text",
        "tags",
        "document_type",
        "source_type",
        "updated_at",
    ):
        op.drop_column("documents", name)
