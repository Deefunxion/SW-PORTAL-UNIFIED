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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faShield, faRocket } from '@fortawesome/free-solid-svg-icons';
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

        console.log('API responses:', { filesData, discussionsData, categoriesData });
        
        // Calculate total discussions from all categories
        const totalDiscussions = Array.isArray(discussionsData) 
          ? discussionsData.reduce((acc, cat) => acc + (cat.discussions?.length || 0), 0)
          : 0;
        
        setStats({
          totalFiles: filesData.metadata?.total_files || 0,
          totalDiscussions,
          totalCategories: Array.isArray(categoriesData) ? categoriesData.length : 0,
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
      color: 'bg-[#1a3aa3]',
      features: ['Drag & Drop', 'Αναζήτηση', 'Κατηγοριοποίηση', 'Bulk Upload']
    },
    {
      title: 'Φόρουμ Συζητήσεων',
      description: 'Επαγγελματικό φόρουμ για συζητήσεις και ανταλλαγή απόψεων',
      icon: MessageSquare,
      link: '/forum',
      color: 'bg-[#b8942e]',
      features: ['Κατηγορίες', 'Real-time', 'Moderation', 'Notifications']
    },
    {
      title: 'AI Assistant',
      description: 'Έξυπνος βοηθός για απαντήσεις και υποστήριξη',
      icon: Bot,
      link: '/assistant',
      color: 'bg-[#3d5cc9]',
      features: ['24/7 Διαθέσιμος', 'Νομικές Συμβουλές', 'Γρήγορες Απαντήσεις', 'Εκμάθηση']
    }
  ];

  return (
    <div className="container mx-auto px-12 py-20 max-w-8xl">
      {/* Hero Section */}
      <div className="text-center mb-24">
        <div className="animate-fade-in">
          <h1 className="text-6xl md:text-8xl font-bold text-[#1a3aa3] mb-12 leading-tight" style={{fontFamily: "'Literata', serif"}}>
            Καλώς ήρθατε στο{' '}
            <span className="bg-gradient-to-r from-[#1a3aa3] via-[#2548b8] to-[#152e82] bg-clip-text text-transparent">
              SW Portal
            </span>
          </h1>
          <p className="text-3xl md:text-4xl text-[#2a2520] mb-16 max-w-6xl mx-auto leading-relaxed font-medium">
            Ενιαίο σύστημα διαχείρισης αρχείων, φόρουμ συζητήσεων και AI Assistant{' '}
            <br className="hidden md:block" />
            για την Περιφέρεια Αττικής
          </p>
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <Badge variant="secondary" className="text-lg px-10 py-5 bg-[#eef1f8] text-[#1a3aa3] border-[#d0d8ee] hover:bg-[#dde4f5] transition-colors font-semibold rounded-2xl">
              <FontAwesomeIcon icon={faBuilding} className="mr-3" /> Περιφέρεια Αττικής
            </Badge>
            <Badge variant="secondary" className="text-lg px-10 py-5 bg-[#eef5ee] text-[#2d6b2d] border-[#c8dec8] hover:bg-[#d8ecd8] transition-colors font-semibold rounded-2xl">
              <FontAwesomeIcon icon={faShield} className="mr-3" /> Ασφαλές Περιβάλλον
            </Badge>
            <Badge variant="secondary" className="text-lg px-10 py-5 bg-[#eef1f8] text-[#1a3aa3] border-[#d0d8ee] hover:bg-[#dde4f5] transition-colors font-semibold rounded-2xl">
              <FontAwesomeIcon icon={faRocket} className="mr-3" /> Τοπική Εγκατάσταση
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
        <Card className="text-center hover:shadow-2xl transition-all duration-300 border-0 shadow-xl hover:scale-105 p-10">
          <CardHeader className="pb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-[#1a3aa3] to-[#2548b8] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <FileText className="w-12 h-12 text-white" />
            </div>
            <CardTitle className="text-5xl font-bold bg-gradient-to-r from-[#1a3aa3] to-[#152e82] bg-clip-text text-transparent mb-4" style={{fontFamily: "'Literata', serif"}}>
              {stats.totalFiles}
            </CardTitle>
            <CardDescription className="text-xl font-semibold text-[#6b6560]">Συνολικά Αρχεία</CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center hover:shadow-2xl transition-all duration-300 border-0 shadow-xl hover:scale-105 p-10">
          <CardHeader className="pb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-[#b8942e] to-[#9a7a24] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
            <CardTitle className="text-5xl font-bold bg-gradient-to-r from-[#b8942e] to-[#8a6d1b] bg-clip-text text-transparent mb-4" style={{fontFamily: "'Literata', serif"}}>
              {stats.totalDiscussions}
            </CardTitle>
            <CardDescription className="text-xl font-semibold text-[#6b6560]">Συζητήσεις Φόρουμ</CardDescription>
          </CardHeader>
        </Card>

        <Card className="text-center hover:shadow-2xl transition-all duration-300 border-0 shadow-xl hover:scale-105 p-10">
          <CardHeader className="pb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-[#3d5cc9] to-[#1a3aa3] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Users className="w-12 h-12 text-white" />
            </div>
            <CardTitle className="text-5xl font-bold bg-gradient-to-r from-[#3d5cc9] to-[#1a3aa3] bg-clip-text text-transparent mb-4" style={{fontFamily: "'Literata', serif"}}>
              {stats.totalCategories}
            </CardTitle>
            <CardDescription className="text-xl font-semibold text-[#6b6560]">Κατηγορίες</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card key={index} className="group hover:shadow-2xl transition-all duration-500 border-0 shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#2548b8] to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
              <CardHeader className="relative p-10">
                <div className={`w-24 h-24 ${feature.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl`}>
                  <Icon className="w-12 h-12 text-white" />
                </div>
                <CardTitle className="text-3xl mb-6 group-hover:text-[#1a3aa3] transition-colors font-bold">{feature.title}</CardTitle>
                <CardDescription className="text-[#6b6560] text-xl leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                <div className="space-y-4 mb-10">
                  {feature.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center text-lg text-[#2a2520] group-hover:text-[#2a2520] transition-colors">
                      <div className="w-3 h-3 bg-gradient-to-r from-[#1a3aa3] to-[#2548b8] rounded-full mr-4 group-hover:scale-125 transition-transform"></div>
                      <span className="font-semibold">{feat}</span>
                    </div>
                  ))}
                </div>
                <Link to={feature.link}>
                  <Button className="w-full group-hover:bg-[#152e82] group-hover:shadow-xl transition-all duration-300 h-16 text-lg font-bold rounded-2xl">
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
            <div className="w-10 h-10 bg-gradient-to-br from-[#1a3aa3] to-[#2548b8] rounded-lg flex items-center justify-center mr-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            Πρόσφατη Δραστηριότητα
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-[#faf8f4] to-[#f0ede6] rounded-xl hover:from-[#eef1f8] hover:to-[#dde4f5] transition-all duration-300 border-l-4 border-l-transparent hover:border-l-[#1a3aa3] group">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-4 shadow-md group-hover:scale-125 transition-transform ${
                    activity.type === 'file' ? 'bg-gradient-to-r from-[#1a3aa3] to-[#2548b8]' :
                    activity.type === 'forum' ? 'bg-gradient-to-r from-[#b8942e] to-[#9a7a24]' : 'bg-gradient-to-r from-[#3d5cc9] to-[#1a3aa3]'
                  }`}></div>
                  <span className="text-[#2a2520] font-medium group-hover:text-[#1a1815]">{activity.message}</span>
                </div>
                <span className="text-sm text-[#8a8480] group-hover:text-[#6b6560] font-medium">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="hover:shadow-2xl transition-all duration-300 border-0 shadow-xl">
        <CardHeader className="p-10">
          <CardTitle className="text-3xl flex items-center font-bold text-[#1a3aa3]" style={{fontFamily: "'Literata', serif"}}>
            <div className="w-16 h-16 bg-gradient-to-br from-[#b8942e] to-[#9a7a24] rounded-2xl flex items-center justify-center mr-6 shadow-xl">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            Γρήγορες Ενέργειες
          </CardTitle>
          <CardDescription className="text-xl mt-4">Συχνά χρησιμοποιούμενες λειτουργίες</CardDescription>
        </CardHeader>
        <CardContent className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Link to="/apothecary">
              <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-[#eef1f8] hover:border-[#b0c0e0] hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
                <Download className="w-10 h-10 text-[#1a3aa3] group-hover:scale-110 transition-transform" />
                <span className="text-lg font-bold text-[#2a2520] group-hover:text-[#1a3aa3]">Κατέβασμα Αρχείων</span>
              </Button>
            </Link>
            
            <Link to="/forum">
              <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-[#eef5ee] hover:border-[#a8cca8] hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
                <MessageSquare className="w-10 h-10 text-[#2d6b2d] group-hover:scale-110 transition-transform" />
                <span className="text-lg font-bold text-[#2a2520] group-hover:text-[#2d6b2d]">Νέα Συζήτηση</span>
              </Button>
            </Link>
            
            <Link to="/assistant">
              <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-[#eef1f8] hover:border-[#b0c0e0] hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
                <Bot className="w-10 h-10 text-[#3d5cc9] group-hover:scale-110 transition-transform" />
                <span className="text-lg font-bold text-[#2a2520] group-hover:text-[#3d5cc9]">Ρώτησε το AI</span>
              </Button>
            </Link>
            
            <Button variant="outline" className="w-full h-32 flex flex-col items-center justify-center space-y-4 hover:bg-[#f8f0e0] hover:border-[#d8c898] hover:shadow-xl transition-all duration-300 group border-3 rounded-2xl">
              <TrendingUp className="w-10 h-10 text-[#b8942e] group-hover:scale-110 transition-transform" />
              <span className="text-lg font-bold text-[#2a2520] group-hover:text-[#9a7a24]">Στατιστικά</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;