"""Add Phase 2 Enterprise — new tables and column additions

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-28 18:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── Users table — employee/department fields ──────────────────────────
    op.add_column('users', sa.Column('department', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('branch_location', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('employee_id', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('reporting_manager_id', postgresql.UUID(as_uuid=True),
                                      sa.ForeignKey('users.id'), nullable=True))

    # ─── Loans table — collateral fields ───────────────────────────────────
    op.add_column('loans', sa.Column('loan_type', sa.String(30), server_default='NON_COLLATERAL', nullable=True))
    op.add_column('loans', sa.Column('collateral_type', sa.String(50), nullable=True))
    op.add_column('loans', sa.Column('collateral_value', sa.Float, nullable=True))
    op.add_column('loans', sa.Column('collateral_description', sa.Text, nullable=True))
    op.add_column('loans', sa.Column('lien_document_url', sa.String(500), nullable=True))

    # ─── Pre-Closure Requests ──────────────────────────────────────────────
    op.create_table(
        'pre_closure_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('token', sa.String(128), unique=True, nullable=False, index=True),
        sa.Column('token_expires_at', sa.DateTime, nullable=False),
        sa.Column('outstanding_principal', sa.Float, nullable=False),
        sa.Column('pre_closure_charge', sa.Float, nullable=False),
        sa.Column('total_settlement_amount', sa.Float, nullable=False),
        sa.Column('status', sa.String(20), server_default='PENDING', nullable=False),
        sa.Column('terms_accepted', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('terms_accepted_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
    )

    # ─── Admin Delegations ─────────────────────────────────────────────────
    op.create_table(
        'admin_delegations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('delegator_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('delegate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('permissions', postgresql.JSON, nullable=False),
        sa.Column('start_date', sa.DateTime, nullable=False),
        sa.Column('end_date', sa.DateTime, nullable=False),
        sa.Column('is_active', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
    )

    # ─── Loan Enquiries ────────────────────────────────────────────────────
    op.create_table(
        'loan_enquiries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('mobile', sa.String(15), nullable=False),
        sa.Column('email', sa.String(200), nullable=True),
        sa.Column('loan_type', sa.String(50), nullable=True),
        sa.Column('approx_amount', sa.Float, nullable=True),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), server_default='NEW', nullable=False),
        sa.Column('claimed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('converted_loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
    )

    # ─── Announcements ─────────────────────────────────────────────────────
    op.create_table(
        'announcements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('expiry_date', sa.DateTime, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('announcements')
    op.drop_table('loan_enquiries')
    op.drop_table('admin_delegations')
    op.drop_table('pre_closure_requests')

    op.drop_column('loans', 'lien_document_url')
    op.drop_column('loans', 'collateral_description')
    op.drop_column('loans', 'collateral_value')
    op.drop_column('loans', 'collateral_type')
    op.drop_column('loans', 'loan_type')

    op.drop_column('users', 'reporting_manager_id')
    op.drop_column('users', 'employee_id')
    op.drop_column('users', 'branch_location')
    op.drop_column('users', 'department')
