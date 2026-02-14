import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Bot, Send, Loader2, X, Sparkles, Copy, Check, ChevronRight
} from 'lucide-react';
import api from '@/lib/api';

const SUGGESTED_QUESTIONS = [
  'Τι προβλέπει ο νόμος για τη δυναμικότητα;',
  'Ποιες είναι οι προϋποθέσεις αδειοδότησης;',
  'Τι πρέπει να ελέγξω για πυρασφάλεια;',
  'Ποιες κυρώσεις προβλέπονται για παραβάσεις;',
];

export default function AiSidebar({ context, onInsertText, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context-aware prompt
      const contextPrefix = context
        ? `[Πλαίσιο: ${context}]\n\n`
        : '';
      const chatHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data } = await api.post('/api/chat', {
        message: contextPrefix + text.trim(),
        chat_history: chatHistory,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          sources: data.sources || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Δεν ήταν δυνατή η επικοινωνία με τον βοηθό.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full border-l border-[#e8e2d8] bg-[#faf8f4]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e2d8] bg-white">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#1a3aa3]" />
          <span className="font-semibold text-[#2a2520] text-sm">Βοηθός AI</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 text-[#1a3aa3] mx-auto mb-3 opacity-50" />
            <p className="text-sm text-[#6b6560] mb-4">
              Ρωτήστε τον βοηθό για νομοθεσία, κριτήρια ελέγχου ή συστάσεις.
            </p>
            <div className="space-y-2">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[#e8e2d8] bg-white text-[#2a2520] hover:bg-[#eef1f8] hover:border-[#1a3aa3] transition-colors flex items-center gap-2"
                >
                  <ChevronRight className="w-3 h-3 text-[#1a3aa3] shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#1a3aa3] text-white'
                  : 'bg-white border border-[#e8e2d8] text-[#2a2520]'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.sources?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#e8e2d8]">
                  <p className="text-[10px] uppercase tracking-wide text-[#8a8580] mb-1">Πηγές</p>
                  {msg.sources.map((s, si) => (
                    <Badge key={si} variant="outline" className="text-[10px] mr-1 mb-1">
                      {s.title || s.filename || `Πηγή ${si + 1}`}
                    </Badge>
                  ))}
                </div>
              )}
              {msg.role === 'assistant' && (
                <div className="flex gap-1 mt-2 pt-1 border-t border-[#e8e2d8]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-[#8a8580] hover:text-[#2a2520]"
                    onClick={() => handleCopy(msg.content, idx)}
                  >
                    {copiedIdx === idx ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Αντιγραφή
                  </Button>
                  {onInsertText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-[#1a3aa3] hover:text-[#152e82]"
                      onClick={() => onInsertText(msg.content)}
                    >
                      <ChevronRight className="w-3 h-3 mr-1" />
                      Εισαγωγή
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#e8e2d8] rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#1a3aa3]" />
              <span className="text-xs text-[#8a8580]">Σκέφτομαι...</span>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#e8e2d8] bg-white">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ρωτήστε τον βοηθό..."
            className="min-h-[40px] max-h-[100px] text-sm resize-none border-[#e8e2d8]"
            rows={1}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white h-10 w-10 p-0 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
