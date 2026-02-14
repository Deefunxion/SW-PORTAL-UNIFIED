import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Files,
  MessageSquare,
  Bot,
  Download,
  TrendingUp,
  Clock,
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
      title: 'Αρχεία',
      description: 'Διαχείριση και κατέβασμα αρχείων με προηγμένες λειτουργίες',
      icon: Files,
      link: '/apothecary',
      gradient: 'from-[#1a3aa3] to-[#2548b8]',
      accentGradient: 'from-[#1a3aa3] to-[#3d5cc9]',
      statColor: 'text-[#1a3aa3]',
      stats: stats.totalFiles,
      statsLabel: 'αρχεία',
      badges: [
        { label: 'Drag & Drop', style: 'bg-[#eef1f8] text-[#1a3aa3] border-[#d0d8ee]' },
        { label: 'Αναζήτηση', style: 'bg-[#faf5e8] text-[#8a6d1b] border-[#e8ddb8]' },
        { label: 'Κατηγοριοποίηση', style: 'bg-[#eef5ee] text-[#2d6b2d] border-[#c8dec8]' },
        { label: 'Bulk Upload', style: 'bg-[#eef1f8] text-[#1a3aa3] border-[#d0d8ee]' },
      ]
    },
    {
      title: 'Φόρουμ Συζητήσεων',
      description: 'Επαγγελματικό φόρουμ για συζητήσεις και ανταλλαγή απόψεων',
      icon: MessageSquare,
      link: '/forum',
      gradient: 'from-[#b8942e] to-[#9a7a24]',
      accentGradient: 'from-[#b8942e] to-[#d4ad3a]',
      statColor: 'text-[#b8942e]',
      stats: stats.totalDiscussions,
      statsLabel: 'συζητήσεις',
      badges: [
        { label: 'Κατηγορίες', style: 'bg-[#faf5e8] text-[#8a6d1b] border-[#e8ddb8]' },
        { label: 'Real-time', style: 'bg-[#eef1f8] text-[#1a3aa3] border-[#d0d8ee]' },
        { label: 'Moderation', style: 'bg-[#eef5ee] text-[#2d6b2d] border-[#c8dec8]' },
        { label: 'Notifications', style: 'bg-[#faf5e8] text-[#8a6d1b] border-[#e8ddb8]' },
      ]
    },
    {
      title: 'ΑΙ Βοηθός',
      description: 'Έξυπνος βοηθός για απαντήσεις και υποστήριξη',
      icon: Bot,
      link: '/assistant',
      gradient: 'from-[#3d5cc9] to-[#2d4ab0]',
      accentGradient: 'from-[#3d5cc9] to-[#5a7ae0]',
      statColor: 'text-[#3d5cc9]',
      stats: stats.totalCategories,
      statsLabel: 'κατηγορίες',
      badges: [
        { label: '24/7 Διαθέσιμος', style: 'bg-[#eef1f8] text-[#1a3aa3] border-[#d0d8ee]' },
        { label: 'Νομικές Συμβουλές', style: 'bg-[#faf5e8] text-[#8a6d1b] border-[#e8ddb8]' },
        { label: 'Γρήγορες Απαντήσεις', style: 'bg-[#eef5ee] text-[#2d6b2d] border-[#c8dec8]' },
        { label: 'Εκμάθηση', style: 'bg-[#eef1f8] text-[#1a3aa3] border-[#d0d8ee]' },
      ]
    }
  ];

  const quickActions = [
    { icon: Download, label: 'Κατέβασμα Αρχείων', link: '/apothecary', color: 'text-[#1a3aa3]' },
    { icon: MessageSquare, label: 'Νέα Συζήτηση', link: '/forum', color: 'text-[#2d6b2d]' },
    { icon: Bot, label: 'Ρώτησε το AI', link: '/assistant', color: 'text-[#3d5cc9]' },
    { icon: TrendingUp, label: 'Στατιστικά', link: '/admin', color: 'text-[#b8942e]' },
  ];

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 max-w-7xl">
      {/* Hero Section */}
      <div className="text-center mb-10 sm:mb-[52px] pt-4 sm:pt-8">
        <h1
          className="text-3xl sm:text-4xl lg:text-[50px] font-extrabold text-[#1a2a1a] mb-4 sm:mb-5 leading-[1.12]"
          style={{ fontFamily: "'Literata', serif" }}
        >
          Καλώς ήρθατε στην{' '}
          <span className="bg-gradient-to-br from-[#1a3aa3] via-[#2d5cd6] to-[#152e82] bg-clip-text text-transparent">
            ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-[#6b6560] max-w-[660px] mx-auto leading-relaxed">
          Ενιαίο σύστημα διαχείρισης αρχείων, φόρουμ συζητήσεων και AI Assistant
          για την Περιφέρεια Αττικής
        </p>
      </div>

      {/* Feature Cards — 3-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7 mb-10 sm:mb-[52px]">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Link key={index} to={feature.link} className="group">
              <div className="h-full bg-white border border-[#e8e2d8] rounded-2xl overflow-hidden transition-all duration-[400ms] hover:shadow-[0_20px_60px_rgba(26,58,163,0.13),0_4px_16px_rgba(42,37,32,0.07)] hover:-translate-y-2">
                {/* Top accent bar */}
                <div className={`h-1 bg-gradient-to-r ${feature.accentGradient}`} />

                <div className="p-5 sm:p-7 pb-5 sm:pb-6">
                  {/* Icon + Title */}
                  <div className="flex items-start gap-4 mb-5">
                    <div className={`w-14 h-14 rounded-[14px] bg-gradient-to-br ${feature.gradient} flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.15)] group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="text-xl sm:text-[22px] font-bold text-[#1a2a1a] mb-1 leading-tight"
                        style={{ fontFamily: "'Literata', serif" }}
                      >
                        {feature.title}
                      </h3>
                      <p className="text-[15px] text-[#6b6560] leading-snug">
                        {feature.description}
                      </p>
                    </div>
                  </div>

                  {/* Stat */}
                  <div className="flex items-baseline gap-2 mb-[18px] py-3.5 border-t border-b border-[#f0ebe3]">
                    <span
                      className={`text-4xl sm:text-[38px] font-extrabold leading-none ${feature.statColor}`}
                      style={{ fontFamily: "'Literata', serif" }}
                    >
                      {feature.stats}
                    </span>
                    <span className="text-[15px] text-[#8a8580] font-medium">
                      {feature.statsLabel}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-[22px]">
                    {feature.badges.map((badge, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center px-3.5 py-1 rounded-full text-[12.5px] font-semibold tracking-wide border transition-transform hover:scale-[1.08] hover:shadow-sm ${badge.style}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  {/* Navigation link (NOT a full-width button) */}
                  <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#1a3aa3] group-hover:gap-3.5 group-hover:text-[#152e82] transition-all duration-300 py-1">
                    Μετάβαση
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom row: Recent Activity + Quick Actions side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-7">
        {/* Recent Activity — takes 3/5 width on large */}
        <div className="lg:col-span-3 bg-white border border-[#e8e2d8] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#ece7de] flex items-center gap-3.5">
            <div className="w-[42px] h-[42px] rounded-[11px] bg-gradient-to-br from-[#1a3aa3] to-[#2548b8] flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <h3
              className="text-xl sm:text-[21px] font-bold text-[#1a3aa3]"
              style={{ fontFamily: "'Literata', serif" }}
            >
              Πρόσφατη Δραστηριότητα
            </h3>
          </div>
          <div className="p-5">
            {stats.recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-3.5 p-3.5 px-4 rounded-xl transition-all duration-200 border-l-[3px] border-l-transparent hover:bg-[#eef1f8] hover:border-l-[#1a3aa3] mb-1"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_0_3px_rgba(0,0,0,0.06)] ${
                    activity.type === 'file'
                      ? 'bg-[#1a3aa3]'
                      : activity.type === 'forum'
                        ? 'bg-[#b8942e]'
                        : 'bg-[#3d5cc9]'
                  }`}
                />
                <span className="flex-1 text-[15px] font-medium text-[#2a2520]">
                  {activity.message}
                </span>
                <span className="text-[13px] text-[#8a8580] font-medium shrink-0">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions — takes 2/5 width on large */}
        <div className="lg:col-span-2 bg-white border border-[#e8e2d8] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#ece7de] flex items-center gap-3.5">
            <div className="w-[42px] h-[42px] rounded-[11px] bg-gradient-to-br from-[#b8942e] to-[#9a7a24] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3
              className="text-xl sm:text-[21px] font-bold text-[#1a3aa3]"
              style={{ fontFamily: "'Literata', serif" }}
            >
              Γρήγορες Ενέργειες
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3.5">
              {quickActions.map((action, index) => {
                const ActionIcon = action.icon;
                return (
                  <Link key={index} to={action.link} className="group">
                    <div className="flex flex-col items-center justify-center gap-2.5 py-[26px] px-4 bg-[#faf8f4] border-[1.5px] border-[#e8e2d8] rounded-[14px] transition-all duration-300 hover:bg-[#eef1f8] hover:border-[#b0c0e0] hover:-translate-y-[5px] hover:shadow-[0_10px_28px_rgba(26,58,163,0.1)]">
                      <ActionIcon
                        className={`w-7 h-7 ${action.color} group-hover:scale-[1.18] transition-transform duration-300`}
                      />
                      <span className="text-sm font-semibold text-[#2a2520] text-center leading-tight group-hover:text-[#1a3aa3]">
                        {action.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
