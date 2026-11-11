"""M3 classification state and source-linked tasks."""

from alembic import op
import sqlalchemy as sa

revision = "003_m3_tasks"
down_revision = "002_m2_capture"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name, column in (
        ("index_version", sa.Column("index_version", sa.Integer(), nullable=False, server_default="0")),
        ("retrieval_invalidated_at", sa.Column("retrieval_invalidated_at", sa.DateTime(timezone=True))),
        ("classifier_id", sa.Column("classifier_id", sa.String(80))),
        ("classification_json", sa.Column("classification_json", sa.Text())),
        ("type_locked", sa.Column("type_locked", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("tags_locked", sa.Column("tags_locked", sa.Boolean(), nullable=False, server_default=sa.false())),
        ("labels_origin", sa.Column("labels_origin", sa.String(16), nullable=False, server_default="user")),
    ):
        op.add_column("documents", column)
    op.add_column("job_items", sa.Column("classification_json", sa.Text()))
    op.add_column("job_items", sa.Column("actions_json", sa.Text()))
    op.create_table(
        "tasks",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("priority", sa.String(16), nullable=False),
        sa.Column("due_date", sa.String(10)),
        sa.Column("page", sa.Integer()),
        sa.Column("excerpt", sa.Text()),
        sa.Column("meeting_id", sa.String(40)),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("fingerprint", sa.String(64)),
        sa.Column("user_edited", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_id", "document_id", "fingerprint", name="uq_task_fingerprint"),
    )
    op.create_table(
        "task_tombstones",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("owner_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_id", "document_id", "fingerprint", name="uq_task_tombstone"),
    )


def downgrade() -> None:
    op.drop_table("task_tombstones")
    op.drop_table("tasks")
    op.drop_column("job_items", "actions_json")
    op.drop_column("job_items", "classification_json")
    for name in (
        "labels_origin",
        "tags_locked",
        "type_locked",
        "classification_json",
        "classifier_id",
        "retrieval_invalidated_at",
        "index_version",
    ):
        op.drop_column("documents", name)
