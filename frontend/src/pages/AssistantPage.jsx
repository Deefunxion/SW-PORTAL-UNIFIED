import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import DOMPurify from 'dompurify';
import {
  Bot, Send, User, Trash2, MessageSquare, Lightbulb, Clock, Zap, FileText, AlertTriangle
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
        .slice(-20);

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
    <div className="mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 max-w-7xl">
      {/* Header */}
      <header className="mb-8 sm:mb-12 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1a3aa3] mb-4" style={{fontFamily: "'Literata', serif"}}>
          AI Βοηθός
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-[#8a8580] max-w-3xl mx-auto leading-relaxed font-medium">
          Έξυπνος βοηθός με πρόσβαση στη νομοθεσία και τα έγγραφα κοινωνικής μέριμνας
        </p>
      </header>

      {/* AI Disclaimer Banner */}
      <div className="mb-6 sm:mb-8 bg-amber-50 border border-amber-200 rounded-xl px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm sm:text-base text-amber-800 font-medium leading-relaxed">
          Οι απαντήσεις του AI Βοηθού είναι <strong>ενδεικτικές και συμβουλευτικού χαρακτήρα</strong>.
          Ελέγξτε πάντα με την ισχύουσα νομοθεσία και τις επίσημες εγκυκλίους.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8 sm:mb-12">
        {[ { icon: Zap, title: '24/7 Διαθέσιμος', desc: 'Άμεσες απαντήσεις βασισμένες στα έγγραφα του φορέα', color: 'from-[#1a3aa3] to-[#2548b8]' },
           { icon: Lightbulb, title: 'Νομοθεσία & Αδειοδότηση', desc: 'Γνώση από ΦΕΚ, αποφάσεις και εγκυκλίους', color: 'from-[#b8942e] to-[#9a7a24]' },
           { icon: MessageSquare, title: 'Αναφορά Πηγών', desc: 'Κάθε απάντηση συνοδεύεται από τα σχετικά έγγραφα', color: 'from-[#3d5cc9] to-[#1a3aa3]' }
        ].map(({ icon: Icon, title, desc, color }) => (
          <Card key={title} className="text-center hover:shadow-xl transition-all duration-300 rounded-xl border border-[#e8e2d8] shadow-md">
            <CardContent className="p-5 sm:p-6">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br ${color} rounded-xl mx-auto mb-4 flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#2a2520] mb-2" style={{fontFamily: "'Literata', serif"}}>{title}</h3>
              <p className="text-[#6b6560] text-sm sm:text-base leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Card */}
      <Card className="h-[480px] sm:h-[560px] lg:h-[660px] flex flex-col shadow-xl rounded-2xl border border-[#e8e2d8] bg-white">
        <CardHeader className="flex-shrink-0 border-b border-[#e8e2d8] bg-gradient-to-r from-[#eef1f8] to-[#f0ede6] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#1a3aa3] to-[#152e82] rounded-xl flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-[#1a3aa3]" style={{fontFamily: "'Literata', serif"}}>AI Βοηθός</CardTitle>
                <CardDescription className="flex items-center text-sm">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  Συνδεδεμένος
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={clearChat}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition-all px-3 sm:px-4 py-2 text-sm font-semibold"
            >
              <Trash2 className="w-4 h-4 mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">Καθαρισμός</span><span className="sm:hidden">Clear</span>
            </Button>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] sm:max-w-[80%] ${m.type === 'user' ? 'rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl' : 'rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'} px-4 sm:px-6 py-3 sm:py-4 ${m.type === 'user' ? 'bg-[#1a3aa3] text-white' : m.isError ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-[#f0ede6] text-[#2a2520]'}`}>
                <div className="flex items-start gap-2 sm:gap-3">
                  {m.type === 'assistant' && <Bot className={`w-5 h-5 flex-shrink-0 mt-0.5 ${m.isError ? 'text-red-500' : 'text-[#1a3aa3]'}`} />}
                  {m.type === 'user' && <User className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-100" />}
                  <div className="flex-1 min-w-0">
                    {m.type === 'user' ? (
                      <p className="whitespace-pre-wrap text-base sm:text-lg leading-relaxed font-medium">{m.content}</p>
                    ) : (
                      <div
                        className="whitespace-pre-wrap text-base sm:text-lg leading-relaxed font-medium prose prose-sm sm:prose-base max-w-none"
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
              <div className="bg-[#f0ede6] rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 sm:px-6 py-3 sm:py-4 max-w-[90%] sm:max-w-[80%]">
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
        <div className="flex-shrink-0 border-t border-[#e8e2d8] p-4 sm:p-5">
          {messages.length <= 1 && (
            <div className="mb-4">
              <p className="text-sm sm:text-base text-[#6b6560] mb-3 font-semibold">Προτεινόμενες ερωτήσεις:</p>
              <div className="flex flex-wrap gap-2">
                {suggested.map(q => (
                  <Button key={q} variant="outline" onClick={() => handleSendMessage(q)} className="rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border hover:border-[#1a3aa3] hover:bg-[#eef1f8] hover:text-[#1a3aa3] transition-all">
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Input
              placeholder="Γράψτε την ερώτησή σας..."
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1 text-base rounded-xl border border-[#e8e2d8] focus:border-[#1a3aa3] focus:ring-4 focus:ring-[#1a3aa3]/10 px-4 py-3 min-h-[44px]"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-[#1a3aa3] hover:bg-[#152e82] text-white rounded-xl px-4 sm:px-6 py-3 shadow-lg hover:shadow-xl transition-all text-base font-bold min-h-[44px]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default AssistantPage;
