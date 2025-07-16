import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  MessageCircle, 
  Search, 
  Plus, 
  Users, 
  Clock, 
  Pin,
  Archive,
  MoreHorizontal,
  X,
  Check,
  RefreshCw
} from 'lucide-react';

import { UserAvatarWithPresence } from './UserPresenceIndicator';
import { useAuth } from './AuthContext';
import api from '@/lib/api';

/**
 * Individual Conversation Item Component
 */
function ConversationItem({ 
  conversation, 
  isSelected = false, 
  onClick, 
  onArchive, 
  onPin,
  currentUser 
}) {
  const [showActions, setShowActions] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
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
      day: 'numeric'
    });
  };

  const getConversationTitle = () => {
    if (conversation.title) {
      return conversation.title;
    }

    if (conversation.is_group) {
      return `Ομάδα ${conversation.participants?.length || 0} μελών`;
    }

    // For direct messages, show the other participant's name
    const otherParticipant = conversation.participants?.find(
      p => p.user_id !== currentUser?.id
    );
    
    return otherParticipant?.user?.username || 'Άγνωστος χρήστης';
  };

  const getLastMessagePreview = () => {
    if (!conversation.last_message) {
      return 'Δεν υπάρχουν μηνύματα';
    }

    const message = conversation.last_message;
    let preview = message.content;

    // Handle different message types
    if (message.is_system_message) {
      return `🔔 ${preview}`;
    }

    if (message.attachment_count > 0) {
      preview = `📎 ${message.attachment_count} συνημμένα`;
    }

    // Truncate long messages
    if (preview.length > 50) {
      preview = preview.substring(0, 50) + '...';
    }

    // Add sender name for group conversations
    if (conversation.is_group && message.sender) {
      const senderName = message.sender.username;
      preview = `${senderName}: ${preview}`;
    }

    return preview;
  };

  const getOtherParticipants = () => {
    if (!conversation.participants) return [];
    return conversation.participants.filter(p => p.user_id !== currentUser?.id);
  };

  return (
    <div
      className={`
        relative p-3 border-b cursor-pointer transition-colors group
        ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
        ${conversation.unread_count > 0 ? 'bg-blue-25' : ''}
      `}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar(s) */}
        <div className="relative flex-shrink-0">
          {conversation.is_group ? (
            <div className="relative">
              <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                <Users className="h-5 w-5" />
              </div>
              <Badge 
                variant="secondary" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs"
              >
                {conversation.participants?.length || 0}
              </Badge>
            </div>
          ) : (
            <UserAvatarWithPresence
              userId={getOtherParticipants()[0]?.user_id}
              username={getOtherParticipants()[0]?.user?.username}
              size="md"
              showPresence={true}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`
              font-medium truncate
              ${conversation.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}
            `}>
              {getConversationTitle()}
            </h3>
            
            <div className="flex items-center space-x-2 flex-shrink-0">
              {conversation.unread_count > 0 && (
                <Badge variant="default" className="bg-blue-500 text-white">
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </Badge>
              )}
              
              <span className="text-xs text-gray-500">
                {formatDate(conversation.updated_at)}
              </span>
            </div>
          </div>

          <p className={`
            text-sm truncate
            ${conversation.unread_count > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}
          `}>
            {getLastMessagePreview()}
          </p>

          {/* Group participants preview */}
          {conversation.is_group && conversation.participants && (
            <div className="flex items-center space-x-1 mt-1">
              {getOtherParticipants().slice(0, 3).map((participant) => (
                <span key={participant.user_id} className="text-xs text-gray-400">
                  {participant.user?.username}
                </span>
              ))}
              {getOtherParticipants().length > 3 && (
                <span className="text-xs text-gray-400">
                  +{getOtherParticipants().length - 3} άλλοι
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="absolute top-2 right-2 flex items-center space-x-1 bg-white rounded-lg shadow-sm border p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onPin && onPin(conversation.id);
              }}
              className="h-6 w-6 p-0"
            >
              <Pin className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onArchive && onArchive(conversation.id);
              }}
              className="h-6 w-6 p-0"
            >
              <Archive className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Unread indicator */}
        {conversation.unread_count > 0 && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r"></div>
        )}
      </div>
    </div>
  );
}

/**
 * New Conversation Modal Component
 */
