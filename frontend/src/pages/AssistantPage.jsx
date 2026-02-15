import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import DOMPurify from 'dompurify';
import {
  Bot, Send, Trash2, Clock, AlertTriangle,
  History, Plus, X, ChevronRight, Info, Copy, Check
} from 'lucide-react';
import api from '@/lib/api';

function simpleMarkdown(text) {
  let html = DOMPurify.sanitize(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-6 my-3">$&</ul>');
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

const SERIF_FONT = { fontFamily: "'Fraunces', Georgia, serif", fontOpticalSizing: 'auto' };

function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showSessions, setShowSessions] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: new Date().toISOString() }]);
  }, []);

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
        .map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content }))
        .slice(-20);

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
        { id: 'welcome', type: 'assistant', content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;', sources: [], timestamp: new Date().toISOString() },
        ...loaded
      ]);
      setShowSessions(false);
    } catch { /* ignore */ }
  };

  const deleteSession = async (sessionId) => {
    try {
      await api.delete(`/api/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) { setActiveSessionId(null); clearChat(); }
    } catch { /* ignore */ }
  };

  const copyToClipboard = (text, msgId) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

  const suggested = [
    "Ποια είναι η διαδικασία αδειοδότησης ΚΔΑΠ;",
    "Ποια δικαιολογητικά χρειάζονται για παιδικές κατασκηνώσεις;",
    "Πώς λειτουργεί το σύστημα ελέγχων δομών;",
    "Ποιες οι προθεσμίες υποβολής αιτήσεων;"
  ];

  return (
    <div className="max-w-[840px] w-full mx-auto flex flex-col flex-1 min-h-0 relative">

      {/* ─── Toolstrip ─── */}
      <div className="flex items-center justify-between px-2 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[#1a3aa3]" style={SERIF_FONT}>AI Βοηθός</span>
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            onClick={() => setShowSessions(!showSessions)}
            className="h-7 px-2.5 text-[11px] font-semibold text-[#8a8580] border border-[#e8e2d8] rounded-lg hover:border-[#1a3aa3] hover:text-[#1a3aa3] hover:bg-[#eef1f8] transition-all"
          >
            <History className="w-3 h-3 mr-1" /> Ιστορικό
          </Button>
          <Button
            variant="ghost"
            onClick={clearChat}
            className="h-7 px-2.5 text-[11px] font-semibold text-[#8a8580] border border-[#e8e2d8] rounded-lg hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all"
          >
            <Trash2 className="w-3 h-3 mr-1" /> Καθαρισμός
          </Button>
          {/* Info hover panel */}
          <div className="group/info relative">
            <Button
              variant="ghost"
              className="h-7 w-7 p-0 text-[#8a8580] border border-[#e8e2d8] rounded-lg hover:border-[#1a3aa3] hover:text-[#1a3aa3] hover:bg-[#eef1f8] transition-all"
            >
              <Info className="w-3 h-3" />
            </Button>
            <div className="hidden group-hover/info:block absolute right-0 top-full mt-1.5 w-[260px] bg-white border border-[#e8e2d8] rounded-xl p-3.5 shadow-lg z-30">
              <div className="flex items-center gap-2.5 py-2 text-[12.5px] text-[#6b6560]">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                24/7 Διαθέσιμος — Απαντήσεις από τα έγγραφα
              </div>
              <div className="flex items-center gap-2.5 py-2 text-[12.5px] text-[#6b6560] border-t border-[#f0ede6]">
                <span className="w-2 h-2 rounded-full bg-[#1a3aa3] flex-shrink-0" />
                Νομοθεσία & Αδειοδότηση — ΦΕΚ, αποφάσεις
              </div>
              <div className="flex items-center gap-2.5 py-2 text-[12.5px] text-[#6b6560] border-t border-[#f0ede6]">
                <span className="w-2 h-2 rounded-full bg-[#b8942e] flex-shrink-0" />
                Αναφορά Πηγών — Κάθε απάντηση με έγγραφα
              </div>
              <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-800 leading-snug">Ενδεικτικές απαντήσεις — ελέγξτε με την ισχύουσα νομοθεσία</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Disclaimer ─── */}
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-50/80 border-b border-amber-200/50 flex-shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <p className="text-[11px] text-amber-800 font-medium">Ενδεικτικές απαντήσεις — ελέγξτε πάντα με την ισχύουσα νομοθεσία</p>
      </div>

      {/* ─── Session Sidebar ─── */}
      {showSessions && (
        <div className="absolute right-2 top-11 z-20 w-72 bg-white border border-[#e8e2d8] rounded-xl shadow-2xl max-h-[400px] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-[#e8e2d8] bg-[#f9f8f5] rounded-t-xl">
            <span className="font-bold text-[#2a2520] text-sm" style={SERIF_FONT}>Ιστορικό Συζητήσεων</span>
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

      {/* ─── Messages — borderless, floating on page background ─── */}
      <div className="flex-1 overflow-y-auto px-2 pb-5 flex flex-col gap-7 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e8e2d8] [&::-webkit-scrollbar-thumb]:rounded-full">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.type === 'user' ? (
              /* ── User bubble ── */
              <div className="max-w-[88%] bg-[#1a3aa3] text-white px-[22px] py-3.5 rounded-tl-[22px] rounded-tr-[6px] rounded-br-[22px] rounded-bl-[22px]">
                <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed select-text">{m.content}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/50">
                  <Clock className="w-3 h-3" /> {formatTime(m.timestamp)}
                </div>
              </div>
            ) : (
              /* ── Assistant — no bubble, floating text ── */
              <div className="max-w-[88%] group/msg">
                {/* Avatar header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-[26px] h-[26px] bg-gradient-to-br from-[#1a3aa3] to-[#152e82] rounded-lg flex items-center justify-center">
                    <Bot className="w-[13px] h-[13px] text-white" />
                  </div>
                  <span className="text-[12px] font-bold text-[#1a3aa3] uppercase tracking-wider">AI Βοηθός</span>
                </div>
                {/* Content */}
                <div
                  className={`whitespace-pre-wrap text-[17px] leading-[1.85] select-text [&_strong]:font-bold [&_strong]:text-[#152e82] [&_ul]:my-3 [&_ul]:pl-6 [&_li]:mb-1.5 [&_li]:leading-[1.7] ${m.isError ? 'text-red-700' : 'text-[#2a2520]'}`}
                  style={SERIF_FONT}
                  dangerouslySetInnerHTML={{ __html: simpleMarkdown(m.content) }}
                />
                {/* Sources */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3.5 pt-2.5 border-t border-[#e8e2d8] flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] font-semibold text-[#8a8580] mr-0.5">Πηγές:</span>
                    {m.sources.map((src, i) => (
                      <span key={i} className="text-[10.5px] font-medium bg-white text-[#6b6560] px-2.5 py-0.5 rounded-md border border-[#e8e2d8] cursor-pointer hover:bg-[#1a3aa3] hover:text-white hover:border-[#1a3aa3] transition-colors">
                        {src.split(/[/\\]/).pop() || src}
                      </span>
                    ))}
                  </div>
                )}
                {/* Time + Copy */}
                <div className="flex items-center gap-3 mt-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-[#8a8580]">
                    <Clock className="w-3 h-3" /> {formatTime(m.timestamp)}
                  </span>
                  {m.id !== 'welcome' && (
                    <button
                      onClick={() => copyToClipboard(m.content, m.id)}
                      className="flex items-center gap-1 text-[11px] text-[#8a8580] opacity-0 group-hover/msg:opacity-100 hover:text-[#1a3aa3] transition-all cursor-pointer"
                      title="Αντιγραφή"
                    >
                      {copiedId === m.id ? (
                        <><Check className="w-3 h-3 text-green-600" /><span className="text-green-600">Αντιγράφηκε</span></>
                      ) : (
                        <><Copy className="w-3 h-3" /><span>Αντιγραφή</span></>
                      )}
                    </button>
                  )}
                </div>
                {/* Suggestions after welcome */}
                {m.id === 'welcome' && messages.length <= 1 && (
                  <div className="flex flex-wrap gap-2 justify-center mt-5">
                    {suggested.map(q => (
                      <button
                        key={q}
                        onClick={() => handleSendMessage(q)}
                        className="text-[12.5px] font-medium px-4 py-2.5 rounded-[20px] border border-[#e8e2d8] bg-white text-[#6b6560] cursor-pointer hover:border-[#1a3aa3] hover:text-[#1a3aa3] hover:bg-[#eef1f8] hover:-translate-y-0.5 hover:shadow-md transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-[26px] h-[26px] bg-gradient-to-br from-[#1a3aa3] to-[#152e82] rounded-lg flex items-center justify-center">
                  <Bot className="w-[13px] h-[13px] text-white" />
                </div>
                <span className="text-[12px] font-bold text-[#1a3aa3] uppercase tracking-wider">AI Βοηθός</span>
              </div>
              <div className="flex items-center gap-2.5 ml-[34px]">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-[#8a8580] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#8a8580] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-[#8a8580] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span className="text-[13px] text-[#8a8580]">Αναζήτηση στα έγγραφα...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Input capsule ─── */}
      <div className="px-2 pb-5 pt-2.5 flex-shrink-0">
        <div className="bg-white border-2 border-[#e8e2d8] rounded-[20px] flex items-end py-1.5 pr-1.5 pl-5 transition-all duration-200 focus-within:border-[#1a3aa3] focus-within:shadow-[0_0_0_4px_rgba(26,58,163,0.06)]">
          <input
            type="text"
            placeholder="Γράψτε την ερώτησή σας..."
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            disabled={isLoading}
            className="flex-1 text-[15px] py-3 bg-transparent text-[#2a2520] outline-none placeholder:text-[#8a8580]"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="w-11 h-11 rounded-[14px] bg-[#1a3aa3] text-white flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-[#152e82] hover:scale-[1.04] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

    </div>
  );
}

export default AssistantPage;
