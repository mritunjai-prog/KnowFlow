"""M5 meeting summary and decision state."""

from alembic import op
import sqlalchemy as sa

revision = "005_m5_meetings"
down_revision = "004_m4_retrieval"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("meetings", sa.Column("summary", sa.Text()))
    op.add_column("meetings", sa.Column("decisions_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("meetings", sa.Column("summary_state", sa.String(16), nullable=False, server_default="empty"))
    op.add_column("meetings", sa.Column("evidence_hash", sa.String(64)))


def downgrade() -> None:
    op.drop_column("meetings", "evidence_hash")
    op.drop_column("meetings", "summary_state")
    op.drop_column("meetings", "decisions_json")
    op.drop_column("meetings", "summary")
