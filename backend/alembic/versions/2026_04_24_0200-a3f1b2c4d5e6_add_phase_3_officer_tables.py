"""add phase 3 officer tables

Revision ID: a3f1b2c4d5e6
Revises: d862e298c0e6
Create Date: 2026-04-24 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3f1b2c4d5e6'
down_revision: Union[str, None] = 'd862e298c0e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add officer decision columns to loans table
    op.add_column('loans', sa.Column('officer_override_reason', sa.Text(), nullable=True))
    op.add_column('loans', sa.Column('ai_recommendation', sa.String(20), nullable=True))
    op.add_column('loans', sa.Column('officer_decision', sa.String(20), nullable=True))

    # Create loan_notes table
    op.create_table(
        'loan_notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id'), nullable=False, index=True),
        sa.Column('officer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_internal', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Create officer_assignments table
    op.create_table(
        'officer_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id'), nullable=False, index=True),
        sa.Column('officer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(20), default='ACTIVE', nullable=False),
    )

    # Create document_requests table
    op.create_table(
        'document_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id'), nullable=False, index=True),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('document_type', sa.String(100), nullable=False),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), default='REQUESTED', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('document_requests')
    op.drop_table('officer_assignments')
    op.drop_table('loan_notes')
    op.drop_column('loans', 'officer_decision')
    op.drop_column('loans', 'ai_recommendation')
    op.drop_column('loans', 'officer_override_reason')
