import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
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
  Eye
} from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import api from '@/lib/api';

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

  useEffect(() => {
    if (post.attachment_count > 0) {
      fetchAttachments();
    }
  }, [post.id]);

  const fetchAttachments = async () => {
    try {
      const { data } = await api.get(`/api/posts/${post.id}/attachments`);
      setAttachments(data.attachments || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onReply(post.id, replyContent);
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onEdit(post.id, editContent);
      setShowEditForm(false);
    } catch (error) {
      console.error('Error editing post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = async (reactionType) => {
    try {
      const response = await onReact(post.id, reactionType);
      setReactions(response.reaction_counts || {});
    } catch (error) {
      console.error('Error reacting to post:', error);
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

  const renderContent = (content, contentType = 'text') => {
    if (contentType === 'rich_html') {
      // Simple markdown-like rendering
      let html = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
        .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
        .replace(/@(\w+)/g, '<span class="text-blue-600 font-medium bg-blue-50 px-1 rounded">@$1</span>')
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
      <Card className={`${depth > 0 ? 'border-l-4 border-l-blue-200' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {post.user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{post.user?.username || 'Άγνωστος'}</span>
                  {depth > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Απάντηση
                    </Badge>
                  )}
                  {post.edit_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Επεξεργασμένο
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(post.created_at)}
                  {post.edited_at && (
                    <span className="ml-2">
                      • Επεξεργάστηκε {formatDate(post.edited_at)}
                    </span>
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
                  {isSubmitting ? 'Αποθήκευση...' : 'Αποθήκευση'}
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
            <>
              {renderContent(post.content, post.content_type)}
              
              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAttachments(!showAttachments)}
                    className="mb-2"
                  >
                    <Paperclip className="h-4 w-4 mr-1" />
                    {attachments.length} συνημμένα
                  </Button>
                  
                  {showAttachments && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="border rounded p-2 flex items-center space-x-2">
                          {attachment.is_image ? (
                            <ImageIcon className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Paperclip className="h-4 w-4 text-gray-500" />
                          )}
                          <span className="flex-1 text-sm truncate">
                            {attachment.original_filename}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/api/attachments/${attachment.id}/download`, '_blank')}
                            className="h-6 w-6 p-0"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reactions */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center space-x-1">
                  {reactionButtons.map((reaction) => {
                    const Icon = reaction.icon;
                    const count = reactions[reaction.type] || 0;
                    return (
                      <Button
                        key={reaction.type}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReaction(reaction.type)}
                        className={`h-8 px-2 ${count > 0 ? 'text-blue-600 bg-blue-50' : ''}`}
                        title={reaction.label}
                      >
                        <Icon className="h-4 w-4" />
                        {count > 0 && <span className="ml-1 text-xs">{count}</span>}
                      </Button>
                    );
                  })}
                </div>

                {canReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReplyForm(!showReplyForm)}
                    className="h-8 px-3"
                  >
                    <Reply className="h-4 w-4 mr-1" />
                    Απάντηση
                  </Button>
                )}
              </div>

              {/* Reply Form */}
              {showReplyForm && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <RichTextEditor
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder="Γράψτε την απάντησή σας..."
                  />
                  <div className="flex items-center space-x-2 mt-3">
                    <Button 
                      onClick={handleReply} 
                      disabled={isSubmitting}
                      size="sm"
                    >
                      {isSubmitting ? 'Αποστολή...' : 'Απάντηση'}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Main PostThread Component
 * Displays a threaded conversation with nested replies
 */
function PostThread({ 
  posts = [], 
  onReply, 
  onEdit, 
  onReact, 
  currentUser,
  maxDepth = 5,
  onRefresh 
}) {
  const [expandedPosts, setExpandedPosts] = useState(new Set());

  // Organize posts into a tree structure
  const organizePostsIntoTree = (posts) => {
    const postMap = new Map();
    const rootPosts = [];

    // First pass: create map of all posts
    posts.forEach(post => {
      postMap.set(post.id, { ...post, replies: [] });
    });

    // Second pass: organize into tree
    posts.forEach(post => {
      if (post.parent_id && postMap.has(post.parent_id)) {
        postMap.get(post.parent_id).replies.push(postMap.get(post.id));
      } else {
        rootPosts.push(postMap.get(post.id));
      }
    });

    return rootPosts;
  };

  const renderPostWithReplies = (post, depth = 0) => {
    const hasReplies = post.replies && post.replies.length > 0;
    const isExpanded = expandedPosts.has(post.id);

    return (
      <div key={post.id}>
        <PostItem
          post={post}
          depth={depth}
          onReply={onReply}
          onEdit={onEdit}
          onReact={onReact}
          currentUser={currentUser}
          maxDepth={maxDepth}
        />

        {hasReplies && (
          <div className="mt-2">
            {depth < maxDepth ? (
              <>
                {(isExpanded || depth === 0) && (
                  <div>
                    {post.replies.map(reply => 
                      renderPostWithReplies(reply, depth + 1)
                    )}
                  </div>
                )}
                
                {depth > 0 && !isExpanded && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedPosts(prev => new Set([...prev, post.id]))}
                    className="ml-8 mt-2"
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    Εμφάνιση {post.replies.length} απαντήσεων
                  </Button>
                )}
              </>
            ) : (
              <div className="ml-8 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  className="text-blue-600"
                >
                  Δείτε περισσότερες απαντήσεις...
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const organizedPosts = organizePostsIntoTree(posts);

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Δεν υπάρχουν μηνύματα ακόμα.</p>
        <p className="text-sm">Γίνετε ο πρώτος που θα συμμετάσχει στη συζήτηση!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {organizedPosts.map(post => renderPostWithReplies(post))}
    </div>
  );
}

export default PostThread;