function NewConversationModal({ 
  isOpen, 
  onClose, 
  onCreateConversation 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const searchUsers = async () => {
    try {
      setIsSearching(true);
      const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setIsCreating(true);
      
      const participantIds = selectedUsers.map(u => u.id);
      const shouldBeGroup = selectedUsers.length > 1 || isGroup;
      
      await onCreateConversation({
        participant_ids: participantIds,
        is_group: shouldBeGroup,
        title: shouldBeGroup ? groupTitle : null
      });

      // Reset form
      setSelectedUsers([]);
      setSearchTerm('');
      setGroupTitle('');
      setIsGroup(false);
      onClose();
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[80vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Νέα Συζήτηση</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search Users */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Αναζήτηση χρηστών
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Πληκτρολογήστε όνομα χρήστη..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Επιλεγμένοι χρήστες ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center space-x-1"
                  >
                    <span>{user.username}</span>
                    <button
                      onClick={() => toggleUserSelection(user)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Group Options */}
          {selectedUsers.length > 1 && (
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isGroup}
                  onChange={(e) => setIsGroup(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Δημιουργία ομάδας</span>
              </label>
              
              {isGroup && (
                <Input
                  type="text"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="Τίτλος ομάδας (προαιρετικό)"
                  className="mt-2"
                />
              )}
            </div>
          )}

          {/* Search Results */}
          <div className="max-h-60 overflow-y-auto">
            {isSearching ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((user) => {
                  const isSelected = selectedUsers.some(u => u.id === user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUserSelection(user)}
                      className={`
                        w-full flex items-center space-x-3 p-2 rounded-lg transition-colors text-left
                        ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
                      `}
                    >
                      <UserAvatarWithPresence
                        userId={user.id}
                        username={user.username}
                        size="sm"
                        showPresence={true}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : searchTerm.length >= 2 ? (
              <p className="text-center text-gray-500 py-4">
                Δεν βρέθηκαν χρήστες
              </p>
            ) : (
              <p className="text-center text-gray-500 py-4">
                Πληκτρολογήστε τουλάχιστον 2 χαρακτήρες για αναζήτηση
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isCreating}
            >
              Ακύρωση
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={selectedUsers.length === 0 || isCreating}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Δημιουργία...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Δημιουργία
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main Conversation List Component
 */
function ConversationList({ 
  onConversationSelect, 
  selectedConversationId = null,
  className = '' 
}) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchConversations();
    fetchUnreadCount();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchConversations();
      fetchUnreadCount();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/api/conversations');
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { data } = await api.get('/api/users/unread-count');
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleCreateConversation = async (conversationData) => {
    try {
      const { data } = await api.post('/api/conversations', conversationData);
      
      // Refresh conversations list
      await fetchConversations();
      
      // Select the new conversation
      if (onConversationSelect) {
        onConversationSelect(data.conversation);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const handleArchiveConversation = async (conversationId) => {
    try {
      await api.post(`/api/conversations/${conversationId}/archive`);
      await fetchConversations();
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  const handlePinConversation = async (conversationId) => {
    try {
      await api.post(`/api/conversations/${conversationId}/pin`);
      await fetchConversations();
    } catch (error) {
      console.error('Error pinning conversation:', error);
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    if (!searchTerm) return true;
    
    const title = conversation.title || '';
    const participants = conversation.participants || [];
    
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participants.some(p => 
        p.user?.username?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  });

  if (loading) {
    return (
      <div className={`h-full flex flex-col ${className}`}>
        <div className="p-4 border-b">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-32 mb-4"></div>
          <div className="animate-pulse bg-gray-200 rounded h-10 w-full"></div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-3">
              <div className="bg-gray-200 rounded-full h-10 w-10"></div>
              <div className="flex-1 space-y-2">
                <div className="bg-gray-200 rounded h-4 w-3/4"></div>
                <div className="bg-gray-200 rounded h-3 w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold">Μηνύματα</h2>
            {unreadCount > 0 && (
              <Badge variant="default" className="bg-blue-500">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchConversations();
                fetchUnreadCount();
              }}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={() => setShowNewConversationModal(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Νέο
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Αναζήτηση συζητήσεων..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {searchTerm ? 'Δεν βρέθηκαν συζητήσεις' : 'Δεν υπάρχουν συζητήσεις'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm 
                ? 'Δοκιμάστε διαφορετικούς όρους αναζήτησης'
                : 'Ξεκινήστε μια νέα συζήτηση για να συνδεθείτε με άλλους χρήστες'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowNewConversationModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Νέα Συζήτηση
              </Button>
            )}
          </div>
        ) : (
          <div>
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onClick={() => onConversationSelect && onConversationSelect(conversation)}
                onArchive={handleArchiveConversation}
                onPin={handlePinConversation}
                currentUser={user}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onCreateConversation={handleCreateConversation}
      />
    </div>
  );
}

export default ConversationList;

