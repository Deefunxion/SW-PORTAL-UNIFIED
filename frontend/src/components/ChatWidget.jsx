import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import api from '@/lib/api';
import { 
  Bot, 
  Send, 
  User, 
  X, 
  Minimize2,
  MessageCircle,
  Clock
} from 'lucide-react';

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with welcome message
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          type: 'assistant',
          content: 'Γεια σας! Είμαι εδώ για να σας βοηθήσω. Τι θα θέλατε να μάθετε;',
          timestamp: new Date().toISOString()
        }
      ]);
    }
  }, []);

  useEffect(() => {
    // Update unread count when widget is closed and new messages arrive
    if (!isOpen && messages.length > 1) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'assistant' && lastMessage.id !== 'welcome') {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [messages, isOpen]);

  useEffect(() => {
    // Clear unread count when widget is opened
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/api/chat', {
        message: inputMessage,
        thread_id: threadId
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setThreadId(data.thread_id);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Λυπάμαι, αντιμετώπισα ένα πρόβλημα. Παρακαλώ δοκιμάστε ξανά.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const minimizeWidget = () => {
    setIsMinimized(true);
  };

  const closeWidget = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={toggleWidget}
            className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 relative"
          >
            <Bot className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
          isMinimized ? 'w-80 h-16' : 'w-80 h-96'
        }`}>
          <Card className="h-full flex flex-col shadow-2xl border-0">
            {/* Header */}
            <CardHeader className="flex-shrink-0 bg-blue-600 text-white rounded-t-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">AI Assistant</CardTitle>
                    <div className="flex items-center text-xs opacity-90">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                      Online
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={minimizeWidget}
                    className="w-6 h-6 p-0 text-white hover:bg-white hover:bg-opacity-20"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeWidget}
                    className="w-6 h-6 p-0 text-white hover:bg-white hover:bg-opacity-20"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Messages - Only show when not minimized */}
            {!isMinimized && (
              <>
                <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-2 text-sm ${
                          message.type === 'user'
                            ? 'bg-blue-600 text-white'
                            : message.isError
                            ? 'bg-red-50 border border-red-200 text-red-800'
                            : 'bg-white text-gray-800 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start space-x-1">
                          {message.type === 'assistant' && (
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                              message.isError ? 'bg-red-200' : 'bg-blue-100'
                            }`}>
                              <Bot className={`w-2 h-2 ${message.isError ? 'text-red-600' : 'text-blue-600'}`} />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            <div className={`text-xs mt-1 opacity-70 ${
                              message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatTime(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white rounded-lg p-2 shadow-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                            <Bot className="w-2 h-2 text-blue-600" />
                          </div>
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </CardContent>

                {/* Input */}
                <div className="flex-shrink-0 p-3 bg-white border-t">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Γράψτε μήνυμα..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                      className="flex-1 text-sm"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 px-3"
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

export default ChatWidget;

