import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  Bot, 
  Send, 
  User, 
  Trash2, 
  MessageSquare,
  Lightbulb,
  Clock,
  Zap
} from 'lucide-react';

function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: 'Γεια σας! Είμαι ο AI Assistant του SW Portal. Μπορώ να σας βοηθήσω με νομικές συμβουλές, διαδικασίες της Περιφέρειας Αττικής, και γενικές ερωτήσεις. Πώς μπορώ να σας βοηθήσω σήμερα;',
        timestamp: new Date().toISOString()
      }
    ]);
  }, []);

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
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          thread_id: threadId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);
        setThreadId(data.thread_id);
      } else {
        throw new Error(data.error || 'Σφάλμα επικοινωνίας');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Λυπάμαι, αντιμετώπισα ένα πρόβλημα. Παρακαλώ δοκιμάστε ξανά σε λίγο.',
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

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: 'Γεια σας! Είμαι ο AI Assistant του SW Portal. Μπορώ να σας βοηθήσω με νομικές συμβουλές, διαδικασίες της Περιφέρειας Αττικής, και γενικές ερωτήσεις. Πώς μπορώ να σας βοηθήσω σήμερα;',
        timestamp: new Date().toISOString()
      }
    ]);
    setThreadId(null);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const suggestedQuestions = [
    "Πώς μπορώ να υποβάλω αίτηση για άδεια λειτουργίας;",
    "Ποια είναι τα απαιτούμενα δικαιολογητικά για παιδικές κατασκηνώσεις;",
    "Πώς λειτουργεί το σύστημα αδειοδότησης;",
    "Ποιες είναι οι προθεσμίες για υποβολή αιτήσεων;"
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🤖 AI Assistant
        </h1>
        <p className="text-gray-600">
          Έξυπνος βοηθός για απαντήσεις και υποστήριξη
        </p>
      </div>

      {/* Features Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-1">24/7 Διαθέσιμος</h3>
            <p className="text-sm text-gray-600">Άμεσες απαντήσεις οποιαδήποτε στιγμή</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Lightbulb className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-1">Νομικές Συμβουλές</h3>
            <p className="text-sm text-gray-600">Εξειδικευμένη γνώση σε νομικά θέματα</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-1">Φιλικό Interface</h3>
            <p className="text-sm text-gray-600">Εύκολη και φυσική επικοινωνία</p>
          </CardContent>
        </Card>
      </div>

      {/* Chat Interface */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Assistant</CardTitle>
                <CardDescription className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Συνδεδεμένος
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearChat}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Καθαρισμός
            </Button>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.isError
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="flex items-start space-x-2">
                  {message.type === 'assistant' && (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                      message.isError ? 'bg-red-200' : 'bg-blue-100'
                    }`}>
                      <Bot className={`w-4 h-4 ${message.isError ? 'text-red-600' : 'text-blue-600'}`} />
                    </div>
                  )}
                  {message.type === 'user' && (
                    <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <div className={`text-xs mt-2 opacity-70 flex items-center ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="flex-shrink-0 border-t p-4">
          {/* Suggested Questions */}
          {messages.length <= 1 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Προτεινόμενες ερωτήσεις:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setInputMessage(question)}
                    className="text-xs"
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <Input
              placeholder="Γράψτε το μήνυμά σας..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="text-xs text-gray-500 mt-2 text-center">
            Πατήστε Enter για αποστολή • Shift+Enter για νέα γραμμή
          </div>
        </div>
      </Card>
    </div>
  );
}

export default AssistantPage;

