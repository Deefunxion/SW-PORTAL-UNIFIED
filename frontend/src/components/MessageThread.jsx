import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  Reply, 
  Edit, 
  Trash2, 
  Download, 
  Image, 
  File, 
  Clock, 
  Check, 
  CheckCheck,
  MoreHorizontal,
  Pin,
  Copy,
  Forward,
  Quote
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { useAuth } from '@/contexts/AuthContext';

function SimpleUserAvatar({ username, size = "sm" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm" };
  return (
    <Avatar className={sizes[size] || sizes.sm}>
      <AvatarFallback className="bg-blue-100 text-blue-800 font-medium">
        {username ? username[0].toUpperCase() : "U"}
      </AvatarFallback>
    </Avatar>
  );
}
import api from '@/lib/api';

/**
 * Message Attachment Component
 */
function MessageAttachment({ attachment, onDownload }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      await onDownload(attachment);
    } catch (error) {
      console.error('Error downloading attachment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (attachment.is_image) {
    return (
      <div className="relative group max-w-xs">
        <img
          src={`/api/message-attachments/${attachment.id}/thumbnail`}
          alt={attachment.original_filename}
          className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleDownload}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            disabled={isLoading}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1 truncate">
          {attachment.original_filename}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg max-w-xs">
      <div className="flex-shrink-0">
        <File className="h-8 w-8 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {attachment.original_filename}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(attachment.file_size)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isLoading}
        className="flex-shrink-0"
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

/**
 * Message Read Receipts Component
 */
function MessageReadReceipts({ receipts = [], showDetails = false }) {
  if (!receipts || receipts.length === 0) {
    return null;
  }

  if (!showDetails) {
    return (
      <div className="flex items-center space-x-1 text-xs text-gray-400">
        <CheckCheck className="h-3 w-3" />
        <span>{receipts.length}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-600">Διαβάστηκε από:</p>
      {receipts.map((receipt) => (
        <div key={receipt.id} className="flex items-center space-x-2 text-xs text-gray-500">
          <SimpleUserAvatar
            userId={receipt.user_id}
            username={receipt.user?.username}
            size="xs"
            showPresence={false}
          />
          <span>{receipt.user?.username}</span>
          <span>•</span>
          <span>{new Date(receipt.read_at).toLocaleTimeString('el-GR', {
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Individual Message Component
 */
function MessageItem({ 
  message, 
  isOwn = false, 
  showAvatar = true, 
  onReply, 
  onEdit, 
  onDelete, 
  onDownloadAttachment,
  conversation 
}) {
  const [showActions, setShowActions] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Τώρα';
    if (diffMins < 60) return `${diffMins}λ`;
    if (diffHours < 24) return `${diffHours}ω`;
    if (diffDays < 7) return `${diffDays}μ`;
    
    return date.toLocaleDateString('el-GR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    
    try {
      await onEdit(message.id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
  };

  if (message.is_system_message) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-600">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-[70%]`}>
        {/* Avatar */}
        {showAvatar && !isOwn && (
          <SimpleUserAvatar
            userId={message.sender_id}
            username={message.sender?.username}
            size="sm"
            showPresence={true}
          />
        )}

        {/* Message Content */}
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* Reply Context */}
          {message.reply_to && (
            <div className="mb-2 p-2 bg-gray-100 rounded-lg border-l-4 border-blue-500 text-sm">
              <p className="font-medium text-gray-700">
                Απάντηση σε {message.reply_to.sender?.username}
              </p>
              <p className="text-gray-600 truncate">
                {message.reply_to.content.substring(0, 100)}
                {message.reply_to.content.length > 100 && '...'}
              </p>
            </div>
          )}

          {/* Message Bubble */}
          <div
            className={`
              relative px-4 py-2 rounded-2xl max-w-full
              ${isOwn 
                ? 'bg-blue-500 text-white rounded-br-md' 
                : 'bg-gray-100 text-gray-900 rounded-bl-md'
              }
            `}
          >
            {/* Sender Name (for group conversations) */}
            {!isOwn && conversation?.is_group && (
              <p className="text-xs font-medium text-gray-600 mb-1">
                {message.sender?.username}
              </p>
            )}

            {/* Message Content */}
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 border rounded text-gray-900 text-sm resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center space-x-2">
                  <Button size="sm" onClick={handleEdit}>
                    Αποθήκευση
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(message.content);
                    }}
                  >
                    Ακύρωση
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                
                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map((attachment) => (
                      <MessageAttachment
                        key={attachment.id}
                        attachment={attachment}
                        onDownload={onDownloadAttachment}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message Actions */}
            {showActions && !isEditing && (
              <div className={`
                absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'}
                flex items-center space-x-1 bg-white rounded-lg shadow-lg border p-1 z-10
              `}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReply(message)}
                  className="h-6 w-6 p-0"
                >
                  <Reply className="h-3 w-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyMessage}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>

                {isOwn && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(message.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Message Meta */}
          <div className={`flex items-center space-x-2 mt-1 text-xs text-gray-500 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            <span>{formatTime(message.created_at)}</span>
            
            {message.edited_at && (
              <>
                <span>•</span>
                <span className="italic">επεξεργάστηκε</span>
              </>
            )}

            {/* Read Receipts */}
            {isOwn && message.read_receipts && message.read_receipts.length > 0 && (
              <button
                onClick={() => setShowReadReceipts(!showReadReceipts)}
                className="hover:text-gray-700 transition-colors"
              >
                <MessageReadReceipts receipts={message.read_receipts} />
              </button>
            )}
          </div>

          {/* Detailed Read Receipts */}
          {showReadReceipts && isOwn && (
            <div className="mt-2 p-2 bg-white rounded-lg shadow-sm border text-xs">
              <MessageReadReceipts 
                receipts={message.read_receipts} 
                showDetails={true} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main Message Thread Component
 */
function MessageThread({ 
  conversation, 
  onReply, 
  onEditMessage, 
  onDeleteMessage,
  className = '' 
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (conversation?.id) {
      loadMessages(1, true);
    }
  }, [conversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (pageNum = 1, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { data } = await api.get(`/api/conversations/${conversation.id}/messages?page=${pageNum}&per_page=50`);
      
      if (reset) {
        setMessages(data.messages || []);
      } else {
        setMessages(prev => [...(data.messages || []), ...prev]);
      }
      
      setHasMore(data.pagination?.has_next || false);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading messages:', error);
      if (reset) {
        setMessages([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = () => {
    if (!loadingMore && hasMore) {
      loadMessages(page + 1, false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const response = await api.get(`/api/message-attachments/${attachment.id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.original_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const { data } = await api.put(`/api/messages/${messageId}`, {
        content: newContent
      });
      
      // Update message in local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, ...data.message } : msg
      ));
      
      if (onEditMessage) {
        onEditMessage(messageId, newContent);
      }
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το μήνυμα;')) {
      return;
    }

    try {
      await api.delete(`/api/messages/${messageId}`);
      
      // Update message in local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, is_deleted: true, content: '[Μήνυμα διαγράφηκε]' }
          : msg
      ));
      
      if (onDeleteMessage) {
        onDeleteMessage(messageId);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleReplyToMessage = (message) => {
    if (onReply) {
      onReply(message);
    }
  };

  if (!conversation) {
    return (
      <div className={`h-full flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Επιλέξτε μια συζήτηση
          </h3>
          <p className="text-gray-500">
            Επιλέξτε μια συζήτηση από τη λίστα για να δείτε τα μηνύματα
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`h-full flex flex-col ${className}`}>
        <div className="flex-1 p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className="animate-pulse flex items-end space-x-2">
                {i % 2 === 0 && (
                  <div className="bg-gray-200 rounded-full h-8 w-8"></div>
                )}
                <div className="bg-gray-200 rounded-2xl h-12 w-48"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {/* Load More Button */}
        {hasMore && (
          <div className="text-center mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMoreMessages}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Φόρτωση...
                </>
              ) : (
                'Φόρτωση παλαιότερων μηνυμάτων'
              )}
            </Button>
          </div>
        )}

        {/* Messages */}
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              Δεν υπάρχουν μηνύματα
            </h3>
            <p className="text-gray-500">
              Ξεκινήστε τη συζήτηση στέλνοντας το πρώτο μήνυμα
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.sender_id === user?.id;
            const prevMessage = messages[index - 1];
            const showAvatar = !prevMessage || 
              prevMessage.sender_id !== message.sender_id ||
              (new Date(message.created_at) - new Date(prevMessage.created_at)) > 300000; // 5 minutes

            return (
              <MessageItem
                key={message.id}
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                onReply={handleReplyToMessage}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onDownloadAttachment={handleDownloadAttachment}
                conversation={conversation}
              />
            );
          })
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default MessageThread;

