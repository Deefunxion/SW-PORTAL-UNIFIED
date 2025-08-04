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
import api from '@/lib/api';

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
        const { data: filesData } = await api.get('/api/files/structure');

        // Fetch forum discussions
        const { data: discussionsData } = await api.get('/api/discussions');

        // Fetch categories
        const { data: categoriesData } = await api.get('/api/categories');

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
    <div className="container mx-auto px-12 py-20 max-w-8xl">
      {/* Hero Section */}
      <div className="text-center mb-24">
        <div className="animate-fade-in">
          <h1 className="text-6xl md:text-8xl font-bold text-[#1e3a8a] mb-12 leading-tight">
            Καλώς ήρθατε στο{' '}
            <span className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent">
              SW Portal
            </span>
          </h1>
          <p className="text-3xl md:text-4xl text-gray-700 mb-16 max-w-6xl mx-auto leading-relaxed font-medium">
            Ενιαίο σύστημα διαχείρισης αρχείων, φόρουμ συζητήσεων και AI Assistant{' '}
            <br className="hidden md:block" />
            για την Περιφέρεια Αττικής
          </p>
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <Badge variant="secondary" className="text-lg px-10 py-5 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 transition-colors font-semibold rounded-2xl">
              🏢 Περιφέρεια Αττικής
            </Badge>
            <Badge variant="secondary" className="text-lg px-10 py-5 bg-green-50 text-green-800 border-green-200 hover:bg-green-100 transition-colors font-semibold rounded-2xl">
              🔒 Ασφαλές Περιβάλλον
            </Badge>
            <Badge variant="secondary" className="text-lg px-10 py-5 bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100 transition-colors font-semibold rounded-2xl">
              🚀 Τοπική Εγκατάσταση
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
        <Card className="text-center hover:shadow-2xl transition-all duration-300 border-0 shadow-xl hover:scale-105 p-10">
          <CardHeader className="pb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <FileText className="w-12 h-12 text-white" />
            </div>
            <CardTitle className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
              {stats.totalFiles}
            </CardTitle>
            <CardDescription className="text-xl font-semibold text-gray-600">Συνολικά Αρχεία</CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center hover:shadow-2xl transition-all duration-300 border-0 shadow-xl hover:scale-105 p-10">
          <CardHeader className="pb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
            <CardTitle className="text-5xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent mb-4">
              {stats.totalDiscussions}
            </CardTitle>
            <CardDescription className="text-xl font-semibold text-gray-600">Συζητήσεις Φόρουμ</CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center hover:shadow-2xl transition-all duration-300 border-0 shadow-xl hover:scale-105 p-10">
          <CardHeader className="pb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Users className="w-12 h-12 text-white" />
            </div>
            <CardTitle className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent mb-4">
              {stats.totalCategories}
            </CardTitle>
            <CardDescription className="text-xl font-semibold text-gray-600">Κατηγορίες</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card key={index} className="group hover:shadow-2xl transition-all duration-500 border-0 shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-blue-500 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
              <CardHeader className="relative p-10">
                <div className={`w-24 h-24 ${feature.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl`}>
                  <Icon className="w-12 h-12 text-white" />
                </div>
                <CardTitle className="text-3xl mb-6 group-hover:text-blue-700 transition-colors font-bold">{feature.title}</CardTitle>
                <CardDescription className="text-gray-600 text-xl leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                <div className="space-y-4 mb-10">
                  {feature.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center text-lg text-gray-700 group-hover:text-gray-800 transition-colors">
                      <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full mr-4 group-hover:scale-125 transition-transform"></div>
                      <span className="font-semibold">{feat}</span>
                    </div>
                  ))}
                </div>
                <Link to={feature.link}>
                  <Button className="w-full group-hover:bg-blue-600 group-hover:shadow-xl transition-all duration-300 h-16 text-lg font-bold rounded-2xl">
                    Περισσότερα
                    <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card className="mb-12 hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            Πρόσφατη Δραστηριότητα
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-blue-50 hover:to-blue-100 transition-all duration-300 border-l-4 border-l-transparent hover:border-l-blue-500 group">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-4 shadow-md group-hover:scale-125 transition-transform ${
                    activity.type === 'file' ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                    activity.type === 'forum' ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-purple-400 to-purple-600'
                  }`}></div>
                  <span className="text-gray-800 font-medium group-hover:text-gray-900">{activity.message}</span>
                </div>
                <span className="text-sm text-gray-500 group-hover:text-gray-600 font-medium">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="hover:shadow-2xl transition-all duration-300 border-0 shadow-xl">
        <CardHeader className="p-10">
          <CardTitle className="text-3xl flex items-center font-bold text-[#1e3a8a]">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mr-6 shadow-xl">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            Γρήγορες Ενέργειες
          </CardTitle>
          <CardDescription className="text-xl mt-4">Συχνά χρησιμοποιούμενες λειτουργίες</CardDescription>
        </CardHeader>
        <CardContent className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Link to="/apothecary">
              <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-blue-50 hover:border-blue-300 hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
                <Download className="w-10 h-10 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-lg font-bold text-gray-700 group-hover:text-blue-700">Κατέβασμα Αρχείων</span>
              </Button>
            </Link>
            
            <Link to="/forum">
              <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-green-50 hover:border-green-300 hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
                <MessageSquare className="w-10 h-10 text-green-600 group-hover:scale-110 transition-transform" />
                <span className="text-lg font-bold text-gray-700 group-hover:text-green-700">Νέα Συζήτηση</span>
              </Button>
            </Link>
            
            <Link to="/assistant">
              <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-purple-50 hover:border-purple-300 hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
                <Bot className="w-10 h-10 text-purple-600 group-hover:scale-110 transition-transform" />
                <span className="text-lg font-bold text-gray-700 group-hover:text-purple-700">Ρώτησε το AI</span>
              </Button>
            </Link>
            
            <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-orange-50 hover:border-orange-300 hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
              <TrendingUp className="w-10 h-10 text-orange-600 group-hover:scale-110 transition-transform" />
              <span className="text-lg font-bold text-gray-700 group-hover:text-orange-700">Στατιστικά</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;