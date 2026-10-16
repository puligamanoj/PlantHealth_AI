from alembic import op
import sqlalchemy as sa
revision = "0001_diagnoses"
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("diagnoses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("predicted_class", sa.String(length=255), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("model_version", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("advice_note", sa.Text(), nullable=False))
    op.create_index("ix_diagnoses_id", "diagnoses", ["id"])
def downgrade():
    op.drop_index("ix_diagnoses_id", table_name="diagnoses")
    op.drop_table("diagnoses")
