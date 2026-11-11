"""M9 task-completion events and explicit study intervals."""

from alembic import op
import sqlalchemy as sa

revision = "008_m9_analytics"
down_revision = "007_m8_sharing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.create_table(
        "task_status_events",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.String(40), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(40), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "study_sessions",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("stopped_at", sa.DateTime(timezone=True)),
        sa.Column("confirmed_through", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("pause_reason", sa.String(32)),
        sa.Column("stop_reason", sa.String(32)),
        sa.Column("document_id", sa.String(40)),
        sa.Column("revision", sa.Integer(), nullable=False),
    )
    op.create_table(
        "study_intervals",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("session_id", sa.String(40), sa.ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_through", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "study_idempotency",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idem_key", sa.String(200), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("body_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "idem_key", name="uq_study_idem"),
    )


def downgrade() -> None:
    op.drop_table("study_idempotency")
    op.drop_table("study_intervals")
    op.drop_table("study_sessions")
    op.drop_table("task_status_events")
    op.drop_column("tasks", "completed_at")
