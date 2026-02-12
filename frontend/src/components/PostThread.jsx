import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { 
  MessageCircle, 
  Reply, 
  Heart, 
  ThumbsUp, 
  Laugh, 
  Angry, 
  Frown,
  MoreHorizontal,
  Edit,
  Trash2,
  Flag,
  Paperclip,
  Image as ImageIcon,
  Download,
  Eye,
  Clock,
  User
} from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';

/**
 * Individual Post Component with reactions and threading
 */
function PostItem({ 
  post, 
  depth = 0, 
  onReply, 
  onEdit, 
  onReact, 
  currentUser,
  showReplies = true,
  maxDepth = 5 
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [editContent, setEditContent] = useState(post.content);
  const [reactions, setReactions] = useState(post.reaction_counts || {});
  const [attachments, setAttachments] = useState([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock engagement stats
  const engagementStats = {
    replies: post.reply_count || Math.floor(Math.random() * 15),
    views: post.view_count || Math.floor(Math.random() * 100) + 20,
    likes: reactions.like || Math.floor(Math.random() * 10),
    ...reactions
  };

  // Mock tags for posts
  const postTags = post.tags || [
    'Συμβουλή',
    'Εμπειρία',
    'Νομοθεσία'
  ].slice(0, Math.floor(Math.random() * 3) + 1);

  useEffect(() => {
    if (post.attachment_count > 0) {
      fetchAttachments();
    }
  }, [post.id]);

  const fetchAttachments = async () => {
    try {
      const { data } = await api.get(`/api/posts/${post.id}/attachments`);
      setAttachments(data);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onReply(post.id, replyContent);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Reply error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onEdit(post.id, editContent);
      setShowEditForm(false);
    } catch (error) {
      console.error('Edit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = async (reactionType) => {
    try {
      await onReact(post.id, reactionType);
      setReactions(prev => ({
        ...prev,
        [reactionType]: (prev[reactionType] || 0) + 1
      }));
    } catch (error) {
      console.error('Reaction error:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: el 
      });
    } catch (error) {
      return formatDate(dateString);
    }
  };

  const getUserInitials = (username) => {
    if (!username) return 'U';
    const names = username.split(' ');
    if (names.length >= 2) {
      return names[0].charAt(0).toUpperCase() + names[1].charAt(0).toUpperCase();
    }
    return username.charAt(0).toUpperCase();
  };

  const getAvatarColor = (username) => {
    if (!username) return 'bg-[#8a8580]';
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const index = username.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderContent = (content, contentType = 'text') => {
    if (contentType === 'rich_html') {
      // Simple markdown-like rendering
      let html = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-[#f0ede6] px-1 rounded text-sm">$1</code>')
        .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-[#e0dbd2] pl-4 italic text-[#6b6560] my-2">$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
        .replace(/@(\w+)/g, '<span class="text-[#1a3aa3] font-medium bg-[#eef1f8] px-1 rounded">@$1</span>')
        .replace(/\n/g, '<br>');
      
      return <div dangerouslySetInnerHTML={{ __html: html }} className="prose prose-sm max-w-none" />;
    }
    
    return <p className="whitespace-pre-wrap">{content}</p>;
  };

  const reactionButtons = [
    { type: 'like', icon: ThumbsUp, label: 'Μου αρέσει' },
    { type: 'love', icon: Heart, label: 'Αγάπη' },
    { type: 'laugh', icon: Laugh, label: 'Γέλιο' },
    { type: 'angry', icon: Angry, label: 'Θυμός' },
    { type: 'sad', icon: Frown, label: 'Λύπη' }
  ];

  const canEdit = currentUser && (currentUser.id === post.user?.id || currentUser.role === 'admin');
  const canReply = currentUser && depth < maxDepth;

  return (
    <div className={`${depth > 0 ? 'ml-8 mt-4' : ''}`}>
      <Card className={`${depth > 0 ? 'border-l-4 border-l-[#d0d8ee]' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              {/* Enhanced Avatar */}
              <Avatar className="w-10 h-10">
                <AvatarImage 
                  src={post.user?.avatar_url} 
                  alt={post.user?.username || 'User'} 
                />
                <AvatarFallback className={`${getAvatarColor(post.user?.username)} text-white font-medium`}>
                  {getUserInitials(post.user?.username)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-[#2a2520]">
                    {post.user?.username || 'Άγνωστος'}
                  </span>
                  {post.user?.role === 'admin' && (
                    <Badge variant="destructive" className="text-xs">
                      Admin
                    </Badge>
                  )}
                  {post.user?.role === 'moderator' && (
                    <Badge variant="secondary" className="text-xs">
                      Moderator
                    </Badge>
                  )}
                  {depth > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Απάντηση
                    </Badge>
                  )}
                  {post.edit_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Επεξεργασμένο
                    </Badge>
                  )}
                </div>
                
                {/* Enhanced timestamp with relative time */}
                <div className="flex items-center space-x-2 text-sm text-[#8a8580]">
                  <Clock className="w-3 h-3" />
                  <span title={formatDate(post.created_at)}>
                    {formatRelativeTime(post.created_at)}
                  </span>
                  {post.edited_at && (
                    <span className="text-xs">
                      • Επεξεργάστηκε {formatRelativeTime(post.edited_at)}
                    </span>
                  )}
                </div>

                {/* Engagement Stats */}
                <div className="flex items-center space-x-4 mt-2 text-xs text-[#8a8580]">
                  <div className="flex items-center space-x-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>{engagementStats.replies} απαντήσεις</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="w-3 h-3" />
                    <span>{engagementStats.views} προβολές</span>
                  </div>
                  {engagementStats.likes > 0 && (
                    <div className="flex items-center space-x-1">
                      <ThumbsUp className="w-3 h-3" />
                      <span>{engagementStats.likes} likes</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {canEdit && (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditForm(!showEditForm)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {showEditForm ? (
            <div className="space-y-3">
              <RichTextEditor
                value={editContent}
                onChange={setEditContent}
                placeholder="Επεξεργαστείτε το μήνυμά σας..."
              />
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={handleEdit} 
                  disabled={isSubmitting}
                  size="sm"
                >
                  Αποθήκευση
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowEditForm(false)}
                  size="sm"
                >
                  Ακύρωση
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Post Content */}
              <div className="prose prose-sm max-w-none">
                {renderContent(post.content, post.content_type)}
              </div>

              {/* Tags */}
              {postTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {postTags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Attachments */}
              {post.attachment_count > 0 && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAttachments(!showAttachments)}
                    className="text-xs"
                  >
                    <Paperclip className="w-3 h-3 mr-1" />
                    {post.attachment_count} συνημμένα
                  </Button>
                  
                  {showAttachments && attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center space-x-2 p-2 bg-[#faf8f4] rounded">
                          <ImageIcon className="w-4 h-4 text-[#8a8580]" />
                          <span className="text-sm flex-1">{attachment.filename}</span>
                          <Button size="sm" variant="ghost">
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reactions */}
              <div className="flex items-center space-x-4 pt-3 border-t">
                <div className="flex items-center space-x-2">
                  {reactionButtons.map((reaction) => {
                    const Icon = reaction.icon;
                    const count = reactions[reaction.type] || 0;
                    return (
                      <Button
                        key={reaction.type}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(reaction.type)}
                        className="h-8 px-2 text-xs"
                      >
                        <Icon className="w-3 h-3 mr-1" />
                        {count > 0 && <span>{count}</span>}
                      </Button>
                    );
                  })}
                </div>

                {canReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="h-8 px-2 text-xs"
                  >
                    <Reply className="w-3 h-3 mr-1" />
                    Απάντηση
                  </Button>
                )}
              </div>

              {/* Reply Form */}
              {showReplyForm && (
                <div className="mt-4 p-3 bg-[#faf8f4] rounded-lg">
                  <RichTextEditor
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder="Γράψτε την απάντησή σας..."
                    minHeight="100px"
                  />
                  <div className="flex items-center space-x-2 mt-3">
                    <Button 
                      onClick={handleReply} 
                      disabled={isSubmitting || !replyContent.trim()}
                      size="sm"
                    >
                      Αποστολή
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowReplyForm(false)}
                      size="sm"
                    >
                      Ακύρωση
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nested Replies */}
      {showReplies && post.replies && post.replies.length > 0 && (
        <div className="mt-4">
          {post.replies.map((reply) => (
            <PostItem
              key={reply.id}
              post={reply}
              depth={depth + 1}
              onReply={onReply}
              onEdit={onEdit}
              onReact={onReact}
              currentUser={currentUser}
              showReplies={showReplies}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Thread Component - Contains multiple posts
 */
function PostThread({ 
  posts = [], 
  currentUser, 
  onReply, 
  onEdit, 
  onReact,
  showReplies = true,
  maxDepth = 5 
}) {
  if (!posts || posts.length === 0) {
    return (
      <div className="text-center py-8 text-[#8a8580]">
        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-[#c0b89e]" />
        <p>Δεν υπάρχουν μηνύματα σε αυτή τη συζήτηση</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostItem
          key={post.id}
          post={post}
          depth={0}
          onReply={onReply}
          onEdit={onEdit}
          onReact={onReact}
          currentUser={currentUser}
          showReplies={showReplies}
          maxDepth={maxDepth}
        />
      ))}
    </div>
  );
}

export default PostThread;

