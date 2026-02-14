"""initial: all existing models including registry subsystem

Baseline migration. All tables already exist in the database
(created by db.create_all()). This revision serves as the
starting point for future Alembic-managed schema changes.

Tables captured at this baseline:
- users, user_profiles, user_reputation, user_contacts, user_blocks, user_presence
- categories, discussions, posts, post_reaction, post_attachment, post_mention
- file_items, file_chunk, document_index
- conversations, conversation_participants, private_messages,
  message_read_receipts, message_attachments
- notifications, audit_logs, chat_sessions, chat_messages
- structure_types, structures, licenses, sanctions
- inspection_committees, committee_memberships, committee_structure_assignments,
  inspections, inspection_reports
- user_roles, social_advisor_reports

Revision ID: 83a4a9e7661e
Revises:
Create Date: 2026-02-14 18:01:25.749450

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '83a4a9e7661e'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Baseline migration — all tables already exist.
    # For fresh installs, run db.create_all() first, then stamp this revision.
    pass


def downgrade():
    # Cannot downgrade from baseline.
    pass
