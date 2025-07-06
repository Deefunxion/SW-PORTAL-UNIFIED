import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  Files, 
  MessageSquare, 
  Bot, 
  Users, 
  Download,
  TrendingUp,
  Clock,
  FileText,
  ArrowRight
} from 'lucide-react';

function HomePage() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalDiscussions: 0,
    totalCategories: 0,
    recentActivity: []
  });

  useEffect(() => {
    // Fetch dashboard stats
    const fetchStats = async () => {
      try {
        // Fetch file structure
        const filesResponse = await fetch('http://localhost:5000/api/files/structure');
        const filesData = await filesResponse.json();
        
        // Fetch forum discussions
        const discussionsResponse = await fetch('http://localhost:5000/api/discussions');
        const discussionsData = await discussionsResponse.json();
        
        // Fetch categories
        const categoriesResponse = await fetch('http://localhost:5000/api/categories');
        const categoriesData = await categoriesResponse.json();

        setStats({
          totalFiles: filesData.metadata?.total_files || 0,
          totalDiscussions: discussionsData.reduce((acc, cat) => acc + cat.discussions.length, 0),
          totalCategories: categoriesData.length,
          recentActivity: [
            { type: 'file', message: 'Νέα αρχεία προστέθηκαν στο Apothecary', time: '2 ώρες πριν' },
            { type: 'forum', message: 'Νέα συζήτηση στα Νομικά Θέματα', time: '4 ώρες πριν' },
            { type: 'ai', message: 'AI Assistant ενημερώθηκε', time: '1 μέρα πριν' }
          ]
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  const features = [
    {
      title: 'Apothecary - Αρχεία',
      description: 'Διαχείριση και κατέβασμα αρχείων με προηγμένες λειτουργίες',
      icon: Files,
      link: '/apothecary',
      color: 'bg-blue-500',
      features: ['Drag & Drop', 'Αναζήτηση', 'Κατηγοριοποίηση', 'Bulk Upload']
    },
    {
      title: 'Φόρουμ Συζητήσεων',
      description: 'Επαγγελματικό φόρουμ για συζητήσεις και ανταλλαγή απόψεων',
      icon: MessageSquare,
      link: '/forum',
      color: 'bg-green-500',
      features: ['Κατηγορίες', 'Real-time', 'Moderation', 'Notifications']
    },
    {
      title: 'AI Assistant',
      description: 'Έξυπνος βοηθός για απαντήσεις και υποστήριξη',
      icon: Bot,
      link: '/assistant',
      color: 'bg-purple-500',
      features: ['24/7 Διαθέσιμος', 'Νομικές Συμβουλές', 'Γρήγορες Απαντήσεις', 'Εκμάθηση']
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
          Καλώς ήρθατε στο <span className="text-blue-600">SW Portal</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Ενιαίο σύστημα διαχείρισης αρχείων, φόρουμ συζητήσεων και AI Assistant 
          για την Περιφέρεια Αττικής
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Badge variant="secondary" className="text-sm px-4 py-2">
            🏢 Περιφέρεια Αττικής
          </Badge>
          <Badge variant="secondary" className="text-sm px-4 py-2">
            🔒 Ασφαλές Περιβάλλον
          </Badge>
          <Badge variant="secondary" className="text-sm px-4 py-2">
            🚀 Τοπική Εγκατάσταση
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="text-center">
          <CardHeader className="pb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-blue-600">{stats.totalFiles}</CardTitle>
            <CardDescription>Συνολικά Αρχεία</CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center">
          <CardHeader className="pb-2">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">{stats.totalDiscussions}</CardTitle>
            <CardDescription>Συζητήσεις Φόρουμ</CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center">
          <CardHeader className="pb-2">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-purple-600">{stats.totalCategories}</CardTitle>
            <CardDescription>Κατηγορίες</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md">
              <CardHeader>
                <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                <CardDescription className="text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-6">
                  {feature.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center text-sm text-gray-600">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                      {feat}
                    </div>
                  ))}
                </div>
                <Link to={feature.link}>
                  <Button className="w-full group-hover:bg-blue-600 transition-colors duration-300">
                    Περισσότερα
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Πρόσφατη Δραστηριότητα
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-3 ${
                    activity.type === 'file' ? 'bg-blue-500' :
                    activity.type === 'forum' ? 'bg-green-500' : 'bg-purple-500'
                  }`}></div>
                  <span className="text-gray-800">{activity.message}</span>
                </div>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Γρήγορες Ενέργειες</CardTitle>
          <CardDescription>Συχνά χρησιμοποιούμενες λειτουργίες</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/apothecary">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50">
                <Download className="w-6 h-6" />
                <span className="text-sm">Κατέβασμα Αρχείων</span>
              </Button>
            </Link>
            
            <Link to="/forum">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-green-50">
                <MessageSquare className="w-6 h-6" />
                <span className="text-sm">Νέα Συζήτηση</span>
              </Button>
            </Link>
            
            <Link to="/assistant">
              <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-purple-50">
                <Bot className="w-6 h-6" />
                <span className="text-sm">Ρώτησε το AI</span>
              </Button>
            </Link>
            
            <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50">
              <TrendingUp className="w-6 h-6" />
              <span className="text-sm">Στατιστικά</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;

