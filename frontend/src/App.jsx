import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import {
  Home,
  Files,
  MessageSquare,
  Bot,
  Menu,
  X,
  LogOut,
  User,
  Shield,
  Database,
  ClipboardList
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faComments, faRobot, faEnvelope, faMobileAlt, faBuilding } from '@fortawesome/free-solid-svg-icons';

// Import Sonner for toast notifications
import { Toaster } from 'sonner';

// Import authentication
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PermissionGuard, { usePermissions } from '@/components/PermissionGuard';

// Import page components
import HomePage from '@/pages/HomePage';
import ApothecaryPage from '@/pages/ApothecaryPage';
import ForumPage from '@/pages/ForumPage';
import DiscussionDetail from '@/pages/DiscussionDetail';
import AssistantPage from '@/pages/AssistantPage';
import LoginPage from '@/pages/LoginPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import NotificationBell from '@/components/NotificationBell';
import PrivateMessagingPage from '@/pages/PrivateMessagingPage';
import KnowledgeBasePage from '@/pages/KnowledgeBasePage';
import RegistryListPage from '@/features/registry/pages/RegistryListPage';
import StructureDetailPage from '@/features/registry/pages/StructureDetailPage';
import StructureFormPage from '@/features/registry/pages/StructureFormPage';
import InspectionReportPage from '@/features/registry/pages/InspectionReportPage';
import CommitteesPage from '@/features/registry/pages/CommitteesPage';
import OversightDashboardPage from '@/features/registry/pages/OversightDashboardPage';
import ReportsPage from '@/features/registry/pages/ReportsPage';
import AdvisorReportPage from '@/features/registry/pages/AdvisorReportPage';

import './App.css';

