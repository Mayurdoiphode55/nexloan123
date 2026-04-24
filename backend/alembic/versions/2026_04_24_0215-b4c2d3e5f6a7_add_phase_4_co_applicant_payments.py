"""add phase 4 co applicant and payments

Revision ID: b4c2d3e5f6a7
Revises: a3f1b2c4d5e6
Create Date: 2026-04-24 02:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b4c2d3e5f6a7'
down_revision: Union[str, None] = 'a3f1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add co-applicant columns to loans
    op.add_column('loans', sa.Column('has_co_applicant', sa.Boolean(), default=False, nullable=True))
    op.add_column('loans', sa.Column('combined_income', sa.Float(), nullable=True))
    op.add_column('loans', sa.Column('combined_existing_emi', sa.Float(), nullable=True))
    op.add_column('loans', sa.Column('combined_credit_score', sa.Integer(), nullable=True))
    op.add_column('loans', sa.Column('combined_score_breakdown', sa.JSON(), nullable=True))
    op.add_column('loans', sa.Column('individual_qualified', sa.Boolean(), nullable=True))
    op.add_column('loans', sa.Column('combined_qualified', sa.Boolean(), nullable=True))

    # Create co_applicants table
    op.create_table(
        'co_applicants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id'), nullable=False, index=True),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('relationship', sa.String(50), nullable=False),
        sa.Column('phone', sa.String(15), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('monthly_income', sa.Float(), nullable=False),
        sa.Column('employment_type', sa.String(20), nullable=True),
        sa.Column('existing_emi', sa.Float(), default=0.0),
        sa.Column('pan_number', sa.String(20), nullable=True),
        sa.Column('individual_credit_score', sa.Integer(), nullable=True),
        sa.Column('individual_score_breakdown', sa.JSON(), nullable=True),
        sa.Column('consent_given', sa.Boolean(), default=False),
        sa.Column('consent_timestamp', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Create co_applicant_kyc table
    op.create_table(
        'co_applicant_kyc',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('co_applicant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('co_applicants.id'), nullable=False),
        sa.Column('document_type', sa.String(20), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('verification_status', sa.String(20), default='PENDING'),
        sa.Column('extracted_data', sa.JSON(), nullable=True),
        sa.Column('ai_confidence', sa.Float(), nullable=True),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
    )

    # Create payments table
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('loan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('loans.id'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('emi_installment_no', sa.Integer(), nullable=False),
        sa.Column('razorpay_order_id', sa.String(100), nullable=True, unique=True),
        sa.Column('razorpay_payment_id', sa.String(100), nullable=True),
        sa.Column('razorpay_signature', sa.String(256), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(10), default='INR'),
        sa.Column('status', sa.String(20), default='CREATED'),
        sa.Column('method', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('payments')
    op.drop_table('co_applicant_kyc')
    op.drop_table('co_applicants')
    for col in ['has_co_applicant', 'combined_income', 'combined_existing_emi',
                'combined_credit_score', 'combined_score_breakdown', 'individual_qualified', 'combined_qualified']:
        op.drop_column('loans', col)
