import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  Send, 
  Paperclip, 
  Image, 
  Smile, 
  X, 
  File,
  Mic,
  Bold,
  Italic,
  Code,
  Link,
  AtSign,
  Quote,
  Upload
} from 'lucide-react';

import { useAuth } from './AuthContext';
import api from '@/lib/api';

/**
 * File Upload Preview Component
 */
function FileUploadPreview({ files, onRemove }) {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!files || files.length === 0) return null;

  return (
    <div className="border-t p-3 bg-gray-50">
      <div className="flex items-center space-x-2 mb-2">
        <Paperclip className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          Συνημμένα ({files.length})
        </span>
      </div>
      
      <div className="space-y-2">
        {files.map((file, index) => (
          <div key={index} className="flex items-center space-x-3 p-2 bg-white rounded-lg border">
            <div className="flex-shrink-0">
              {file.type.startsWith('image/') ? (
                <Image className="h-6 w-6 text-blue-500" />
              ) : (
                <File className="h-6 w-6 text-gray-500" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              className="flex-shrink-0 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Reply Context Component
 */
function ReplyContext({ replyTo, onCancelReply }) {
  if (!replyTo) return null;

  return (
    <div className="border-t p-3 bg-blue-50">
      <div className="flex items-start space-x-3">
        <Quote className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-700">
            Απάντηση σε {replyTo.sender?.username}
          </p>
          <p className="text-sm text-blue-600 truncate">
            {replyTo.content.substring(0, 100)}
            {replyTo.content.length > 100 && '...'}
          </p>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancelReply}
          className="flex-shrink-0 h-6 w-6 p-0 text-blue-400 hover:text-blue-600"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Typing Indicator Component
 */
function TypingIndicator({ typingUsers = [] }) {
  if (!typingUsers || typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].username} γράφει...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].username} και ${typingUsers[1].username} γράφουν...`;
    } else {
      return `${typingUsers.length} χρήστες γράφουν...`;
    }
  };

  return (
    <div className="px-4 py-2 text-sm text-gray-500 italic">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span>{getTypingText()}</span>
      </div>
    </div>
  );
}

/**
 * Emoji Picker Component (Simple)
 */
function EmojiPicker({ onEmojiSelect, isOpen, onClose }) {
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'
  ];

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg p-3 z-50">
      <div className="grid grid-cols-10 gap-1 max-w-xs">
        {emojis.map((emoji, index) => (
          <button
            key={index}
            onClick={() => {
              onEmojiSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * User Mention Suggestions Component
 */
function UserMentionSuggestions({ 
  suggestions = [], 
  selectedIndex = 0, 
  onSelect, 
  onClose,
  position = { top: 0, left: 0 }
}) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div 
      className="absolute bg-white border rounded-lg shadow-lg py-2 z-50 max-w-xs"
      style={{ 
        top: position.top - 200, 
        left: position.left,
        maxHeight: '200px',
        overflowY: 'auto'
      }}
    >
      {suggestions.map((user, index) => (
        <button
          key={user.id}
          onClick={() => onSelect(user)}
          className={`
            w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100
            ${index === selectedIndex ? 'bg-blue-50' : ''}
          `}
        >
          <div className="h-6 w-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
            {user.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Main Message Composer Component
 */
function MessageComposer({ 
  conversation, 
  onSendMessage, 
  replyTo = null, 
  onCancelReply,
  placeholder = "Γράψτε ένα μήνυμα...",
  disabled = false,
  className = '' 
}) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
  const [isTyping, setIsTyping] = useState(false);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  useEffect(() => {
    // Handle typing indicator
    if (message.trim() && !isTyping) {
      setIsTyping(true);
      // Send typing start event (would be WebSocket in real implementation)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Send typing stop event (would be WebSocket in real implementation)
    }, 2000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message]);

  useEffect(() => {
    // Search for user mentions
    if (mentionQuery.length >= 2) {
      searchUsers(mentionQuery);
    } else {
      setMentionSuggestions([]);
      setShowMentions(false);
    }
  }, [mentionQuery]);

  const searchUsers = async (query) => {
    try {
      const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      setMentionSuggestions(data.users || []);
      setShowMentions(true);
      setSelectedMentionIndex(0);
    } catch (error) {
      console.error('Error searching users:', error);
      setMentionSuggestions([]);
      setShowMentions(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setMessage(value);

    // Check for @ mentions
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      
      // Calculate cursor position for mention suggestions
      const textarea = textareaRef.current;
      if (textarea) {
        const rect = textarea.getBoundingClientRect();
        setCursorPosition({
          top: rect.bottom,
          left: rect.left + (mentionMatch.index * 8) // Approximate character width
        });
      }
    } else {
      setMentionQuery('');
      setShowMentions(false);
    }
  };

  const handleKeyDown = (e) => {
    // Handle mention navigation
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
        return;
      }
      
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(mentionSuggestions[selectedMentionIndex]);
        return;
      }
      
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    // Handle message sending
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMentionSelect = (user) => {
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = message.substring(0, cursorPos);
    const textAfterCursor = message.substring(cursorPos);
    
    // Replace the @query with @username
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
      const newMessage = beforeMention + `@${user.username} ` + textAfterCursor;
      setMessage(newMessage);
      
      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = beforeMention.length + user.username.length + 2;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }, 0);
    }
    
    setShowMentions(false);
    setMentionQuery('');
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 16 * 1024 * 1024; // 16MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/zip',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        alert(`Το αρχείο ${file.name} είναι πολύ μεγάλο (μέγιστο 16MB)`);
        return false;
      }
      
      if (!allowedTypes.includes(file.type)) {
        alert(`Το αρχείο ${file.name} δεν υποστηρίζεται`);
        return false;
      }
      
      return true;
    });

    setAttachments(prev => [...prev, ...validFiles]);
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleEmojiSelect = (emoji) => {
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = message.substring(0, cursorPos);
    const textAfterCursor = message.substring(cursorPos);
    
    const newMessage = textBeforeCursor + emoji + textAfterCursor;
    setMessage(newMessage);
    
    // Set cursor position after emoji
    setTimeout(() => {
      const newCursorPos = cursorPos + emoji.length;
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current.focus();
    }, 0);
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && attachments.length === 0) || isSending || disabled) {
      return;
    }

    try {
      setIsSending(true);

      // Send message
      const messageData = {
        content: message.trim(),
        content_type: 'text',
        reply_to_id: replyTo?.id || null
      };

      const { data } = await api.post(`/api/conversations/${conversation.id}/messages`, messageData);
      
      // Upload attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          const formData = new FormData();
          formData.append('file', file);
          
          await api.post(`/api/messages/${data.message.id}/attachments`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }
      }

      // Clear form
      setMessage('');
      setAttachments([]);
      if (onCancelReply) {
        onCancelReply();
      }

      // Notify parent component
      if (onSendMessage) {
        onSendMessage(data.message);
      }

      // Focus back to textarea
      textareaRef.current?.focus();

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Σφάλμα κατά την αποστολή του μηνύματος');
    } finally {
      setIsSending(false);
    }
  };

  const canSend = (message.trim() || attachments.length > 0) && !isSending && !disabled;

  return (
    <div className={`bg-white border-t ${className}`}>
      {/* Reply Context */}
      <ReplyContext replyTo={replyTo} onCancelReply={onCancelReply} />
      
      {/* File Upload Preview */}
      <FileUploadPreview files={attachments} onRemove={handleRemoveAttachment} />

      {/* Main Input Area */}
      <div className="p-4">
        <div className="flex items-end space-x-3">
          {/* Attachment Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="h-10 w-10 p-0"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.txt,.zip,.doc,.docx"
            />
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{ maxHeight: '120px' }}
            />

            {/* User Mention Suggestions */}
            <UserMentionSuggestions
              suggestions={mentionSuggestions}
              selectedIndex={selectedMentionIndex}
              onSelect={handleMentionSelect}
              onClose={() => setShowMentions(false)}
              position={cursorPosition}
            />
          </div>

          {/* Emoji Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={disabled}
              className="h-10 w-10 p-0"
            >
              <Smile className="h-5 w-5" />
            </Button>

            <EmojiPicker
              isOpen={showEmojiPicker}
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSendMessage}
            disabled={!canSend}
            className="h-10 px-4"
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Character Count */}
        {message.length > 0 && (
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <span>{message.length} χαρακτήρες</span>
            {attachments.length > 0 && (
              <span>{attachments.length} συνημμένα</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageComposer;

