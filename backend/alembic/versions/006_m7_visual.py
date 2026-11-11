"""M7 visual regions, separate from text embeddings."""

from alembic import op
import sqlalchemy as sa

revision = "006_m7_visual"
down_revision = "005_m5_meetings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_items", sa.Column("page_images_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("query_jobs", sa.Column("image_key", sa.String(240)))
    op.add_column("query_jobs", sa.Column("image_media", sa.String(120)))
    op.add_column("query_jobs", sa.Column("visual_vector_json", sa.Text()))
    op.create_table(
        "page_images",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("image_key", sa.String(240), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "visual_regions",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("document_id", sa.String(40), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("image_key", sa.String(240), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("model_id", sa.String(80)),
        sa.Column("dimension", sa.Integer()),
        sa.Column("embedding_json", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE visual_regions ADD COLUMN embedding vector(768)")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE visual_regions DROP COLUMN IF EXISTS embedding")
    op.drop_table("visual_regions")
    op.drop_table("page_images")
    op.drop_column("query_jobs", "visual_vector_json")
    op.drop_column("query_jobs", "image_media")
    op.drop_column("query_jobs", "image_key")
    op.drop_column("job_items", "page_images_json")
