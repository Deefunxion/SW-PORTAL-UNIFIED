import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Bot, Send, User, Trash2, MessageSquare, Lightbulb, Clock, Zap
} from 'lucide-react';
import api from '@/lib/api';

function AssistantPage() {
  /* --- existing state & logic untouched --- */
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: 'Γεια σας! Είμαι ο AI Assistant. Πώς μπορώ να σας βοηθήσω σήμερα;',
        timestamp: new Date().toISOString()
      }
    ]);
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    const userMessage = { id: Date.now().toString(), type: 'user', content: inputMessage, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage(''); setIsLoading(true);

    try {
      const { data } = await api.post('/api/chat', { message: inputMessage, thread_id: threadId });
      const assistantMessage = { id: Date.now() + 1, type: 'assistant', content: data.response, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, assistantMessage]); setThreadId(data.thread_id);
    } catch {
      setMessages(prev => [...prev, { id: Date.now(), type: 'assistant', content: 'Λυπάμαι, δοκιμάστε ξανά.', isError: true, timestamp: new Date().toISOString() }]);
    } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };
  const clearChat = () => setMessages([ { id: 'welcome', type: 'assistant', content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;', timestamp: new Date().toISOString() } ]);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

  const suggested = [
    "Πώς υποβάλλω αίτηση για άδεια λειτουργίας;",
    "Ποια δικαιολογητικά χρειάζονται για παιδικές κατασκηνώσεις;",
    "Πώς λειτουργεί το σύστημα αδειοδότησης;",
    "Ποιες οι προθεσμίες υποβολής;"
  ];

  return (
    <div className="container mx-auto px-12 py-20 max-w-8xl">
      {/* Header */}
      <header className="mb-20 text-center">
        <h1 className="text-7xl font-bold text-[#1e3a8a] mb-6">
          🤖 AI Assistant
        </h1>
        <p className="text-3xl text-[#6b7280] max-w-4xl mx-auto leading-relaxed font-medium">
          Έξυπνος βοηθός για απαντήσεις και υποστήριξη στις καθημερινές εργασίες
        </p>
      </header>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
        {[ { icon: Zap, title: '24/7 Διαθέσιμος', desc: 'Άμεσες απαντήσεις οποιαδήποτε στιγμή', color: 'from-blue-500 to-blue-600' },
           { icon: Lightbulb, title: 'Νομικές Συμβουλές', desc: 'Εξειδικευμένη γνώση σε νομικά θέματα', color: 'from-green-500 to-green-600' },
           { icon: MessageSquare, title: 'Φιλικό Interface', desc: 'Εύκολη και φυσική επικοινωνία', color: 'from-purple-500 to-purple-600' }
        ].map(({ icon: Icon, title, desc, color }) => (
          <Card key={title} className="text-center hover:shadow-2xl transition-all duration-300 rounded-2xl border-0 shadow-xl hover:scale-105">
            <CardContent className="p-12">
              <div className={`w-24 h-24 bg-gradient-to-br ${color} rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-xl`}>
                <Icon className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#1f2937] mb-4">{title}</h3>
              <p className="text-gray-600 text-lg leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Card */}
      <Card className="h-[800px] flex flex-col shadow-2xl rounded-3xl border-0 bg-white">
        <CardHeader className="flex-shrink-0 border-b-2 border-[#e2e8f0] bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#2563eb] to-[#1e3a8a] rounded-2xl flex items-center justify-center shadow-xl">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold text-[#1e3a8a] mb-2">AI Assistant</CardTitle>
                <CardDescription className="flex items-center text-lg">
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                  Συνδεδεμένος και Έτοιμος
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={clearChat}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-2 border-red-200 rounded-2xl transition-all px-6 py-3 text-lg font-semibold"
            >
              <Trash2 className="w-5 h-5 mr-3" /> Καθαρισμός
            </Button>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-10 space-y-8">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-3xl px-8 py-6 ${m.type === 'user' ? 'bg-[#2563eb] text-white' : m.isError ? 'bg-red-50 border-2 border-red-200 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                <div className="flex items-start space-x-4">
                  {m.type === 'assistant' && <Bot className={`w-7 h-7 flex-shrink-0 mt-1 ${m.isError ? 'text-red-500' : 'text-[#2563eb]'}`} />}
                  {m.type === 'user' && <User className="w-7 h-7 flex-shrink-0 mt-1 text-blue-100" />}
                  <div>
                    <p className="whitespace-pre-wrap text-xl leading-relaxed font-medium">{m.content}</p>
                    <div className={`text-sm mt-3 opacity-70 flex items-center ${m.type === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                      <Clock className="w-4 h-4 mr-2" /> {formatTime(m.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-3xl px-8 py-6 max-w-[80%]">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="flex-shrink-0 border-t-2 border-[#e2e8f0] p-10">
          {messages.length <= 1 && (
            <div className="mb-8">
              <p className="text-lg text-gray-600 mb-4 font-semibold">Προτεινόμενες ερωτήσεις:</p>
              <div className="flex flex-wrap gap-4">
                {suggested.map(q => (
                  <Button key={q} variant="outline" onClick={() => setInputMessage(q)} className="rounded-2xl px-6 py-3 text-base font-medium border-2">
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-6">
            <Input
              placeholder="Γράψτε το μήνυμά σας εδώ..."
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1 text-xl rounded-2xl border-2 border-[#e2e8f0] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/20 px-6 py-4"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-[#2563eb] hover:bg-[#1e3a8a] text-white rounded-2xl px-8 py-4 shadow-xl hover:shadow-2xl transition-all text-lg font-bold min-h-[60px]"
            >
              <Send className="w-6 h-6" />
            </Button>
          </div>
          <p className="text-base text-gray-500 mt-4 text-center font-medium">Enter για αποστολή • Shift+Enter για νέα γραμμή</p>
        </div>
      </Card>
    </div>
  );
}

export default AssistantPage;