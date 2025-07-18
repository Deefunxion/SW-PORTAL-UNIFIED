import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import api from '@/lib/api';
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
  ScrollText,
  ThumbsUp,
  BrainCircuit,
  Users,
  Scale,
  Lightbulb,
  Megaphone,
  Eye
} from 'lucide-react';

// Pinned categories with icons
const pinnedCategories = [
  { 
    name: 'Νομοθεσία', 
    icon: ScrollText, 
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Νομικά θέματα και κανονισμοί'
  },
  { 
    name: 'Καλές Πρακτικές', 
    icon: ThumbsUp, 
    color: 'bg-green-500 hover:bg-green-600',
    description: 'Επιτυχημένες μεθοδολογίες'
  },
  { 
    name: 'Ψυχική Υγεία', 
    icon: BrainCircuit, 
    color: 'bg-purple-500 hover:bg-purple-600',
    description: 'Υποστήριξη και συμβουλές'
  },
  { 
    name: 'Εποπτεία', 
    icon: Users, 
    color: 'bg-orange-500 hover:bg-orange-600',
    description: 'Επαγγελματική καθοδήγηση'
  },
  { 
    name: 'Δικαιοσύνη', 
    icon: Scale, 
    color: 'bg-red-500 hover:bg-red-600',
    description: 'Νομικές υποθέσεις'
  },
  { 
    name: 'Προτάσεις', 
    icon: Lightbulb, 
    color: 'bg-yellow-500 hover:bg-yellow-600',
    description: 'Ιδέες και βελτιώσεις'
  }
];

function ForumPage() {
  const [discussions, setDiscussions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
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
      await api.post('/api/discussions', newDiscussion);
      setShowCreateModal(false);
      setNewDiscussion({ title: '', description: '', category_id: '' });
      fetchDiscussions(); // Refresh discussions
    } catch (error) {
      console.error('Create discussion error:', error);
      alert('Σφάλμα κατά τη δημιουργία της συζήτησης');
    }
  };

  const handleCategoryClick = (categoryName) => {
    setSelectedCategory(selectedCategory === categoryName ? '' : categoryName);
    console.log('Selected category:', categoryName);
  };

  const filteredDiscussions = discussions.map(category => ({
    ...category,
    discussions: category.discussions?.filter(discussion => {
      const matchesSearch = !searchTerm || 
        discussion.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        discussion.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || 
        category.category.toLowerCase().includes(selectedCategory.toLowerCase());
      
      return matchesSearch && matchesCategory;
    }) || []
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

      {/* Pinned Categories */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Κυριότερες Κατηγορίες
          </CardTitle>
          <CardDescription>
            Επιλέξτε μια κατηγορία για γρήγορη πρόσβαση
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {pinnedCategories.map((category) => {
              const IconComponent = category.icon;
              const isSelected = selectedCategory === category.name;
              return (
                <Button
                  key={category.name}
                  variant={isSelected ? "default" : "outline"}
                  className={`h-auto p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleCategoryClick(category.name)}
                >
                  <IconComponent className="w-6 h-6" />
                  <div className="text-center">
                    <div className="font-medium text-sm">{category.name}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {category.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
          {selectedCategory && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Φιλτράρισμα κατά: {selectedCategory}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCategory('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              {searchTerm && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
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

      {/* Search Results Info */}
      {(searchTerm || selectedCategory) && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              {filteredDiscussions.length === 0 ? (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Δεν βρέθηκαν αποτελέσματα
                  {searchTerm && ` για "${searchTerm}"`}
                  {selectedCategory && ` στην κατηγορία "${selectedCategory}"`}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Βρέθηκαν {filteredDiscussions.reduce((acc, cat) => acc + cat.discussions.length, 0)} αποτελέσματα
                  {searchTerm && ` για "${searchTerm}"`}
                  {selectedCategory && ` στην κατηγορία "${selectedCategory}"`}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              Καθαρισμός
            </Button>
          </div>
        </div>
      )}

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
        {filteredDiscussions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Δεν βρέθηκαν αποτελέσματα</h3>
              <p className="text-sm">
                Δοκιμάστε να αλλάξετε τους όρους αναζήτησης ή να καθαρίσετε τα φίλτρα
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDiscussions.map((category) => (
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
                                  <Eye className="w-3 h-3 mr-1" />
                                  {discussion.view_count || 0} προβολές
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
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Δεν υπάρχουν συζητήσεις σε αυτήν την κατηγορία</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Discussion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Νέα Συζήτηση</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Τίτλος
                </label>
                <Input
                  value={newDiscussion.title}
                  onChange={(e) => setNewDiscussion({
                    ...newDiscussion,
                    title: e.target.value
                  })}
                  placeholder="Εισάγετε τίτλο συζήτησης"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Περιγραφή
                </label>
                <Textarea
                  value={newDiscussion.description}
                  onChange={(e) => setNewDiscussion({
                    ...newDiscussion,
                    description: e.target.value
                  })}
                  placeholder="Περιγράψτε τη συζήτηση..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Κατηγορία
                </label>
                <select
                  value={newDiscussion.category_id}
                  onChange={(e) => setNewDiscussion({
                    ...newDiscussion,
                    category_id: e.target.value
                  })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Επιλέξτε κατηγορία</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Ακύρωση
              </Button>
              <Button
                onClick={handleCreateDiscussion}
                disabled={!newDiscussion.title.trim() || !newDiscussion.category_id}
              >
                <Send className="w-4 h-4 mr-2" />
                Δημιουργία
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ForumPage;

