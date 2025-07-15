import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { 
  Home, 
  Files, 
  MessageSquare, 
  Bot, 
  Menu, 
  X,
  Download,
  Users,
  FileText,
  Settings,
  LogOut,
  User,
  Shield
} from 'lucide-react';

// Import authentication
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PermissionGuard, { usePermissions } from './PermissionGuard';

// Import page components
import HomePage from './pages/HomePage';
import ApothecaryPage from './pages/ApothecaryPage';
import ForumPage from './pages/ForumPage';
import DiscussionDetail from './pages/DiscussionDetail';
import AssistantPage from './pages/AssistantPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './ProfilePage';
import AdminDashboardPage from './AdminDashboardPage';
import NotificationBell from './NotificationBell';
import ChatWidget from './components/ChatWidget';

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
    { path: '/assistant', label: 'AI Assistant', icon: Bot },
  ];

  // Add admin-only navigation items
  const adminNavItems = permissions.canAccessAdminDashboard() ? [
    { path: '/admin', label: 'Διαχείριση', icon: Shield },
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
      case 'staff': return 'bg-blue-100 text-blue-800';
      case 'guest': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <nav className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-900 font-bold text-sm">SW</span>
            </div>
            <span className="text-xl font-bold">SW PORTAL</span>
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
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user?.avatar} />
                          <AvatarFallback className="bg-blue-100 text-blue-800">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user?.full_name || user?.username || 'Χρήστης'}
                          </div>
                          <div className="text-sm text-gray-500">
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
                        className="w-full flex items-center space-x-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4" />
                        <span>Προφίλ</span>
                      </Link>
                      
                      <PermissionGuard permission="can_access_admin_dashboard">
                        <Link
                          to="/admin"
                          className="w-full flex items-center space-x-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Shield className="w-4 h-4" />
                          <span>Διαχείριση</span>
                        </Link>
                      </PermissionGuard>
                      
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
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
          <div className="md:hidden py-4 border-t border-blue-700">
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
    <footer className="bg-gray-900 text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4">SW Portal</h3>
            <p className="text-gray-300 text-sm">
              Ενιαίο σύστημα διαχείρισης αρχείων, φόρουμ και AI Assistant 
              για την Περιφέρεια Αττικής.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Γρήγοροι Σύνδεσμοι</h3>
            <div className="space-y-2">
              <Link to="/apothecary" className="block text-gray-300 hover:text-white text-sm">
                📁 Αρχεία & Έγγραφα
              </Link>
              <Link to="/forum" className="block text-gray-300 hover:text-white text-sm">
                💬 Φόρουμ Συζητήσεων
              </Link>
              <Link to="/assistant" className="block text-gray-300 hover:text-white text-sm">
                🤖 AI Assistant
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Επικοινωνία</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <p>📧 support@swportal.gr</p>
              <p>📱 +30 210 1234567</p>
              <p>🏢 Περιφέρεια Αττικής</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-6 text-center">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} SW Portal - Περιφέρεια Αττικής. Όλα τα δικαιώματα διατηρούνται.
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

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">SW</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">SW Portal</h1>
          <p className="text-gray-600">Φόρτωση...</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation />
      
      <main className="flex-grow">
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
          <Route path="/admin" element={
            <ProtectedRoute>
              <PermissionGuard permission="can_access_admin_dashboard" fallback={
                <div className="container mx-auto px-4 py-8 text-center">
                  <h1 className="text-2xl font-bold text-red-600 mb-4">Δεν έχετε πρόσβαση</h1>
                  <p className="text-gray-600">Δεν έχετε τα απαραίτητα δικαιώματα για πρόσβαση σε αυτή τη σελίδα.</p>
                </div>
              } showFallback={true}>
                <AdminDashboardPage />
              </PermissionGuard>
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      <Footer />
      
      {/* Floating AI Assistant Widget - only show when authenticated */}
      {isAuthenticated && <ChatWidget />}
    </div>
  );
}

// Root App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;