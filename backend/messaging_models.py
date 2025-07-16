#!/usr/bin/env python3
"""
Private Messaging System Models
Provides database models for private messaging functionality
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from extensions import db


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
    Participant in a conversation - links users to conversations
    """
    __tablename__ = 'conversation_participants'
    
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)  # False if user left conversation
    role = Column(String(50), default='member')  # member, admin, owner (for group chats)
    
    # Relationships
    conversation = relationship('Conversation', back_populates='participants')
    user = relationship('User')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_participant_conversation', 'conversation_id'),
        Index('idx_participant_user', 'user_id'),
        Index('idx_participant_active', 'is_active'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'user_id': self.user_id,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'last_read_at': self.last_read_at.isoformat() if self.last_read_at else None,
            'is_active': self.is_active,
            'role': self.role
        }


class PrivateMessage(db.Model):
    """
    Private message model - represents individual messages in conversations
    """
    __tablename__ = 'private_messages'
    
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(50), default='text')  # text, image, file, system
    created_at = Column(DateTime, default=datetime.utcnow)
    edited_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)
    
    # File attachment fields (for image/file messages)
    attachment_filename = Column(String(255), nullable=True)
    attachment_path = Column(String(500), nullable=True)
    attachment_size = Column(Integer, nullable=True)
    attachment_mime_type = Column(String(100), nullable=True)
    
    # Relationships
    conversation = relationship('Conversation', back_populates='messages')
    sender = relationship('User')
    read_receipts = relationship('MessageReadReceipt', back_populates='message', cascade='all, delete-orphan')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_message_conversation', 'conversation_id'),
        Index('idx_message_sender', 'sender_id'),
        Index('idx_message_created', 'created_at'),
        Index('idx_message_type', 'message_type'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'sender_id': self.sender_id,
            'content': self.content,
            'message_type': self.message_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'edited_at': self.edited_at.isoformat() if self.edited_at else None,
            'is_deleted': self.is_deleted,
            'attachment_filename': self.attachment_filename,
            'attachment_path': self.attachment_path,
            'attachment_size': self.attachment_size,
            'attachment_mime_type': self.attachment_mime_type
        }


class MessageReadReceipt(db.Model):
    """
    Read receipt model - tracks when users read messages
    """
    __tablename__ = 'message_read_receipts'
    
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey('private_messages.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
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
            'read_at': self.read_at.isoformat() if self.read_at else None
        }


class UserPresence(db.Model):
    """
    User presence model - tracks online/offline status
    """
    __tablename__ = 'user_presence'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    status = Column(String(50), default='offline')  # online, offline, away, busy
    last_activity = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    custom_status = Column(String(255), nullable=True)  # Custom status message
    
    # Relationships
    user = relationship('User')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_presence_user', 'user_id'),
        Index('idx_presence_status', 'status'),
        Index('idx_presence_last_activity', 'last_activity'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'status': self.status,
            'last_activity': self.last_activity.isoformat() if self.last_activity else None,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'custom_status': self.custom_status
        }


# Helper functions for messaging operations
def get_or_create_conversation(user1_id, user2_id, title=None):
    """
    Get existing conversation between two users or create a new one
    """
    # Check if conversation already exists between these users
    existing_conv = db.session.query(Conversation).join(ConversationParticipant).filter(
        ConversationParticipant.user_id.in_([user1_id, user2_id]),
        Conversation.is_group == False
    ).group_by(Conversation.id).having(
        db.func.count(ConversationParticipant.id) == 2
    ).first()
    
    if existing_conv:
        # Verify both users are participants
        participant_ids = [p.user_id for p in existing_conv.participants]
        if user1_id in participant_ids and user2_id in participant_ids:
            return existing_conv
    
    # Create new conversation
    conversation = Conversation(title=title, is_group=False)
    db.session.add(conversation)
    db.session.flush()  # Get the ID
    
    # Add participants
    participant1 = ConversationParticipant(conversation_id=conversation.id, user_id=user1_id)
    participant2 = ConversationParticipant(conversation_id=conversation.id, user_id=user2_id)
    
    db.session.add(participant1)
    db.session.add(participant2)
    db.session.commit()
    
    return conversation


def mark_messages_as_read(conversation_id, user_id, up_to_message_id=None):
    """
    Mark messages as read for a user in a conversation
    """
    # Update participant's last_read_at
    participant = ConversationParticipant.query.filter_by(
        conversation_id=conversation_id,
        user_id=user_id
    ).first()
    
    if participant:
        participant.last_read_at = datetime.utcnow()
        
        # Get messages to mark as read
        query = PrivateMessage.query.filter_by(conversation_id=conversation_id)
        if up_to_message_id:
            query = query.filter(PrivateMessage.id <= up_to_message_id)
        
        messages = query.all()
        
        # Create read receipts for messages not already read
        for message in messages:
            if message.sender_id != user_id:  # Don't create receipts for own messages
                existing_receipt = MessageReadReceipt.query.filter_by(
                    message_id=message.id,
                    user_id=user_id
                ).first()
                
                if not existing_receipt:
                    receipt = MessageReadReceipt(message_id=message.id, user_id=user_id)
                    db.session.add(receipt)
        
        db.session.commit()
        return True
    
    return False


def get_unread_count(user_id, conversation_id=None):
    """
    Get unread message count for a user
    """
    if conversation_id:
        # Get unread count for specific conversation
        participant = ConversationParticipant.query.filter_by(
            conversation_id=conversation_id,
            user_id=user_id
        ).first()
        
        if not participant:
            return 0
        
        unread_count = PrivateMessage.query.filter(
            PrivateMessage.conversation_id == conversation_id,
            PrivateMessage.sender_id != user_id,
            PrivateMessage.created_at > participant.last_read_at
        ).count()
        
        return unread_count
    else:
        # Get total unread count across all conversations
        user_conversations = ConversationParticipant.query.filter_by(
            user_id=user_id,
            is_active=True
        ).all()
        
        total_unread = 0
        for participant in user_conversations:
            unread_count = PrivateMessage.query.filter(
                PrivateMessage.conversation_id == participant.conversation_id,
                PrivateMessage.sender_id != user_id,
                PrivateMessage.created_at > participant.last_read_at
            ).count()
            total_unread += unread_count
        
        return total_unread


def update_user_presence(user_id, status='online', custom_status=None):
    """
    Update user presence status
    """
    presence = UserPresence.query.filter_by(user_id=user_id).first()
    
    if not presence:
        presence = UserPresence(user_id=user_id, status=status, custom_status=custom_status)
        db.session.add(presence)
    else:
        presence.status = status
        presence.last_activity = datetime.utcnow()
        if status == 'online':
            presence.last_seen = datetime.utcnow()
        if custom_status is not None:
            presence.custom_status = custom_status
    
    db.session.commit()
    return presence

