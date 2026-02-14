import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  Eye, 
  EyeOff, 
  LogIn, 
  Shield, 
  AlertCircle,
  Home,
  Loader2
} from 'lucide-react';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(formData.username, formData.password);
      // Navigation will be handled by useEffect above
    } catch (err) {
      setError(err.message || 'Σφάλμα σύνδεσης. Παρακαλώ δοκιμάστε ξανά.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef1f8] via-[#f0ede6] to-[#eef1f8] flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-[#1a3aa3] to-[#152e82] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">SW</span>
          </div>
          <h1 className="text-3xl font-bold text-[#2a2520] mb-2" style={{fontFamily: "'Literata', serif"}}>ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</h1>
          <p className="text-[#6b6560]">Περιφέρεια Αττικής</p>
          <Badge variant="secondary" className="mt-2">
            Ασφαλής Σύνδεση
          </Badge>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-[#1a3aa3]" />
              Σύνδεση
            </CardTitle>
            <CardDescription className="text-center">
              Εισάγετε τα στοιχεία σας για πρόσβαση στο σύστημα
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Όνομα Χρήστη
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Εισάγετε το όνομα χρήστη"
                  required
                  disabled={isSubmitting}
                  className="h-11"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Κωδικός Πρόσβασης
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Εισάγετε τον κωδικό πρόσβασης"
                    required
                    disabled={isSubmitting}
                    className="h-11 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-11 px-3 py-2 hover:bg-transparent"
                    onClick={togglePasswordVisibility}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-[#8a8580]" />
                    ) : (
                      <Eye className="h-4 w-4 text-[#8a8580]" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-[#1a3aa3] to-[#152e82] hover:from-[#152e82] hover:to-[#0f2260] text-white font-medium"
                disabled={isSubmitting || !formData.username || !formData.password}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Σύνδεση...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Σύνδεση
                  </>
                )}
              </Button>
            </form>

            {/* Test Credentials Info */}
            <div className="mt-6 p-4 bg-[#eef1f8] rounded-lg border border-[#d0d8ee]">
              <h4 className="text-sm font-medium text-[#1a3aa3] mb-2">
                Στοιχεία Δοκιμής:
              </h4>
              <div className="text-sm text-[#152e82] space-y-1">
                <p><strong>Admin:</strong> admin / admin123</p>
                <p><strong>Staff:</strong> staff / staff123</p>
                <p><strong>Guest:</strong> guest / guest123</p>
              </div>
            </div>

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <Link 
                to="/" 
                className="inline-flex items-center text-sm text-[#6b6560] hover:text-[#1a3aa3] transition-colors"
              >
                <Home className="mr-1 h-4 w-4" />
                Επιστροφή στην αρχική
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-[#8a8580]">
          <p>&copy; {new Date().getFullYear()} ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ - Περιφέρεια Αττικής</p>
          <p className="mt-1">Ασφαλής πρόσβαση με JWT authentication</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;