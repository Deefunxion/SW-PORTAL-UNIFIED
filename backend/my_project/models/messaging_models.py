#!/usr/bin/env python3
"""
Private Messaging System Models
Provides database models for private messaging functionality
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from .extensions import db

class Conversation(db.Model):
    """
    Conversation model - represents a private conversation between users
    """
    __tablename__ = 'conversations'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=True)  # Optional conversation title
    is_group = Column(Boolean, default=False)  # True for group conversations
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    participants = relationship('ConversationParticipant', back_populates='conversation', cascade='all, delete-orphan')
    messages = relationship('PrivateMessage', back_populates='conversation', cascade='all, delete-orphan')

    # Indexes for performance
    __table_args__ = (
        Index('idx_conversation_updated', 'updated_at'),
        Index('idx_conversation_created', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'is_group': self.is_group,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'participant_count': len(self.participants) if self.participants else 0,
            'message_count': len(self.messages) if self.messages else 0
        }

class ConversationParticipant(db.Model):
    """
    Conversation participants - many-to-many relationship between users and conversations
    """
    __tablename__ = 'conversation_participants'

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime, nullable=True)  # For unread message tracking
    is_active = Column(Boolean, default=True)  # False if user left the conversation
    role = Column(String(50), default='member')  # member, admin (for group conversations)

    # Relationships
    conversation = relationship('Conversation', back_populates='participants')
    user = relationship('User')

    # Indexes for performance
    __table_args__ = (
        Index('idx_participant_conversation', 'conversation_id'),
        Index('idx_participant_user', 'user_id'),
        Index('idx_participant_active', 'is_active'),
        Index('idx_participant_last_read', 'last_read_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'last_read_at': self.last_read_at.isoformat() if self.last_read_at else None,
            'is_active': self.is_active,
            'role': self.role
        }

class PrivateMessage(db.Model):
    """
    Private message model - individual messages within conversations
    """
    __tablename__ = 'private_messages'

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    content_type = Column(String(50), default='text')  # text, rich_html, system
    message_type = Column(String(50), default='message')  # message, system, file_share
    created_at = Column(DateTime, default=datetime.utcnow)
    edited_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)

    # Message status tracking
    is_system_message = Column(Boolean, default=False)  # System messages (user joined, etc.)
    reply_to_id = Column(Integer, ForeignKey('private_messages.id'), nullable=True)  # For message replies

    # Relationships
    conversation = relationship('Conversation', back_populates='messages')
    sender = relationship('User')
    reply_to = relationship('PrivateMessage', remote_side=[id])
    attachments = relationship('MessageAttachment', back_populates='message', cascade='all, delete-orphan')
    read_receipts = relationship('MessageReadReceipt', back_populates='message', cascade='all, delete-orphan')

    # Indexes for performance
    __table_args__ = (
        Index('idx_message_conversation', 'conversation_id'),
        Index('idx_message_sender', 'sender_id'),
        Index('idx_message_created', 'created_at'),
        Index('idx_message_type', 'message_type'),
        Index('idx_message_deleted', 'is_deleted'),
    )

    def to_dict(self, include_read_receipts=False):
        result = {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'sender_id': self.sender_id,
            'sender': self.sender.to_dict() if self.sender else None,
            'content': self.content if not self.is_deleted else '[Μήνυμα διαγράφηκε]',
            'content_type': self.content_type,
            'message_type': self.message_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'edited_at': self.edited_at.isoformat() if self.edited_at else None,
            'is_deleted': self.is_deleted,
            'is_system_message': self.is_system_message,
            'reply_to_id': self.reply_to_id,
            'reply_to': self.reply_to.to_dict() if self.reply_to and not self.reply_to.is_deleted else None,
            'attachment_count': len(self.attachments) if self.attachments else 0
        }

        if include_read_receipts:
            result['read_receipts'] = [receipt.to_dict() for receipt in self.read_receipts]

        return result

class MessageAttachment(db.Model):
    """
    Message attachments - files attached to private messages
    """
    __tablename__ = 'message_attachments'

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey('private_messages.id'), nullable=False)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(100), nullable=False)
    mime_type = Column(String(100), nullable=False)
    is_image = Column(Boolean, default=False)
    thumbnail_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    message = relationship('PrivateMessage', back_populates='attachments')

    # Indexes for performance
    __table_args__ = (
        Index('idx_attachment_message', 'message_id'),
        Index('idx_attachment_type', 'file_type'),
        Index('idx_attachment_image', 'is_image'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.message_id,
            'original_filename': self.original_filename,
            'stored_filename': self.stored_filename,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'mime_type': self.mime_type,
            'is_image': self.is_image,
            'has_thumbnail': bool(self.thumbnail_path),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class MessageReadReceipt(db.Model):
    """
    Message read receipts - track when users read messages
    """
    __tablename__ = 'message_read_receipts'

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey('private_messages.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    message = relationship('PrivateMessage', back_populates='read_receipts')
    user = relationship('User')

    # Indexes for performance
    __table_args__ = (
        Index('idx_receipt_message', 'message_id'),
        Index('idx_receipt_user', 'user_id'),
        Index('idx_receipt_read_at', 'read_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.message_id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'read_at': self.read_at.isoformat() if self.read_at else None
        }

class UserPresence(db.Model):
    """
    User presence tracking - online/offline status
    """
    __tablename__ = 'user_presence'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    status = Column(String(50), default='offline')  # online, away, busy, offline
    last_seen = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    custom_status = Column(String(255), nullable=True)  # Custom status message

    # Relationships
    user = relationship('User')

    # Indexes for performance
    __table_args__ = (
        Index('idx_presence_user', 'user_id'),
        Index('idx_presence_status', 'status'),
        Index('idx_presence_last_seen', 'last_seen'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'status': self.status,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'last_activity': self.last_activity.isoformat() if self.last_activity else None,
            'custom_status': self.custom_status,
            'is_online': self.status in ['online', 'away', 'busy']
        }

def create_messaging_models(db):
    """
    Return all messaging models as a dictionary
    """
    return {
        'Conversation': Conversation,
        'ConversationParticipant': ConversationParticipant,
        'PrivateMessage': PrivateMessage,
        'MessageAttachment': MessageAttachment,
        'MessageReadReceipt': MessageReadReceipt,
        'UserPresence': UserPresence
    }

def create_messaging_helper_functions():
    """
    Create helper functions for messaging operations
    """

    def get_or_create_conversation(db, user1_id, user2_id, title=None):
        """
        Get existing conversation between two users or create a new one
        """
        from sqlalchemy import and_, or_

        # Get models
        models = create_messaging_models(db)
        Conversation = models['Conversation']
        ConversationParticipant = models['ConversationParticipant']

        # Find existing conversation between these two users
        existing_conversation = db.session.query(Conversation).join(
            ConversationParticipant
        ).filter(
            and_(
                Conversation.is_group == False,
                ConversationParticipant.user_id.in_([user1_id, user2_id])
            )
        ).group_by(Conversation.id).having(
            db.func.count(ConversationParticipant.user_id) == 2
        ).first()

        if existing_conversation:
            return existing_conversation

        # Create new conversation
        conversation = Conversation(
            title=title,
            is_group=False
        )
        db.session.add(conversation)
        db.session.flush()  # Get the ID

        # Add participants
        participant1 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user1_id
        )
        participant2 = ConversationParticipant(
            conversation_id=conversation.id,
            user_id=user2_id
        )

        db.session.add(participant1)
        db.session.add(participant2)
        db.session.commit()

        return conversation

    def mark_messages_as_read(db, conversation_id, user_id, up_to_message_id=None):
        """
        Mark messages as read for a user in a conversation
        """
        models = create_messaging_models(db)
        ConversationParticipant = models['ConversationParticipant']
        PrivateMessage = models['PrivateMessage']
        MessageReadReceipt = models['MessageReadReceipt']

        # Update participant's last_read_at
        participant = db.session.query(ConversationParticipant).filter_by(
            conversation_id=conversation_id,
            user_id=user_id
        ).first()

        if participant:
            participant.last_read_at = datetime.utcnow()

        # Create read receipts for unread messages
        query = db.session.query(PrivateMessage).filter(
            and_(
                PrivateMessage.conversation_id == conversation_id,
                PrivateMessage.sender_id != user_id,  # Don't mark own messages
                ~db.session.query(MessageReadReceipt).filter(
                    and_(
                        MessageReadReceipt.message_id == PrivateMessage.id,
                        MessageReadReceipt.user_id == user_id
                    )
                ).exists()
            )
        )

        if up_to_message_id:
            query = query.filter(PrivateMessage.id <= up_to_message_id)

        unread_messages = query.all()

        for message in unread_messages:
            receipt = MessageReadReceipt(
                message_id=message.id,
                user_id=user_id
            )
            db.session.add(receipt)

        db.session.commit()

    def get_unread_count(db, user_id):
        """
        Get total unread message count for a user
        """
        models = create_messaging_models(db)
        ConversationParticipant = models['ConversationParticipant']
        PrivateMessage = models['PrivateMessage']
        MessageReadReceipt = models['MessageReadReceipt']

        # Count unread messages across all conversations
        unread_count = db.session.query(PrivateMessage).join(
            ConversationParticipant,
            PrivateMessage.conversation_id == ConversationParticipant.conversation_id
        ).filter(
            and_(
                ConversationParticipant.user_id == user_id,
                ConversationParticipant.is_active == True,
                PrivateMessage.sender_id != user_id,  # Don't count own messages
                or_(
                    ConversationParticipant.last_read_at.is_(None),
                    PrivateMessage.created_at > ConversationParticipant.last_read_at
                )
            )
        ).count()

        return unread_count

    def update_user_presence(db, user_id, status='online', custom_status=None):
        """
        Update user presence status
        """
        models = create_messaging_models(db)
        UserPresence = models['UserPresence']

        presence = db.session.query(UserPresence).filter_by(user_id=user_id).first()

        if not presence:
            presence = UserPresence(user_id=user_id)
            db.session.add(presence)

        presence.status = status
        presence.last_activity = datetime.utcnow()
        if status == 'online':
            presence.last_seen = datetime.utcnow()
        if custom_status is not None:
            presence.custom_status = custom_status

        db.session.commit()
        return presence

    return {
        'get_or_create_conversation': get_or_create_conversation,
        'mark_messages_as_read': mark_messages_as_read,
        'get_unread_count': get_unread_count,
        'update_user_presence': update_user_presence
    }
