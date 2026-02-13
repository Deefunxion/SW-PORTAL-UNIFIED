import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import DOMPurify from 'dompurify';
import api from '@/lib/api';
import {
  Bot,
  Send,
  X,
  Minimize2,
  FileText
} from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  "Τι είναι το ΚΔΑΠ;",
  "Διαδικασία αδειοδότησης δομών",
  "Ποια δικαιολογητικά χρειάζονται;",
];

function simpleMarkdown(text) {
  let html = DOMPurify.sanitize(text);
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Bullet lists
  html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 my-1">$&</ul>');
  // Numbered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Line breaks
  html = html.replace(/\n/g, '<br/>');
  return html;
}

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        type: 'assistant',
        content: 'Γεια σας! Είμαι ο ψηφιακός βοηθός της Πύλης Κοινωνικής Μέριμνας. Πώς μπορώ να σας βοηθήσω;',
        sources: [],
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  useEffect(() => {
    if (!isOpen && messages.length > 1) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'assistant' && lastMessage.id !== 'welcome') {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  const handleSendMessage = async (overrideMessage) => {
    const text = (overrideMessage || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const chatHistory = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
        .slice(-6);

      const { data } = await api.post('/api/chat', {
        message: text,
        chat_history: chatHistory,
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.reply,
        sources: data.sources || [],
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Λυπάμαι, αντιμετώπισα ένα πρόβλημα. Παρακαλώ δοκιμάστε ξανά.',
        sources: [],
        timestamp: new Date().toISOString(),
        isError: true
      }]);
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

  const showSuggestions = messages.length <= 1;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <Button
            onClick={() => { setIsOpen(true); setIsMinimized(false); }}
            className="w-14 h-14 rounded-full bg-[#1a3aa3] hover:bg-[#152e82] hover:shadow-[0_8px_24px_rgba(26,58,163,.35)] hover:scale-110 shadow-lg transition-all duration-300 relative"
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
        <div className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 transition-all duration-300 ${
          isMinimized ? 'w-72 sm:w-80 h-16' : 'w-[calc(100vw-2rem)] sm:w-96 h-[70vh] sm:h-[500px] max-h-[500px]'
        }`}>
          <Card className="h-full flex flex-col shadow-2xl border border-[#e8e2d8] rounded-2xl overflow-hidden">
            {/* Header */}
            <CardHeader className="flex-shrink-0 bg-[#1a3aa3] text-white rounded-t-2xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">AI Βοηθός</CardTitle>
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
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="w-8 h-8 p-0 text-white hover:bg-white hover:bg-opacity-20 rounded-lg"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setIsOpen(false); setIsMinimized(false); }}
                    className="w-8 h-8 p-0 text-white hover:bg-white hover:bg-opacity-20 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            {!isMinimized && (
              <>
                <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#faf8f4]">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-2 text-sm ${
                          message.type === 'user'
                            ? 'bg-[#1a3aa3] text-white rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl'
                            : message.isError
                            ? 'bg-red-50 border border-red-200 text-red-800 rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
                            : 'bg-white text-[#2a2520] shadow-sm rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
                        }`}
                      >
                        <div className="flex items-start space-x-1">
                          {message.type === 'assistant' && (
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                              message.isError ? 'bg-red-200' : 'bg-[#dde4f5]'
                            }`}>
                              <Bot className={`w-2 h-2 ${message.isError ? 'text-red-600' : 'text-[#1a3aa3]'}`} />
                            </div>
                          )}
                          <div className="flex-1">
                            {message.type === 'user' ? (
                              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            ) : (
                              <div
                                className="whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: simpleMarkdown(message.content) }}
                              />
                            )}
                            {/* Sources */}
                            {message.sources && message.sources.length > 0 && (
                              <div className="mt-2 pt-1 border-t border-[#e8e2d8]">
                                <div className="flex items-center gap-1 text-xs text-[#8a8580] mb-1">
                                  <FileText className="w-3 h-3" />
                                  <span>Πηγές:</span>
                                </div>
                                {message.sources.map((src, i) => (
                                  <div key={i} className="text-xs text-[#1a3aa3] truncate" title={src}>
                                    {src.split('/').pop() || src}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className={`text-xs mt-1 opacity-70 ${
                              message.type === 'user' ? 'text-blue-100' : 'text-[#8a8580]'
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
                      <div className="bg-white rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl p-2 shadow-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-[#dde4f5] rounded-full flex items-center justify-center">
                            <Bot className="w-2 h-2 text-[#1a3aa3]" />
                          </div>
                          <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-[#8a8580] rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-[#8a8580] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-1.5 h-1.5 bg-[#8a8580] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </CardContent>

                {/* Suggested Questions */}
                {showSuggestions && (
                  <div className="px-3 py-2 bg-[#faf8f4] border-t">
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_QUESTIONS.map(q => (
                        <button
                          key={q}
                          onClick={() => handleSendMessage(q)}
                          className="text-xs bg-white border border-[#e8e2d8] rounded-full px-2.5 py-1 text-[#6b6560] hover:bg-[#eef1f8] hover:border-[#b0c0e0] hover:text-[#1a3aa3] transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="flex-shrink-0 p-3 bg-white border-t">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Γράψτε ερώτηση..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={isLoading}
                      className="flex-1 text-sm"
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() || isLoading}
                      size="sm"
                      className="bg-[#1a3aa3] hover:bg-[#152e82] px-3"
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
