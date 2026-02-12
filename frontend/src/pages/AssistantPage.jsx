import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import DOMPurify from 'dompurify';
import {
  Bot, Send, User, Trash2, MessageSquare, Lightbulb, Clock, Zap, FileText
} from 'lucide-react';
import api from '@/lib/api';

function simpleMarkdown(text) {
  let html = DOMPurify.sanitize(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 my-1">$&</ul>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        type: 'assistant',
        content: 'Γεια σας! Είμαι ο AI βοηθός της Πύλης Κοινωνικής Μέριμνας. Μπορώ να σας βοηθήσω με ερωτήσεις σχετικά με τη νομοθεσία, τις διαδικασίες αδειοδότησης, και τα έγγραφα του φορέα. Πώς μπορώ να σας βοηθήσω σήμερα;',
        sources: [],
        timestamp: new Date().toISOString()
      }
    ]);
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async (overrideMessage) => {
    const text = (overrideMessage || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessage = { id: Date.now().toString(), type: 'user', content: text, timestamp: new Date().toISOString() };
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

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.reply,
        sources: data.sources || [],
        timestamp: new Date().toISOString()
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Λυπάμαι, αντιμετώπισα τεχνικό πρόβλημα. Παρακαλώ δοκιμάστε ξανά.',
        sources: [],
        isError: true,
        timestamp: new Date().toISOString()
      }]);
    } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };
  const clearChat = () => setMessages([{
    id: 'welcome', type: 'assistant',
    content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;',
    sources: [], timestamp: new Date().toISOString()
  }]);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

  const suggested = [
    "Ποια είναι η διαδικασία αδειοδότησης ΚΔΑΠ;",
    "Ποια δικαιολογητικά χρειάζονται για παιδικές κατασκηνώσεις;",
    "Πώς λειτουργεί το σύστημα ελέγχων δομών;",
    "Ποιες οι προθεσμίες υποβολής αιτήσεων;"
  ];

  return (
    <div className="container mx-auto px-12 py-20 max-w-8xl">
      {/* Header */}
      <header className="mb-20 text-center">
        <h1 className="text-7xl font-bold text-[#1a3aa3] mb-6" style={{fontFamily: "'Literata', serif"}}>
          AI Βοηθός
        </h1>
        <p className="text-3xl text-[#8a8580] max-w-4xl mx-auto leading-relaxed font-medium">
          Έξυπνος βοηθός με πρόσβαση στη νομοθεσία και τα έγγραφα κοινωνικής μέριμνας
        </p>
      </header>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
        {[ { icon: Zap, title: '24/7 Διαθέσιμος', desc: 'Άμεσες απαντήσεις βασισμένες στα έγγραφα του φορέα', color: 'from-[#1a3aa3] to-[#2548b8]' },
           { icon: Lightbulb, title: 'Νομοθεσία & Αδειοδότηση', desc: 'Γνώση από ΦΕΚ, αποφάσεις και εγκυκλίους', color: 'from-[#b8942e] to-[#9a7a24]' },
           { icon: MessageSquare, title: 'Αναφορά Πηγών', desc: 'Κάθε απάντηση συνοδεύεται από τα σχετικά έγγραφα', color: 'from-[#3d5cc9] to-[#1a3aa3]' }
        ].map(({ icon: Icon, title, desc, color }) => (
          <Card key={title} className="text-center hover:shadow-2xl transition-all duration-300 rounded-2xl border-0 shadow-xl hover:scale-105">
            <CardContent className="p-12">
              <div className={`w-24 h-24 bg-gradient-to-br ${color} rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-xl`}>
                <Icon className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#2a2520] mb-4" style={{fontFamily: "'Literata', serif"}}>{title}</h3>
              <p className="text-[#6b6560] text-lg leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Card */}
      <Card className="h-[800px] flex flex-col shadow-2xl rounded-3xl border-0 bg-white">
        <CardHeader className="flex-shrink-0 border-b-2 border-[#e8e2d8] bg-gradient-to-r from-[#eef1f8] to-[#f0ede6] p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#1a3aa3] to-[#152e82] rounded-2xl flex items-center justify-center shadow-xl">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold text-[#1a3aa3] mb-2" style={{fontFamily: "'Literata', serif"}}>AI Βοηθός</CardTitle>
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
              <div className={`max-w-[80%] ${m.type === 'user' ? 'rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl' : 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'} px-8 py-6 ${m.type === 'user' ? 'bg-[#1a3aa3] text-white' : m.isError ? 'bg-red-50 border-2 border-red-200 text-red-800' : 'bg-[#f0ede6] text-[#2a2520]'}`}>
                <div className="flex items-start space-x-4">
                  {m.type === 'assistant' && <Bot className={`w-7 h-7 flex-shrink-0 mt-1 ${m.isError ? 'text-red-500' : 'text-[#1a3aa3]'}`} />}
                  {m.type === 'user' && <User className="w-7 h-7 flex-shrink-0 mt-1 text-blue-100" />}
                  <div className="flex-1">
                    {m.type === 'user' ? (
                      <p className="whitespace-pre-wrap text-xl leading-relaxed font-medium">{m.content}</p>
                    ) : (
                      <div
                        className="whitespace-pre-wrap text-xl leading-relaxed font-medium prose prose-lg max-w-none"
                        dangerouslySetInnerHTML={{ __html: simpleMarkdown(m.content) }}
                      />
                    )}
                    {/* Sources */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#e0dbd2]">
                        <div className="flex items-center gap-2 text-sm text-[#8a8580] mb-2">
                          <FileText className="w-4 h-4" />
                          <span className="font-semibold">Πηγές:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {m.sources.map((src, i) => (
                            <Badge key={i} variant="secondary" className="text-xs font-normal hover:bg-[#1a3aa3] hover:text-white transition-colors duration-200 cursor-pointer">
                              {src.split(/[/\\]/).pop() || src}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className={`text-sm mt-3 opacity-70 flex items-center ${m.type === 'user' ? 'text-blue-100' : 'text-[#8a8580]'}`}>
                      <Clock className="w-4 h-4 mr-2" /> {formatTime(m.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#f0ede6] rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-8 py-6 max-w-[80%]">
                <div className="flex items-center space-x-3">
                  <Bot className="w-7 h-7 text-[#1a3aa3]" />
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-[#8a8580] rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-[#8a8580] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-3 h-3 bg-[#8a8580] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-[#8a8580] text-lg ml-2">Αναζήτηση στα έγγραφα...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        <div className="flex-shrink-0 border-t-2 border-[#e8e2d8] p-10">
          {messages.length <= 1 && (
            <div className="mb-8">
              <p className="text-lg text-[#6b6560] mb-4 font-semibold">Προτεινόμενες ερωτήσεις:</p>
              <div className="flex flex-wrap gap-4">
                {suggested.map(q => (
                  <Button key={q} variant="outline" onClick={() => handleSendMessage(q)} className="rounded-2xl px-6 py-3 text-base font-medium border-2 hover:translate-x-1 hover:border-[#1a3aa3] hover:bg-[#eef1f8] hover:text-[#1a3aa3] hover:shadow-md transition-all duration-250">
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-6">
            <Input
              placeholder="Γράψτε την ερώτησή σας εδώ..."
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1 text-xl rounded-2xl border-2 border-[#e8e2d8] focus:border-[#1a3aa3] focus:ring-4 focus:ring-[#1a3aa3]/10 px-6 py-4"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-[#1a3aa3] hover:bg-[#152e82] text-white rounded-2xl px-8 py-4 shadow-xl hover:shadow-2xl transition-all text-lg font-bold min-h-[60px]"
            >
              <Send className="w-6 h-6" />
            </Button>
          </div>
          <p className="text-base text-[#8a8580] mt-4 text-center font-medium">Enter για αποστολή</p>
        </div>
      </Card>
    </div>
  );
}

export default AssistantPage;
