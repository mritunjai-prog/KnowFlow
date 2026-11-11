"""M8 invitation expiry. Live access remains an accepted grant."""

from alembic import op
import sqlalchemy as sa

revision = "007_m8_sharing"
down_revision = "006_m7_visual"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("document_grants", sa.Column("expires_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("document_grants", "expires_at")
