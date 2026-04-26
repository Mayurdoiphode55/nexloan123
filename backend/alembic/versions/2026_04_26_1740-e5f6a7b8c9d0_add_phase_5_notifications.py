"""Add Phase 5 — notifications and callback_requests tables

Revision ID: e5f6a7b8c9d0
Revises: b4c2d3e5f6a7
Create Date: 2026-04-26 17:40:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'e5f6a7b8c9d0'
down_revision = 'b4c2d3e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id', ondelete='CASCADE'), nullable=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('is_read', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Callback requests table
    op.create_table(
        'callback_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id'), nullable=True),
        sa.Column('phone_number', sa.String(15), nullable=False),
        sa.Column('preferred_slot', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Add preferred_language to users table
    op.add_column('users', sa.Column('preferred_language', sa.String(5), server_default='en', nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'preferred_language')
    op.drop_table('callback_requests')
    op.drop_table('notifications')
