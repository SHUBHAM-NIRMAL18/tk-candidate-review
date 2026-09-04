"""001_initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False, server_default='reviewer'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. candidates
    op.create_table(
        'candidates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('role_applied', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='new'),
        sa.Column('skills', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('ai_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_candidates_id'), 'candidates', ['id'], unique=False)
    op.create_index(op.f('ix_candidates_email'), 'candidates', ['email'], unique=True)
    op.create_index(op.f('ix_candidates_role_applied'), 'candidates', ['role_applied'], unique=False)
    op.create_index(op.f('ix_candidates_status'), 'candidates', ['status'], unique=False)

    # 3. scores
    op.create_table(
        'scores',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('candidate_id', sa.String(), nullable=False),
        sa.Column('reviewer_id', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_scores_id'), 'scores', ['id'], unique=False)
    op.create_index(op.f('ix_scores_candidate_id'), 'scores', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_scores_reviewer_id'), 'scores', ['reviewer_id'], unique=False)

    # 4. blacklisted_tokens
    op.create_table(
        'blacklisted_tokens',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('jti', sa.String(length=36), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_blacklisted_tokens_jti'), 'blacklisted_tokens', ['jti'], unique=True)

    # 5. api_keys
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('key_hash', sa.String(), nullable=False),
        sa.Column('prefix', sa.String(), nullable=False),
        sa.Column('scopes', sa.String(), nullable=False, server_default='candidates:read,scores:read'),
        sa.Column('created_by_id', sa.String(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_keys_key_hash'), 'api_keys', ['key_hash'], unique=True)

    # 6. webhooks
    op.create_table(
        'webhooks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('secret', sa.String(), nullable=False),
        sa.Column('events', sa.String(), nullable=False, server_default='candidate.created,candidate.status_changed,score.submitted,summary.generated'),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_triggered_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 7. webhook_deliveries
    op.create_table(
        'webhook_deliveries',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('webhook_id', sa.String(), nullable=False),
        sa.Column('event_name', sa.String(), nullable=False),
        sa.Column('payload', sa.Text(), nullable=False),
        sa.Column('response_status_code', sa.Integer(), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['webhook_id'], ['webhooks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 8. idempotency_keys
    op.create_table(
        'idempotency_keys',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('request_method', sa.String(), nullable=False),
        sa.Column('request_path', sa.String(), nullable=False),
        sa.Column('request_hash', sa.String(), nullable=False),
        sa.Column('response_code', sa.Integer(), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=True),
        sa.Column('response_headers', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='PROCESSING'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_idempotency_keys_key'), 'idempotency_keys', ['key'], unique=False)
    op.create_index(op.f('ix_idempotency_keys_user_id'), 'idempotency_keys', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_idempotency_keys_user_id'), table_name='idempotency_keys')
    op.drop_index(op.f('ix_idempotency_keys_key'), table_name='idempotency_keys')
    op.drop_table('idempotency_keys')

    op.drop_table('webhook_deliveries')
    op.drop_table('webhooks')

    op.drop_index(op.f('ix_api_keys_key_hash'), table_name='api_keys')
    op.drop_table('api_keys')

    op.drop_index(op.f('ix_blacklisted_tokens_jti'), table_name='blacklisted_tokens')
    op.drop_table('blacklisted_tokens')

    op.drop_index(op.f('ix_scores_reviewer_id'), table_name='scores')
    op.drop_index(op.f('ix_scores_candidate_id'), table_name='scores')
    op.drop_index(op.f('ix_scores_id'), table_name='scores')
    op.drop_table('scores')

    op.drop_index(op.f('ix_candidates_status'), table_name='candidates')
    op.drop_index(op.f('ix_candidates_role_applied'), table_name='candidates')
    op.drop_index(op.f('ix_candidates_email'), table_name='candidates')
    op.drop_index(op.f('ix_candidates_id'), table_name='candidates')
    op.drop_table('candidates')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