// Navigation component with authentication
function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const permissions = usePermissions();

  const navItems = [
    { path: '/', label: 'Αρχική', icon: Home },
    { path: '/apothecary', label: 'Αρχεία', icon: Files },
    { path: '/forum', label: 'Φόρουμ', icon: MessageSquare },
    { path: '/assistant', label: 'AI Βοηθός', icon: Bot },
    { path: '/registry', label: 'Εποπτεία', icon: ClipboardList },
  ];

  // Add admin-only navigation items
  const adminNavItems = permissions.canAccessAdminDashboard() ? [
    { path: '/admin', label: 'Διαχείριση', icon: Shield },
    { path: '/knowledge', label: 'Βάση Γνώσεων', icon: Database },
  ] : [];

  const allNavItems = [...navItems, ...adminNavItems];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getUserInitials = (user) => {
    if (!user) return 'U';
    if (user.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user.username ? user.username[0].toUpperCase() : 'U';
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'staff': return 'bg-[#dde4f5] text-[#1a3aa3]';
      case 'guest': return 'bg-[#f0ede6] text-[#2a2520]';
      default: return 'bg-[#f0ede6] text-[#2a2520]';
    }
  };

  return (
    <nav className="bg-gradient-to-r from-[#152e82] to-[#1a3aa3] text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img src={`${import.meta.env.BASE_URL}favicon.ico`} alt="ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ" className="w-8 h-8 rounded-lg" />
            <span className="text-xl font-bold" style={{fontFamily: "'Literata', serif"}}>ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Περιφέρεια Αττικής
            </Badge>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {isAuthenticated && allNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu / Login Button */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />
                
                <div className="relative">
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 text-white hover:bg-white/10 p-2"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-white/20 text-white text-sm">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium">
                      {user?.full_name || user?.username || 'Χρήστης'}
                    </div>
                    <div className="text-xs text-blue-200">
                      {user?.role || 'guest'}
                    </div>
                  </div>
                </Button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-lg shadow-lg border border-[#e8e2d8] py-2 z-50">
                    <div className="px-4 py-3 border-b border-[#e8e2d8]">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user?.avatar} />
                          <AvatarFallback className="bg-[#dde4f5] text-[#1a3aa3]">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-[#2a2520]">
                            {user?.full_name || user?.username || 'Χρήστης'}
                          </div>
                          <div className="text-sm text-[#8a8580]">
                            {user?.email || 'Δεν υπάρχει email'}
                          </div>
                          <Badge className={`text-xs mt-1 ${getRoleBadgeColor(user?.role)}`}>
                            <Shield className="w-3 h-3 mr-1" />
                            {user?.role || 'guest'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-2">
                      <Link
                        to="/profile"
                        className="w-full flex items-center space-x-2 px-4 py-2 text-left text-[#2a2520] hover:bg-[#faf8f4] transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4" />
                        <span>Προφίλ</span>
                      </Link>
                      
                      <PermissionGuard permission="can_access_admin_dashboard">
                        <Link
                          to="/admin"
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left text-[#2a2520] hover:bg-[#faf8f4] transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Shield className="w-4 h-4" />
                          <span>Διαχείριση</span>
                        </Link>
                      </PermissionGuard>
                      
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-left text-[#2a2520] hover:bg-[#faf8f4] transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Αποσύνδεση</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20">
                  <User className="w-4 h-4 mr-2" />
                  Σύνδεση
                </Button>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-white hover:bg-white/10"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && isAuthenticated && (
          <div className="md:hidden py-4 border-t border-[#1a3aa3]/30">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-white/20 text-white'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Mobile Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-blue-100 hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                <LogOut size={20} />
                <span>Αποσύνδεση</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Footer component
function Footer() {
  return (
    <footer className="bg-[#1a1815] text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4">ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</h3>
            <p className="text-[#c0b89e] text-sm">
              Ενιαίο σύστημα διαχείρισης αρχείων, φόρουμ και AI Assistant
              για την Περιφέρεια Αττικής.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Γρήγοροι Σύνδεσμοι</h3>
            <div className="space-y-2">
              <Link to="/apothecary" className="block text-[#c0b89e] hover:text-white text-sm">
                <FontAwesomeIcon icon={faFolder} className="mr-2" /> Αρχεία & Έγγραφα
              </Link>
              <Link to="/forum" className="block text-[#c0b89e] hover:text-white text-sm">
                <FontAwesomeIcon icon={faComments} className="mr-2" /> Φόρουμ Συζητήσεων
              </Link>
              <Link to="/assistant" className="block text-[#c0b89e] hover:text-white text-sm">
                <FontAwesomeIcon icon={faRobot} className="mr-2" /> AI Assistant
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Επικοινωνία</h3>
            <div className="space-y-2 text-sm text-[#c0b89e]">
              <p><FontAwesomeIcon icon={faEnvelope} className="mr-2" /> support@swportal.gr</p>
              <p><FontAwesomeIcon icon={faMobileAlt} className="mr-2" /> +30 210 1234567</p>
              <p><FontAwesomeIcon icon={faBuilding} className="mr-2" /> Περιφέρεια Αττικής</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[#3a3530] mt-8 pt-6 text-center">
          <p className="text-[#8a8580] text-sm">
            &copy; {new Date().getFullYear()} ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ - Περιφέρεια Αττικής. Όλα τα δικαιώματα διατηρούνται.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Main App component with authentication
function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isFullScreenPage = location.pathname === '/assistant';

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#eef1f8] to-[#f0ede6]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a3aa3] rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">SW</span>
          </div>
          <h1 className="text-2xl font-bold text-[#2a2520] mb-2">ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</h1>
          <p className="text-[#6b6560]">Φόρτωση...</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3] mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-[#faf8f4] ${isFullScreenPage ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <Navigation />

      <main className={`flex-1 ${isFullScreenPage ? 'min-h-0 flex flex-col' : ''}`}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/apothecary" element={
            <ProtectedRoute>
              <ApothecaryPage />
            </ProtectedRoute>
          } />
          <Route path="/forum" element={
            <ProtectedRoute>
              <ForumPage />
            </ProtectedRoute>
          } />
          <Route path="/forum/:discussionId" element={
            <ProtectedRoute>
              <DiscussionDetail />
            </ProtectedRoute>
          } />
          <Route path="/messaging" element={
            <ProtectedRoute>
              <PrivateMessagingPage />
            </ProtectedRoute>
          } />
          <Route path="/messaging/:conversationId" element={
            <ProtectedRoute>
              <PrivateMessagingPage />
            </ProtectedRoute>
          } />

          <Route path="/assistant" element={
            <ProtectedRoute>
              <AssistantPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/registry" element={
            <ProtectedRoute>
              <RegistryListPage />
            </ProtectedRoute>
          } />
          <Route path="/registry/new" element={
            <ProtectedRoute>
              <StructureFormPage />
            </ProtectedRoute>
          } />
          <Route path="/registry/:id" element={
            <ProtectedRoute>
              <StructureDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/registry/:id/edit" element={
            <ProtectedRoute>
              <StructureFormPage />
            </ProtectedRoute>
          } />
          <Route path="/inspections/:id/report" element={
            <ProtectedRoute>
              <InspectionReportPage />
            </ProtectedRoute>
          } />
          <Route path="/registry/:structureId/advisor-report" element={
            <ProtectedRoute>
              <AdvisorReportPage />
            </ProtectedRoute>
          } />
          <Route path="/registry/:structureId/advisor-report/:reportId" element={
            <ProtectedRoute>
              <AdvisorReportPage />
            </ProtectedRoute>
          } />
          <Route path="/committees" element={
            <ProtectedRoute>
              <CommitteesPage />
            </ProtectedRoute>
          } />
          <Route path="/oversight" element={
            <ProtectedRoute>
              <OversightDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <PermissionGuard permission="can_access_admin_dashboard" fallback={
                <div className="container mx-auto px-4 py-8 text-center">
                  <h1 className="text-2xl font-bold text-red-600 mb-4">Δεν έχετε πρόσβαση</h1>
                  <p className="text-[#6b6560]">Δεν έχετε τα απαραίτητα δικαιώματα για πρόσβαση σε αυτή τη σελίδα.</p>
                </div>
              } showFallback={true}>
                <AdminDashboardPage />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          <Route path="/knowledge" element={
            <ProtectedRoute>
              <PermissionGuard permission="can_access_admin_dashboard" fallback={
                <div className="container mx-auto px-4 py-8 text-center">
                  <h1 className="text-2xl font-bold text-red-600 mb-4">Δεν έχετε πρόσβαση</h1>
                  <p className="text-[#6b6560]">Δεν έχετε τα απαραίτητα δικαιώματα.</p>
                </div>
              } showFallback={true}>
                <KnowledgeBasePage />
              </PermissionGuard>
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      {!isFullScreenPage && <Footer />}

      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        expand={false}
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: {
            background: 'white',
            color: '#2a2520',
            border: '1px solid #e8e2d8',
            fontSize: '14px',
          },
        }}
      />
    </div>
  );
}

// Root App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
