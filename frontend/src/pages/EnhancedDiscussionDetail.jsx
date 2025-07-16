import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  ArrowLeft, 
  MessageCircle, 
  Clock, 
  User, 
  Send,
  Reply,
  Paperclip,
  Plus,
  RefreshCw
} from 'lucide-react';

// Import enhanced components
import RichTextEditor from "../components/RichTextEditor";
import PostThread from './PostThread';
import AttachmentUploader from './AttachmentUploader';
import AttachmentGallery from './AttachmentGallery';
import ReputationBadge from './ReputationBadge';
import { useAuth } from './AuthContext';
import api from '@/lib/api';

/**
 * Enhanced Discussion Detail Page
 * Features: Rich text editing, threading, attachments, reactions, reputation
 */
function EnhancedDiscussionDetail() {
  const { discussionId } = useParams();
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAttachmentUploader, setShowAttachmentUploader] = useState(false);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (discussionId) {
      fetchDiscussionDetails();
    }
  }, [discussionId, refreshKey]);

  const fetchDiscussionDetails = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get(`/api/discussions/${discussionId}/posts`);
      setDiscussion(data.discussion);
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching discussion details:', error);
      setDiscussion(null);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitPost = async () => {
    if (!newPost.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await api.post(`/api/discussions/${discussionId}/posts`, {
        content: newPost,
        content_type: 'rich_html'
      });

      setNewPost('');
      setShowAttachmentUploader(false);
      fetchDiscussionDetails(); // Refresh posts
    } catch (error) {
      console.error('Error submitting post:', error);
      alert('Σφάλμα κατά την αποστολή του μηνύματος');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentPostId, content) => {
    try {
      await api.post(`/api/posts/${parentPostId}/replies`, {
        content: content,
        content_type: 'rich_html'
      });
      fetchDiscussionDetails(); // Refresh posts
    } catch (error) {
      console.error('Error submitting reply:', error);
      throw error;
    }
  };

  const handleEditPost = async (postId, content) => {
    try {
      await api.put(`/api/posts/${postId}`, {
        content: content,
        content_type: 'rich_html'
      });
      fetchDiscussionDetails(); // Refresh posts
    } catch (error) {
      console.error('Error editing post:', error);
      throw error;
    }
  };

  const handleReaction = async (postId, reactionType) => {
    try {
      const response = await api.post(`/api/posts/${postId}/reactions`, {
        reaction_type: reactionType
      });
      return response.data;
    } catch (error) {
      console.error('Error reacting to post:', error);
      throw error;
    }
  };

  const handleMentionSearch = async (query) => {
    if (query.length < 2) {
      setMentionUsers([]);
      return;
    }

    try {
      const { data } = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      setMentionUsers(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setMentionUsers([]);
    }
  };

  const handleAttachmentUpload = (attachment) => {
    console.log('Attachment uploaded:', attachment);
    // Optionally refresh posts to show new attachment
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Άγνωστη ημερομηνία';
    return new Date(dateString).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryIcon = (categoryTitle) => {
    const iconMap = {
      'ΓΕΝΙΚΑ ΘΕΜΑΤΑ': '💬',
      'ΔΥΣΚΟΛΑ ΘΕΜΑΤΑ': '⚠️',
      'ΕΜΠΙΣΤΕΥΤΙΚΑ ΘΕΜΑΤΑ': '🔒',
      'ΝΟΜΙΚΑ ΘΕΜΑΤΑ': '⚖️',
      'ΠΡΟΤΑΣΕΙΣ': '💡',
      'ΝΕΑ - ΑΝΑΚΟΙΝΩΣΕΙΣ': '📢'
    };
    return iconMap[categoryTitle] || '📁';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Φόρτωση συζήτησης...</p>
        </div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Η συζήτηση δεν βρέθηκε
          </h2>
          <p className="text-gray-500 mb-4">
            Η συζήτηση που ψάχνετε δεν υπάρχει ή έχει διαγραφεί.
          </p>
          <Link to="/forum">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Επιστροφή στο Forum
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link to="/forum">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Επιστροφή στο Forum
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">
                    {getCategoryIcon(discussion.category?.title)}
                  </span>
                  <Badge variant="secondary">
                    {discussion.category?.title || 'Γενικά'}
                  </Badge>
                </div>
                
                <CardTitle className="text-2xl mb-2">
                  {discussion.title}
                </CardTitle>
                
                {discussion.description && (
                  <CardDescription className="text-base">
                    {discussion.description}
                  </CardDescription>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>Δημιουργήθηκε από {discussion.user?.username || 'Άγνωστος'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatDate(discussion.created_at)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>{posts.length} μηνύματα</span>
                </div>
              </div>

              {discussion.user && (
                <ReputationBadge 
                  userId={discussion.user.id} 
                  username={discussion.user.username}
                  size="sm"
                />
              )}
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Posts Thread */}
      <div className="mb-8">
        <PostThread
          posts={posts}
          onReply={handleReply}
          onEdit={handleEditPost}
          onReact={handleReaction}
          currentUser={user}
          maxDepth={5}
          onRefresh={handleRefresh}
        />
      </div>

      {/* New Post Form */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Νέο Μήνυμα</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <RichTextEditor
                value={newPost}
                onChange={setNewPost}
                placeholder="Γράψτε το μήνυμά σας..."
                disabled={isSubmitting}
                mentionUsers={mentionUsers}
                onMentionSearch={handleMentionSearch}
              />

              {/* Attachment Uploader */}
              {showAttachmentUploader && (
                <div className="border-t pt-4">
                  <AttachmentUploader
                    postId={null} // Will be set after post creation
                    onUploadComplete={handleAttachmentUpload}
                    onUploadError={(error) => console.error('Upload error:', error)}
                    disabled={isSubmitting}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAttachmentUploader(!showAttachmentUploader)}
                    disabled={isSubmitting}
                  >
                    <Paperclip className="h-4 w-4 mr-1" />
                    {showAttachmentUploader ? 'Απόκρυψη' : 'Συνημμένα'}
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setNewPost('')}
                    disabled={isSubmitting || !newPost.trim()}
                  >
                    Καθαρισμός
                  </Button>
                  <Button
                    onClick={handleSubmitPost}
                    disabled={isSubmitting || !newPost.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Αποστολή...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Αποστολή
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Login prompt for guests */}
      {!user && (
        <Card>
          <CardContent className="text-center py-8">
            <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Συνδεθείτε για να συμμετάσχετε
            </h3>
            <p className="text-gray-500 mb-4">
              Πρέπει να συνδεθείτε για να γράψετε μήνυμα σε αυτή τη συζήτηση.
            </p>
            <Link to="/login">
              <Button>
                Σύνδεση
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EnhancedDiscussionDetail;

