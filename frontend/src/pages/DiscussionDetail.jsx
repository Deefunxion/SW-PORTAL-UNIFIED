import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  ArrowLeft, 
  MessageCircle, 
  Clock, 
  User, 
  Send,
  Reply
} from 'lucide-react';

function DiscussionDetail() {
  const { discussionId } = useParams();
  const [discussion, setDiscussion] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (discussionId) {
      fetchDiscussionDetails();
    }
  }, [discussionId]);

  const fetchDiscussionDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:5000/api/discussions/${discussionId}/posts`);
      const data = await response.json();
      
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
      const response = await fetch(`http://localhost:5000/api/discussions/${discussionId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newPost
        }),
      });

      if (response.ok) {
        setNewPost('');
        fetchDiscussionDetails(); // Refresh posts
      }
    } catch (error) {
      console.error('Error submitting post:', error);
      alert('Σφάλμα κατά την αποστολή του μηνύματος');
    } finally {
      setIsSubmitting(false);
    }
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
        <Card className="text-center py-12">
          <CardContent>
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              Η συζήτηση δεν βρέθηκε
            </h3>
            <p className="text-gray-500 mb-4">
              Η συζήτηση που ψάχνετε δεν υπάρχει ή έχει διαγραφεί.
            </p>
            <Link to="/forum">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Επιστροφή στο Φόρουμ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/forum">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Επιστροφή στο Φόρουμ
          </Button>
        </Link>
        
        <Card>
          <CardHeader className="bg-gray-800 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xl">{getCategoryIcon(discussion.category)}</span>
                  <Badge variant="secondary" className="text-gray-800">
                    {discussion.category}
                  </Badge>
                </div>
                <CardTitle className="text-2xl mb-2">{discussion.title}</CardTitle>
                {discussion.description && (
                  <CardDescription className="text-gray-300">
                    {discussion.description}
                  </CardDescription>
                )}
              </div>
              <div className="text-right text-sm text-gray-300">
                <div className="flex items-center mb-1">
                  <MessageCircle className="w-4 h-4 mr-1" />
                  {posts.length} μηνύματα
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Δημιουργήθηκε {formatDate(posts[0]?.created_at)}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Posts */}
      <div className="space-y-4 mb-8">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <Card key={post.id} className={index === 0 ? 'border-l-4 border-l-blue-500' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{post.user}</div>
                      <div className="text-sm text-gray-500">
                        {formatDate(post.created_at)}
                      </div>
                    </div>
                  </div>
                  {index === 0 && (
                    <Badge variant="outline">Αρχικό Μήνυμα</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="text-center py-8">
            <CardContent>
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Δεν υπάρχουν μηνύματα σε αυτή τη συζήτηση ακόμα.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reply Form */}
      <Card className="sticky bottom-4">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Reply className="w-5 h-5 mr-2" />
            Απάντηση στη Συζήτηση
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Γράψτε την απάντησή σας..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows={4}
              className="resize-none"
            />
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {newPost.length}/1000 χαρακτήρες
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setNewPost('')}
                  disabled={!newPost.trim()}
                >
                  Καθαρισμός
                </Button>
                <Button
                  onClick={handleSubmitPost}
                  disabled={!newPost.trim() || isSubmitting || newPost.length > 1000}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Αποστολή...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Αποστολή Απάντησης
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DiscussionDetail;

