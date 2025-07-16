import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Link,
  AtSign,
  Eye,
  Edit3
} from 'lucide-react';

/**
 * Rich Text Editor Component
 * Provides rich text editing capabilities with mention support
 */
function RichTextEditor({ 
  value = '', 
  onChange, 
  placeholder = 'Γράψτε το μήνυμά σας...', 
  disabled = false,
  showPreview = false,
  mentionUsers = [],
  onMentionSearch
}) {
  const [content, setContent] = useState(value);
  const [isPreviewMode, setIsPreviewMode] = useState(showPreview);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [filteredUsers, setFilteredUsers] = useState([]);
  const textareaRef = useRef(null);
  const mentionDropdownRef = useRef(null);

  useEffect(() => {
    setContent(value);
  }, [value]);

  useEffect(() => {
    if (mentionQuery && onMentionSearch) {
      onMentionSearch(mentionQuery);
    }
  }, [mentionQuery, onMentionSearch]);

  useEffect(() => {
    setFilteredUsers(mentionUsers);
  }, [mentionUsers]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Check for mention trigger
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newContent.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setShowMentionDropdown(true);
      
      // Calculate dropdown position
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();
      const lineHeight = 20; // Approximate line height
      const lines = textBeforeCursor.split('\n').length;
      
      setMentionPosition({
        top: rect.top + (lines * lineHeight) + 25,
        left: rect.left + 10
      });
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
    
    if (onChange) {
      onChange(newContent);
    }
  };

  const insertFormatting = (before, after = '') => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    const newContent = 
      content.substring(0, start) + 
      before + selectedText + after + 
      content.substring(end);
    
    setContent(newContent);
    if (onChange) {
      onChange(newContent);
    }
    
    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertMention = (username) => {
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const textAfterCursor = content.substring(cursorPosition);
    
    // Find the @ symbol position
    const mentionStart = textBeforeCursor.lastIndexOf('@');
    const newContent = 
      content.substring(0, mentionStart) + 
      `@${username} ` + 
      textAfterCursor;
    
    setContent(newContent);
    setShowMentionDropdown(false);
    setMentionQuery('');
    
    if (onChange) {
      onChange(newContent);
    }
    
    // Restore focus
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = mentionStart + username.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const renderPreview = () => {
    // Simple markdown-like rendering
    let html = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic">$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')
      .replace(/@(\w+)/g, '<span class="text-blue-600 font-medium">@$1</span>')
      .replace(/\n/g, '<br>');
    
    // Wrap list items
    html = html.replace(/(<li>.*<\/li>)/g, '<ul class="list-disc list-inside">$1</ul>');
    
    return { __html: html };
  };

  const formatButtons = [
    { icon: Bold, action: () => insertFormatting('**', '**'), title: 'Έντονα (Ctrl+B)' },
    { icon: Italic, action: () => insertFormatting('*', '*'), title: 'Πλάγια (Ctrl+I)' },
    { icon: Code, action: () => insertFormatting('`', '`'), title: 'Κώδικας' },
    { icon: Quote, action: () => insertFormatting('> ', ''), title: 'Παράθεση' },
    { icon: List, action: () => insertFormatting('- ', ''), title: 'Λίστα' },
    { icon: ListOrdered, action: () => insertFormatting('1. ', ''), title: 'Αριθμημένη λίστα' },
    { icon: Link, action: () => insertFormatting('[', '](url)'), title: 'Σύνδεσμος' },
    { icon: AtSign, action: () => insertFormatting('@', ''), title: 'Αναφορά χρήστη' }
  ];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b px-3 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {formatButtons.map((button, index) => {
            const Icon = button.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={button.action}
                disabled={disabled || isPreviewMode}
                title={button.title}
                className="h-8 w-8 p-0"
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="h-8 px-3"
          >
            {isPreviewMode ? (
              <>
                <Edit3 className="h-4 w-4 mr-1" />
                Επεξεργασία
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Προεπισκόπηση
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {isPreviewMode ? (
          <div 
            className="p-4 min-h-[120px] prose prose-sm max-w-none"
            dangerouslySetInnerHTML={renderPreview()}
          />
        ) : (
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder={placeholder}
            disabled={disabled}
            className="border-0 resize-none focus:ring-0 min-h-[120px] rounded-none"
            onKeyDown={(e) => {
              // Handle keyboard shortcuts
              if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                  case 'b':
                    e.preventDefault();
                    insertFormatting('**', '**');
                    break;
                  case 'i':
                    e.preventDefault();
                    insertFormatting('*', '*');
                    break;
                  case 'k':
                    e.preventDefault();
                    insertFormatting('[', '](url)');
                    break;
                }
              }
              
              // Handle mention dropdown navigation
              if (showMentionDropdown) {
                if (e.key === 'Escape') {
                  setShowMentionDropdown(false);
                  setMentionQuery('');
                }
              }
            }}
          />
        )}

        {/* Mention Dropdown */}
        {showMentionDropdown && filteredUsers.length > 0 && (
          <div
            ref={mentionDropdownRef}
            className="fixed bg-white border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            style={{
              top: mentionPosition.top,
              left: mentionPosition.left,
              minWidth: '200px'
            }}
          >
            {filteredUsers.slice(0, 5).map((user, index) => (
              <button
                key={user.id}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center space-x-2"
                onClick={() => insertMention(user.username)}
              >
                <AtSign className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{user.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer with formatting help */}
      <div className="bg-gray-50 border-t px-3 py-2 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>
            Υποστηρίζει: **έντονα**, *πλάγια*, `κώδικας`, @αναφορές
          </span>
          <span className="text-right">
            {content.length} χαρακτήρες
          </span>
        </div>
      </div>
    </div>
  );
}

export default RichTextEditor;

