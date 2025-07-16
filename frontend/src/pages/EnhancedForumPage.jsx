import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Clock, 
  User, 
  MessageCircle,
  TrendingUp,
  X,
  Send,
  Star,
  Award,
  RefreshCw
} from 'lucide-react';

// Import enhanced components
import RichTextEditor from './RichTextEditor';
import ReputationBadge, { ReputationLeaderboard } from './ReputationBadge';
import { useAuth } from './AuthContext';
import api from '@/lib/api';

/**
 * Enhanced Forum Page
 * Features: Rich text creation, reputation display, improved UI
 */
function EnhancedForumPage() {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDiscussion, setNewDiscussion] = useState({
    title: '',
    description: '',
    category_id: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionUsers, setMentionUsers] = useState([]);

  useEffect(() => {
    fetchDiscussions();
    fetchCategories();
  }, []);

  const fetchDiscussions = async () => {
    try {
      const { data } = await api.get('/api/discussions');
      setDiscussions(data);
    } catch (error) {
      console.error('Error fetching discussions:', error);
      setDiscussions([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/api/categories');
      setCategories(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
      setIsLoading(false);
    }
  };

  const handleCreateDiscussion = async () => {
    if (!newDiscussion.title.trim() || !newDiscussion.category_id) return;

    try {
      setIsSubmitting(true);
      await api.post('/api/discussions', {
        ...newDiscussion,
        content_type: 'rich_html'
      });
      
      setShowCreateModal(false);
      setNewDiscussion({ title: '', description: '', category_id: '' });
      fetchDiscussions(); // Refresh discussions
    } catch (error) {
      console.error('Create discussion error:', error);
      alert('Σφάλμα κατά τη δημιουργία της συζήτησης');
    } finally {
      setIsSubmitting(false);
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

  const filteredDiscussions = discussions.map(category => ({
    ...category,
    discussions: category.discussions?.filter(discussion =>
      discussion.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discussion.description.toLowerCase().includes(searchTerm.toLowerCase())
    ) || []
  })).filter(category => category.discussions.length > 0);

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

  const formatDate = (dateString) => {
    if (!dateString) return 'Άγνωστη ημερομηνία';
    return new Date(dateString).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalPosts = () => {
    return discussions.reduce((total, category) => {
      return total + (category.discussions?.reduce((catTotal, discussion) => {
        return catTotal + (discussion.post_count || 0);
      }, 0) || 0);
    }, 0);
  };

  const getTotalDiscussions = () => {
    return discussions.reduce((total, category) => {
      return total + (category.discussions?.length || 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Φόρτωση forum...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Forum Συζητήσεων</h1>
              <p className="text-gray-600">
                {getTotalDiscussions()} συζητήσεις • {getTotalPosts()} μηνύματα
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 sm:mt-0">
              <Button
                variant="outline"
                onClick={() => {
                  fetchDiscussions();
                  fetchCategories();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Ανανέωση
              </Button>
              
              {user && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Νέα Συζήτηση
                </Button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Αναζήτηση συζητήσεων..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Forum Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{getTotalDiscussions()}</p>
                    <p className="text-sm text-gray-600">Συζητήσεις</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <MessageCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{getTotalPosts()}</p>
                    <p className="text-sm text-gray-600">Μηνύματα</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <User className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{categories.length}</p>
                    <p className="text-sm text-gray-600">Κατηγορίες</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Discussions */}
          <div className="space-y-6">
            {filteredDiscussions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    {searchTerm ? 'Δεν βρέθηκαν συζητήσεις' : 'Δεν υπάρχουν συζητήσεις ακόμα'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm 
                      ? 'Δοκιμάστε διαφορετικούς όρους αναζήτησης'
                      : 'Γίνετε ο πρώτος που θα ξεκινήσει μια συζήτηση!'
                    }
                  </p>
                  {!searchTerm && user && (
                    <Button onClick={() => setShowCreateModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Δημιουργία Συζήτησης
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredDiscussions.map((category) => (
                <Card key={category.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <span className="text-2xl">{getCategoryIcon(category.title)}</span>
                      <span>{category.title}</span>
                      <Badge variant="secondary">
                        {category.discussions.length} συζητήσεις
                      </Badge>
                    </CardTitle>
                    {category.description && (
                      <CardDescription>{category.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {category.discussions.map((discussion) => (
                        <div key={discussion.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <Link 
                                to={`/forum/discussion/${discussion.id}`}
                                className="block group"
                              >
                                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                                  {discussion.title}
                                </h3>
                                {discussion.description && (
                                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                                    {discussion.description}
                                  </p>
                                )}
                              </Link>
                              
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <div className="flex items-center space-x-1">
                                  <User className="h-3 w-3" />
                                  <span>{discussion.user?.username || 'Άγνωστος'}</span>
                                  {discussion.user && (
                                    <ReputationBadge 
                                      userId={discussion.user.id}
                                      size="xs"
                                    />
                                  )}
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDate(discussion.created_at)}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <MessageCircle className="h-3 w-3" />
                                  <span>{discussion.post_count || 0} μηνύματα</span>
                                </div>
                              </div>
                            </div>

                            {discussion.last_post && (
                              <div className="ml-4 text-right text-xs text-gray-500 flex-shrink-0">
                                <p>Τελευταίο μήνυμα</p>
                                <p className="font-medium">
                                  {discussion.last_post.user?.username || 'Άγνωστος'}
                                </p>
                                <p>{formatDate(discussion.last_post.created_at)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Info */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Το Προφίλ μου</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-semibold mb-2">{user.username}</h3>
                  <ReputationBadge 
                    userId={user.id}
                    username={user.username}
                    size="lg"
                    showDetails={true}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reputation Leaderboard */}
          <ReputationLeaderboard limit={5} />

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Στατιστικά
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Κατηγορίες:</span>
                  <span className="font-medium">{categories.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Συζητήσεις:</span>
                  <span className="font-medium">{getTotalDiscussions()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Μηνύματα:</span>
                  <span className="font-medium">{getTotalPosts()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Discussion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Νέα Συζήτηση</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Κατηγορία</label>
                  <select
                    value={newDiscussion.category_id}
                    onChange={(e) => setNewDiscussion(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                    disabled={isSubmitting}
                  >
                    <option value="">Επιλέξτε κατηγορία...</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {getCategoryIcon(category.title)} {category.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Τίτλος</label>
                  <Input
                    type="text"
                    value={newDiscussion.title}
                    onChange={(e) => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Εισάγετε τον τίτλο της συζήτησης..."
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Περιγραφή</label>
                  <RichTextEditor
                    value={newDiscussion.description}
                    onChange={(value) => setNewDiscussion(prev => ({ ...prev, description: value }))}
                    placeholder="Περιγράψτε το θέμα της συζήτησης..."
                    disabled={isSubmitting}
                    mentionUsers={mentionUsers}
                    onMentionSearch={handleMentionSearch}
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isSubmitting}
                  >
                    Ακύρωση
                  </Button>
                  <Button
                    onClick={handleCreateDiscussion}
                    disabled={isSubmitting || !newDiscussion.title.trim() || !newDiscussion.category_id}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Δημιουργία...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Δημιουργία
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default EnhancedForumPage;

