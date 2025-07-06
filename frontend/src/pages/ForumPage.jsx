import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
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
  Send
} from 'lucide-react';

function ForumPage() {
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

  useEffect(() => {
    fetchDiscussions();
    fetchCategories();
  }, []);

  const fetchDiscussions = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/discussions');
      const data = await response.json();
      setDiscussions(data);
    } catch (error) {
      console.error('Error fetching discussions:', error);
      setDiscussions([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/categories');
      const data = await response.json();
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
      const response = await fetch('http://localhost:5000/api/discussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newDiscussion),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewDiscussion({ title: '', description: '', category_id: '' });
        fetchDiscussions(); // Refresh discussions
      }
    } catch (error) {
      console.error('Create discussion error:', error);
      alert('Σφάλμα κατά τη δημιουργία της συζήτησης');
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Φόρτωση φόρουμ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          💬 Φόρουμ Συζητήσεων
        </h1>
        <p className="text-gray-600">
          Επαγγελματικό φόρουμ για συζητήσεις και ανταλλαγή απόψεων
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Αναζήτηση συζητήσεων..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Create Discussion Button */}
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Νέα Συζήτηση
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Forum Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {discussions.reduce((acc, cat) => acc + (cat.discussions?.length || 0), 0)}
            </div>
            <div className="text-sm text-gray-600">Συνολικές Συζητήσεις</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{categories.length}</div>
            <div className="text-sm text-gray-600">Κατηγορίες</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {discussions.reduce((acc, cat) => 
                acc + (cat.discussions?.reduce((sum, disc) => sum + (disc.post_count || 0), 0) || 0), 0
              )}
            </div>
            <div className="text-sm text-gray-600">Συνολικά Μηνύματα</div>
          </CardContent>
        </Card>
      </div>

      {/* Categories and Discussions */}
      <div className="space-y-6">
        {filteredDiscussions.map((category) => (
          <Card key={category.category} className="overflow-hidden">
            <CardHeader className="bg-gray-800 text-white">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getCategoryIcon(category.category)}</span>
                <div>
                  <CardTitle className="text-xl">{category.category}</CardTitle>
                  <CardDescription className="text-gray-300">
                    {category.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              {category.discussions && category.discussions.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {category.discussions.map((discussion) => (
                    <Link
                      key={discussion.id}
                      to={`/forum/${discussion.id}`}
                      className="block hover:bg-gray-50 transition-colors duration-200"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 mb-1">
                              {discussion.title}
                            </h3>
                            {discussion.description && (
                              <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                                {discussion.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <div className="flex items-center">
                                <MessageCircle className="w-3 h-3 mr-1" />
                                {discussion.post_count || 0} μηνύματα
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatDate(discussion.updated_at)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-4 text-right">
                            <Badge variant="secondary">
                              {discussion.post_count || 0}
                            </Badge>
                            {discussion.last_post && (
                              <div className="mt-2 text-xs text-gray-500">
                                <div>Τελευταίο από:</div>
                                <div className="font-medium">{discussion.last_post.user}</div>
                                <div>{formatDate(discussion.last_post.created_at)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>Δεν υπάρχουν συζητήσεις σε αυτή την κατηγορία</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Ξεκινήστε τη πρώτη συζήτηση
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Discussion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Δημιουργία Νέας Συζήτησης</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Κατηγορία *
                  </label>
                  <select
                    value={newDiscussion.category_id}
                    onChange={(e) => setNewDiscussion({
                      ...newDiscussion,
                      category_id: e.target.value
                    })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Επιλέξτε κατηγορία...</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {getCategoryIcon(category.title)} {category.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Τίτλος Συζήτησης *
                  </label>
                  <Input
                    placeholder="Εισάγετε τον τίτλο της συζήτησης..."
                    value={newDiscussion.title}
                    onChange={(e) => setNewDiscussion({
                      ...newDiscussion,
                      title: e.target.value
                    })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Περιγραφή (προαιρετικό)
                  </label>
                  <Textarea
                    placeholder="Περιγράψτε το θέμα της συζήτησης..."
                    value={newDiscussion.description}
                    onChange={(e) => setNewDiscussion({
                      ...newDiscussion,
                      description: e.target.value
                    })}
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleCreateDiscussion}
                    className="flex-1"
                    disabled={!newDiscussion.title.trim() || !newDiscussion.category_id}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Δημιουργία Συζήτησης
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1"
                  >
                    Ακύρωση
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {filteredDiscussions.length === 0 && !isLoading && (
        <Card className="text-center py-12">
          <CardContent>
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {searchTerm ? 'Δεν βρέθηκαν συζητήσεις' : 'Δεν υπάρχουν συζητήσεις ακόμα'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm 
                ? 'Δοκιμάστε διαφορετικούς όρους αναζήτησης' 
                : 'Ξεκινήστε τη πρώτη συζήτηση στο φόρουμ'
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Δημιουργία Πρώτης Συζήτησης
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ForumPage;

