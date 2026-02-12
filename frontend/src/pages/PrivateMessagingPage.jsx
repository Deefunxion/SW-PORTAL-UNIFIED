import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  MessageCircle, 
  Users, 
  Settings, 
  Search, 
  Phone, 
  Video, 
  Info,
  Archive,
  Star,
  MoreVertical,
  ArrowLeft,
  UserPlus
} from 'lucide-react';

import ConversationList from '../components/ConversationList';
import MessageThread from '../components/MessageThread';
import MessageComposer from '../components/MessageComposer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { useAuth } from '../contexts/AuthContext';

function SimpleUserAvatar({ username, size = "md" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", xl: "h-16 w-16 text-lg mx-auto" };
  const initial = username ? username[0].toUpperCase() : "U";
  return (
    <Avatar className={sizes[size] || sizes.md}>
      <AvatarFallback className="bg-blue-100 text-blue-800 font-medium">{initial}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Conversation Header Component
 */
function ConversationHeader({ 
  conversation, 
  onBack, 
  onToggleInfo, 
  showBackButton = false 
}) {
  const [showActions, setShowActions] = useState(false);

  if (!conversation) return null;

  const getConversationTitle = () => {
    if (conversation.title) {
      return conversation.title;
    }

    if (conversation.is_group) {
      return `Ομάδα ${conversation.participants?.length || 0} μελών`;
    }

    // For direct messages, show the other participant's name
    const otherParticipant = conversation.participants?.find(
      p => p.user_id !== conversation.current_user_id
    );
    
    return otherParticipant?.user?.username || 'Άγνωστος χρήστης';
  };

  const getOnlineCount = () => {
    if (!conversation.participants) return 0;
    return conversation.participants.filter(p => p.user?.presence?.is_online).length;
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center space-x-3">
        {/* Back Button (for mobile) */}
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Avatar */}
        <div className="relative">
          {conversation.is_group ? (
            <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-medium">
              <Users className="h-5 w-5" />
            </div>
          ) : (
            <SimpleUserAvatar
              userId={conversation.participants?.[0]?.user_id}
              username={conversation.participants?.[0]?.user?.username}
              size="md"
              showPresence={true}
            />
          )}
        </div>

        {/* Conversation Info */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">
            {getConversationTitle()}
          </h2>
          
          {conversation.is_group ? (
            <p className="text-sm text-gray-500">
              {getOnlineCount()} από {conversation.participants?.length || 0} online
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              {conversation.participants?.[0]?.user?.presence?.status === 'online' 
                ? 'Συνδεδεμένος' 
                : 'Αποσυνδεδεμένος'
              }
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <Phone className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <Video className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleInfo}
          className="h-8 w-8 p-0"
        >
          <Info className="h-4 w-4" />
        </Button>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowActions(!showActions)}
            className="h-8 w-8 p-0"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>

          {showActions && (
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-2 z-50 min-w-[150px]">
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2">
                <Star className="h-4 w-4" />
                <span>Προσθήκη στα αγαπημένα</span>
              </button>
              
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2">
                <Archive className="h-4 w-4" />
                <span>Αρχειοθέτηση</span>
              </button>
              
              {conversation.is_group && (
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2">
                  <UserPlus className="h-4 w-4" />
                  <span>Προσθήκη μέλους</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Conversation Info Sidebar Component
 */
function ConversationInfoSidebar({ 
  conversation, 
  isOpen, 
  onClose 
}) {
  const [activeTab, setActiveTab] = useState('members');

  if (!isOpen || !conversation) return null;

  const tabs = [
    { id: 'members', label: 'Μέλη', icon: Users },
    { id: 'media', label: 'Πολυμέσα', icon: Image },
    { id: 'settings', label: 'Ρυθμίσεις', icon: Settings }
  ];

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Πληροφορίες συζήτησης</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conversation Avatar & Title */}
      <div className="p-4 text-center border-b">
        <div className="mx-auto mb-3">
          {conversation.is_group ? (
            <div className="h-16 w-16 bg-purple-500 rounded-full flex items-center justify-center text-white font-medium mx-auto">
              <Users className="h-8 w-8" />
            </div>
          ) : (
            <SimpleUserAvatar
              userId={conversation.participants?.[0]?.user_id}
              username={conversation.participants?.[0]?.user?.username}
              size="xl"
              showPresence={true}
            />
          )}
        </div>
        
        <h4 className="font-semibold text-lg">
          {conversation.title || 
           (conversation.is_group 
             ? `Ομάδα ${conversation.participants?.length || 0} μελών`
             : conversation.participants?.[0]?.user?.username
           )
          }
        </h4>
        
        {conversation.is_group && (
          <p className="text-sm text-gray-500 mt-1">
            {conversation.participants?.length || 0} μέλη
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium
                ${activeTab === tab.id 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'members' && (
          <div className="p-4 space-y-3">
            {conversation.participants?.map((participant) => (
              <div key={participant.user_id} className="flex items-center space-x-3">
                <SimpleUserAvatar
                  userId={participant.user_id}
                  username={participant.user?.username}
                  size="md"
                  showPresence={true}
                />
                <div className="flex-1">
                  <p className="font-medium">{participant.user?.username}</p>
                  <p className="text-sm text-gray-500">{participant.user?.email}</p>
                </div>
                {participant.role === 'admin' && (
                  <Badge variant="secondary">Admin</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'media' && (
          <div className="p-4">
            <p className="text-center text-gray-500 py-8">
              Δεν υπάρχουν πολυμέσα
            </p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-4 space-y-4">
            <div>
              <h5 className="font-medium mb-2">Ειδοποιήσεις</h5>
              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Ειδοποιήσεις μηνυμάτων</span>
              </label>
            </div>
            
            <div>
              <h5 className="font-medium mb-2">Ιδιωτικότητα</h5>
              <label className="flex items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Εμφάνιση κατάστασης ανάγνωσης</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Private Messaging Page Component
 */
function PrivateMessagingPage() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [showMobileConversation, setShowMobileConversation] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);

  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    setShowMobileConversation(true);
    setShowConversationInfo(false);
  };

  const handleBackToList = () => {
    setShowMobileConversation(false);
    setSelectedConversation(null);
  };

  const handleSendMessage = (message) => {
    // Message sent successfully, could trigger conversation list refresh
    setReplyToMessage(null);
  };

  const handleReplyToMessage = (message) => {
    setReplyToMessage(message);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Conversation List - Hidden on mobile when conversation is selected */}
      <div className={`
        w-80 border-r bg-white flex-shrink-0
        ${showMobileConversation ? 'hidden md:flex' : 'flex'}
      `}>
        <ConversationList
          onConversationSelect={handleConversationSelect}
          selectedConversationId={selectedConversation?.id}
          className="w-full"
        />
      </div>

      {/* Main Chat Area */}
      <div className={`
        flex-1 flex flex-col
        ${!showMobileConversation ? 'hidden md:flex' : 'flex'}
      `}>
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <ConversationHeader
              conversation={selectedConversation}
              onBack={handleBackToList}
              onToggleInfo={() => setShowConversationInfo(!showConversationInfo)}
              showBackButton={true}
            />

            {/* Messages Area */}
            <div className="flex-1 flex">
              {/* Message Thread */}
              <div className="flex-1 flex flex-col">
                <MessageThread
                  conversation={selectedConversation}
                  onReply={handleReplyToMessage}
                  className="flex-1"
                />

                {/* Message Composer */}
                <MessageComposer
                  conversation={selectedConversation}
                  onSendMessage={handleSendMessage}
                  replyTo={replyToMessage}
                  onCancelReply={handleCancelReply}
                />
              </div>

              {/* Conversation Info Sidebar */}
              <ConversationInfoSidebar
                conversation={selectedConversation}
                isOpen={showConversationInfo}
                onClose={() => setShowConversationInfo(false)}
              />
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="h-24 w-24 bg-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
                <MessageCircle className="h-12 w-12 text-gray-400" />
              </div>
              
              <h2 className="text-2xl font-semibold text-gray-700 mb-3">
                Καλώς ήρθατε στα Μηνύματα
              </h2>
              
              <p className="text-gray-500 mb-6">
                Επιλέξτε μια συζήτηση από τη λίστα ή ξεκινήστε μια νέα για να συνδεθείτε με άλλους χρήστες.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-4 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span>Συνδεδεμένος</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                    <span>Απών</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                    <span>Απασχολημένος</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Online Users Sidebar (Desktop only) */}
      <div className="hidden xl:block w-64 border-l bg-white">
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-4">Online Χρήστες</h3>
          
          {/* Current User Status */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <SimpleUserAvatar
                userId={user?.id}
                username={user?.username}
                size="sm"
                showPresence={true}
              />
              <div>
                <p className="font-medium text-sm">{user?.username}</p>
                <p className="text-xs text-gray-500">Εσείς</p>
              </div>
            </div>
            
            <Badge variant="secondary" className="text-xs">Online</Badge>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-500">Λειτουργία σε εξέλιξη</p>
        </div>
      </div>
    </div>
  );
}

export default PrivateMessagingPage;

