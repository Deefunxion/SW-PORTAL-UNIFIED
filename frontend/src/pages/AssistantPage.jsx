import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import DOMPurify from 'dompurify';
import {
  Bot, Send, User, Trash2, MessageSquare, Lightbulb, Clock, Zap, FileText, AlertTriangle,
  History, Plus, X, ChevronRight
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

const WELCOME_MESSAGE = {
  id: 'welcome',
  type: 'assistant',
  content: 'Γεια σας! Είμαι ο AI βοηθός της Πύλης Κοινωνικής Μέριμνας. Μπορώ να σας βοηθήσω με ερωτήσεις σχετικά με τη νομοθεσία, τις διαδικασίες αδειοδότησης, και τα έγγραφα του φορέα. Πώς μπορώ να σας βοηθήσω σήμερα;',
  sources: [],
  timestamp: new Date().toISOString()
};

function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showSessions, setShowSessions] = useState(false);

  useEffect(() => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date().toISOString() }]);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    api.get('/api/chat/sessions')
      .then(({ data }) => setSessions(data))
      .catch(() => {});
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

      // Auto-create session if none active
      let currentSessionId = activeSessionId;
      if (!currentSessionId) {
        try {
          const { data: newSession } = await api.post('/api/chat/sessions', {
            title: text.slice(0, 60) + (text.length > 60 ? '...' : '')
          });
          currentSessionId = newSession.id;
          setActiveSessionId(newSession.id);
          setSessions(prev => [newSession, ...prev]);
        } catch { /* continue without persistence */ }
      }

      const { data } = await api.post('/api/chat', {
        message: text,
        chat_history: chatHistory,
        session_id: currentSessionId,
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
  const clearChat = () => {
    setActiveSessionId(null);
    setMessages([{
      id: 'welcome', type: 'assistant',
      content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;',
      sources: [], timestamp: new Date().toISOString()
    }]);
  };

  const createSession = async () => {
    try {
      const { data } = await api.post('/api/chat/sessions', {
        title: `Συζήτηση ${new Date().toLocaleDateString('el-GR')}`
      });
      setSessions(prev => [data, ...prev]);
      setActiveSessionId(data.id);
      setMessages([{
        id: 'welcome', type: 'assistant',
        content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;',
        sources: [], timestamp: new Date().toISOString()
      }]);
      setShowSessions(false);
    } catch { /* ignore */ }
  };

  const loadSession = async (sessionId) => {
    try {
      const { data } = await api.get(`/api/chat/sessions/${sessionId}/messages`);
      setActiveSessionId(sessionId);
      const loaded = data.map((m, i) => ({
        id: m.id?.toString() || `loaded-${i}`,
        type: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
        sources: m.sources || [],
        timestamp: m.created_at || new Date().toISOString()
      }));
      setMessages([
        {
          id: 'welcome', type: 'assistant',
          content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;',
          sources: [], timestamp: new Date().toISOString()
        },
        ...loaded
      ]);
      setShowSessions(false);
    } catch { /* ignore */ }
  };

  const deleteSession = async (sessionId) => {
    try {
      await api.delete(`/api/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        clearChat();
      }
    } catch { /* ignore */ }
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

  const suggested = [
    "Ποια είναι η διαδικασία αδειοδότησης ΚΔΑΠ;",
    "Ποια δικαιολογητικά χρειάζονται για παιδικές κατασκηνώσεις;",
    "Πώς λειτουργεί το σύστημα ελέγχων δομών;",
    "Ποιες οι προθεσμίες υποβολής αιτήσεων;"
  ];

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 max-w-7xl">
      {/* Compact header + disclaimer */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1a3aa3]" style={{fontFamily: "'Literata', serif"}}>
          AI Βοηθός
        </h1>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            Ενδεικτικές απαντήσεις — ελέγξτε με την ισχύουσα νομοθεσία
          </p>
        </div>
      </div>

      {/* Feature Cards — compact */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[ { icon: Zap, title: '24/7 Διαθέσιμος', desc: 'Απαντήσεις από τα έγγραφα του φορέα', color: 'from-[#1a3aa3] to-[#2548b8]' },
           { icon: Lightbulb, title: 'Νομοθεσία & Αδειοδότηση', desc: 'ΦΕΚ, αποφάσεις, εγκύκλιοι', color: 'from-[#b8942e] to-[#9a7a24]' },
           { icon: MessageSquare, title: 'Αναφορά Πηγών', desc: 'Κάθε απάντηση με σχετικά έγγραφα', color: 'from-[#3d5cc9] to-[#1a3aa3]' }
        ].map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[#e8e2d8] bg-white">
            <div className={`w-8 h-8 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#2a2520] leading-tight truncate">{title}</p>
              <p className="text-xs text-[#6b6560] leading-tight truncate">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Card */}
      <Card className="h-[480px] sm:h-[560px] lg:h-[660px] flex flex-col shadow-xl rounded-2xl border border-[#e8e2d8] bg-white relative">
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSessions(!showSessions)}
                className="text-[#1a3aa3] hover:text-[#152e82] hover:bg-[#eef1f8] border border-[#1a3aa3]/20 rounded-xl transition-all px-3 py-2 text-sm font-semibold"
              >
                <History className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">Ιστορικό</span>
              </Button>
              <Button
                variant="outline"
                onClick={clearChat}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition-all px-3 sm:px-4 py-2 text-sm font-semibold"
              >
                <Trash2 className="w-4 h-4 mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">Καθαρισμός</span><span className="sm:hidden">Clear</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Session Sidebar */}
        {showSessions && (
          <div className="absolute right-0 top-[72px] sm:top-[80px] z-20 w-72 sm:w-80 bg-white border border-[#e8e2d8] rounded-bl-xl shadow-2xl max-h-[400px] flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-[#e8e2d8] bg-[#f9f8f5]">
              <span className="font-bold text-[#2a2520] text-sm" style={{fontFamily: "'Literata', serif"}}>Ιστορικό Συζητήσεων</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={createSession} className="h-7 w-7 p-0 text-[#1a3aa3] hover:bg-[#eef1f8]">
                  <Plus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSessions(false)} className="h-7 w-7 p-0 text-[#8a8580] hover:bg-[#f0ede6]">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {sessions.length === 0 && (
                <p className="text-sm text-[#8a8580] text-center py-6">Δεν υπάρχουν αποθηκευμένες συζητήσεις</p>
              )}
              {sessions.map(s => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-1 group ${activeSessionId === s.id ? 'bg-[#eef1f8] border border-[#1a3aa3]/20' : 'hover:bg-[#f9f8f5]'}`}
                  onClick={() => loadSession(s.id)}
                >
                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${activeSessionId === s.id ? 'text-[#1a3aa3]' : 'text-[#c0bbb5]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${activeSessionId === s.id ? 'text-[#1a3aa3]' : 'text-[#2a2520]'}`}>{s.title}</p>
                    <p className="text-xs text-[#8a8580]">
                      {s.message_count || 0} μηνύματα
                      {s.updated_at && ` · ${new Date(s.updated_at).toLocaleDateString('el-GR')}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

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
