"""M4 chunks, pgvector column on Postgres, and saved conversations."""

from alembic import op
import sqlalchemy as sa

revision = "004_m4_retrieval"
down_revision = "003_m3_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("index_version", sa.Integer(), nullable=False),
        sa.Column("model_id", sa.String(80)),
        sa.Column("task_type", sa.String(40)),
        sa.Column("dimension", sa.Integer()),
        sa.Column("embedding_json", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("conversation_id", sa.String(40), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("insufficient_evidence", sa.Boolean(), nullable=False),
        sa.Column("sources_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "query_jobs",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_id", sa.String(40), sa.ForeignKey("conversations.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("stage", sa.String(160), nullable=False),
        sa.Column("step", sa.String(24), nullable=False),
        sa.Column("idem_key", sa.String(200), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("document_ids_json", sa.Text(), nullable=False),
        sa.Column("query_vector_json", sa.Text()),
        sa.Column("error", sa.Text()),
        sa.Column("retryable", sa.Boolean(), nullable=False),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_id", "idem_key", name="uq_query_idem"),
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(768)")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding")
    op.drop_table("query_jobs")
    op.drop_table("conversation_messages")
    op.drop_table("conversations")
    op.drop_table("document_chunks")
