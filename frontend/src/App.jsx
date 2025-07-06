import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
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
  Settings
} from 'lucide-react';

// Import page components
import HomePage from './pages/HomePage';
import ApothecaryPage from './pages/ApothecaryPage';
import ForumPage from './pages/ForumPage';
import DiscussionDetail from './pages/DiscussionDetail';
import AssistantPage from './pages/AssistantPage';
import ChatWidget from './components/ChatWidget';

import './App.css';

// Navigation component
function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Αρχική', icon: Home },
    { path: '/apothecary', label: 'Αρχεία', icon: Files },
    { path: '/forum', label: 'Φόρουμ', icon: MessageSquare },
    { path: '/assistant', label: 'AI Assistant', icon: Bot },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
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
            {navItems.map((item) => {
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

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
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

// Main App component
function App() {
  const [isLoading, setIsLoading] = useState(true);

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
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navigation />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/apothecary" element={<ApothecaryPage />} />
            <Route path="/forum" element={<ForumPage />} />
            <Route path="/forum/:discussionId" element={<DiscussionDetail />} />
            <Route path="/assistant" element={<AssistantPage />} />
          </Routes>
        </main>

        <Footer />
        
        {/* Floating AI Assistant Widget */}
        <ChatWidget />
      </div>
    </Router>
  );
}

export default App;

