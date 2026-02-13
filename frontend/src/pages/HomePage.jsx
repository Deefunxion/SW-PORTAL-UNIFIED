import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
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
    const fetchStats = async () => {
      try {
        const { data: filesData } = await api.get('/api/files/structure');
        const { data: discussionsData } = await api.get('/api/discussions');
        const { data: categoriesData } = await api.get('/api/categories');

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
      stats: stats.totalFiles,
      statsLabel: 'αρχεία',
      features: ['Drag & Drop', 'Αναζήτηση', 'Κατηγοριοποίηση', 'Bulk Upload']
    },
    {
      title: 'Φόρουμ Συζητήσεων',
      description: 'Επαγγελματικό φόρουμ για συζητήσεις και ανταλλαγή απόψεων',
      icon: MessageSquare,
      link: '/forum',
      color: 'bg-[#b8942e]',
      stats: stats.totalDiscussions,
      statsLabel: 'συζητήσεις',
      features: ['Κατηγορίες', 'Real-time', 'Moderation', 'Notifications']
    },
    {
      title: 'AI Assistant',
      description: 'Έξυπνος βοηθός για απαντήσεις και υποστήριξη',
      icon: Bot,
      link: '/assistant',
      color: 'bg-[#3d5cc9]',
      stats: stats.totalCategories,
      statsLabel: 'κατηγορίες',
      features: ['24/7 Διαθέσιμος', 'Νομικές Συμβουλές', 'Γρήγορες Απαντήσεις', 'Εκμάθηση']
    }
  ];

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 max-w-7xl">
      {/* Hero Section */}
      <div className="text-center mb-10 sm:mb-14">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1a3aa3] mb-4 sm:mb-6 leading-tight" style={{fontFamily: "'Literata', serif"}}>
          Καλώς ήρθατε στο{' '}
          <span className="bg-gradient-to-r from-[#1a3aa3] via-[#2548b8] to-[#152e82] bg-clip-text text-transparent">
            SW Portal
          </span>
        </h1>
        <p className="text-lg sm:text-xl lg:text-2xl text-[#4a4540] max-w-3xl mx-auto leading-relaxed">
          Ενιαίο σύστημα διαχείρισης αρχείων, φόρουμ συζητήσεων και AI Assistant
          για την Περιφέρεια Αττικής
        </p>
      </div>

      {/* Feature Cards — main navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-10 sm:mb-14">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Link key={index} to={feature.link} className="group">
              <Card className="h-full hover:shadow-2xl transition-all duration-300 border border-[#e8e2d8] shadow-md hover:-translate-y-1 relative overflow-hidden">
                {/* Top accent bar */}
                <div className={`h-1.5 ${feature.color}`}></div>

                <CardHeader className="p-5 sm:p-6 pb-3 sm:pb-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 ${feature.color} rounded-xl flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                      <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-xl sm:text-2xl mb-1.5 group-hover:text-[#1a3aa3] transition-colors font-bold leading-tight">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-[#6b6560] text-base sm:text-lg leading-snug">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
                  {/* Inline stat */}
                  <div className="flex items-center gap-2 mb-4 text-base sm:text-lg">
                    <span className="font-bold text-[#1a3aa3] text-2xl sm:text-3xl" style={{fontFamily: "'Literata', serif"}}>
                      {feature.stats}
                    </span>
                    <span className="text-[#8a8480] font-medium">{feature.statsLabel}</span>
                  </div>

                  {/* Feature tags */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {feature.features.map((feat, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#f0ede6] text-[#4a4540] border border-[#e8e2d8]">
                        {feat}
                      </span>
                    ))}
                  </div>

                  <Button className="w-full group-hover:bg-[#152e82] transition-all duration-300 h-11 sm:h-12 text-base font-semibold rounded-xl">
                    Μετάβαση
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Bottom row: Recent Activity + Quick Actions side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
        {/* Recent Activity — takes 3/5 width on large */}
        <Card className="lg:col-span-3 border border-[#e8e2d8] shadow-md">
          <CardHeader className="p-5 sm:p-6 pb-3">
            <CardTitle className="flex items-center text-xl sm:text-2xl font-bold text-[#1a3aa3]" style={{fontFamily: "'Literata', serif"}}>
              <div className="w-10 h-10 bg-gradient-to-br from-[#1a3aa3] to-[#2548b8] rounded-lg flex items-center justify-center mr-3">
                <Clock className="w-5 h-5 text-white" />
              </div>
              Πρόσφατη Δραστηριότητα
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            <div className="space-y-3">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 sm:p-4 bg-[#faf8f4] rounded-xl hover:bg-[#eef1f8] transition-colors duration-200 border-l-4 border-l-transparent hover:border-l-[#1a3aa3] group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      activity.type === 'file' ? 'bg-[#1a3aa3]' :
                      activity.type === 'forum' ? 'bg-[#b8942e]' : 'bg-[#3d5cc9]'
                    }`}></div>
                    <span className="text-[#2a2520] text-base sm:text-lg font-medium truncate">{activity.message}</span>
                  </div>
                  <span className="text-sm text-[#8a8480] font-medium shrink-0 ml-3">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions — takes 2/5 width on large */}
        <Card className="lg:col-span-2 border border-[#e8e2d8] shadow-md">
          <CardHeader className="p-5 sm:p-6 pb-3">
            <CardTitle className="flex items-center text-xl sm:text-2xl font-bold text-[#1a3aa3]" style={{fontFamily: "'Literata', serif"}}>
              <div className="w-10 h-10 bg-gradient-to-br from-[#b8942e] to-[#9a7a24] rounded-lg flex items-center justify-center mr-3">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              Γρήγορες Ενέργειες
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            <div className="grid grid-cols-2 gap-3">
              <Link to="/apothecary">
                <Button variant="outline" className="w-full h-24 sm:h-28 flex flex-col items-center justify-center gap-2 hover:bg-[#eef1f8] hover:border-[#b0c0e0] transition-all duration-200 group rounded-xl border-[#e8e2d8]">
                  <Download className="w-8 h-8 text-[#1a3aa3] group-hover:scale-110 transition-transform" />
                  <span className="text-sm sm:text-base font-semibold text-[#2a2520] group-hover:text-[#1a3aa3] text-center leading-tight">Κατέβασμα Αρχείων</span>
                </Button>
              </Link>

              <Link to="/forum">
                <Button variant="outline" className="w-full h-24 sm:h-28 flex flex-col items-center justify-center gap-2 hover:bg-[#eef5ee] hover:border-[#a8cca8] transition-all duration-200 group rounded-xl border-[#e8e2d8]">
                  <MessageSquare className="w-8 h-8 text-[#2d6b2d] group-hover:scale-110 transition-transform" />
                  <span className="text-sm sm:text-base font-semibold text-[#2a2520] group-hover:text-[#2d6b2d] text-center leading-tight">Νέα Συζήτηση</span>
                </Button>
              </Link>

              <Link to="/assistant">
                <Button variant="outline" className="w-full h-24 sm:h-28 flex flex-col items-center justify-center gap-2 hover:bg-[#eef1f8] hover:border-[#b0c0e0] transition-all duration-200 group rounded-xl border-[#e8e2d8]">
                  <Bot className="w-8 h-8 text-[#3d5cc9] group-hover:scale-110 transition-transform" />
                  <span className="text-sm sm:text-base font-semibold text-[#2a2520] group-hover:text-[#3d5cc9] text-center leading-tight">Ρώτησε το AI</span>
                </Button>
              </Link>

              <Button variant="outline" className="w-full h-24 sm:h-28 flex flex-col items-center justify-center gap-2 hover:bg-[#f8f0e0] hover:border-[#d8c898] transition-all duration-200 group rounded-xl border-[#e8e2d8]">
                <TrendingUp className="w-8 h-8 text-[#b8942e] group-hover:scale-110 transition-transform" />
                <span className="text-sm sm:text-base font-semibold text-[#2a2520] group-hover:text-[#9a7a24] text-center leading-tight">Στατιστικά</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default HomePage;