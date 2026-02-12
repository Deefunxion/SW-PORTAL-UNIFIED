import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Key,
  Save,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import authService from '../lib/auth';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Form states
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await authService.api('/api/user/profile');
      setProfile(response);
      setEmail(response.email || '');
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Σφάλμα κατά τη φόρτωση του προφίλ: ' + (error.message || 'Άγνωστο σφάλμα')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    // Validation
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Οι κωδικοί πρόσβασης δεν ταιριάζουν' });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Ο νέος κωδικός πρέπει να έχει τουλά��ιστον 6 χαρακτήρες' });
      return;
    }

    if (newPassword && !currentPassword) {
      setMessage({ type: 'error', text: 'Παρακαλώ εισάγετε τον τρέχοντα κωδικό πρόσβασης' });
      return;
    }

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      const updateData = {
        email: email
      };

      // Add password change if provided
      if (newPassword) {
        updateData.current_password = currentPassword;
        updateData.new_password = newPassword;
      }

      await authService.api('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      setMessage({ type: 'success', text: 'Το προφίλ ενημερώθηκε επιτυχώς!' });
      
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Refresh profile data
      await fetchProfile();

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Σφάλμα κατά την ενημέρωση: ' + (error.message || 'Άγνωστο σφάλμα')
      });
    } finally {
      setSaving(false);
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Δεν υπάρχει';
    return new Date(dateString).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-[#e8e2d8] rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              <div className="h-32 bg-[#e8e2d8] rounded"></div>
              <div className="h-64 bg-[#e8e2d8] rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[#2a2520] mb-8" style={{fontFamily: "'Literata', serif"}}>Προφίλ Χρήστη</h1>

        {/* Profile Overview Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Στοιχεία Χρήστη</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-6">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.avatar} />
                <AvatarFallback className="bg-[#dde4f5] text-[#1a3aa3] text-lg">
                  {getUserInitials(profile)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{profile?.username}</h3>
                <p className="text-[#6b6560]">{profile?.email}</p>
                <Badge className={`mt-2 ${getRoleBadgeColor(profile?.role)}`}>
                  <Shield className="w-3 h-3 mr-1" />
                  {profile?.role || 'guest'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#8a8580]" />
                <span className="text-[#6b6560]">Εγγραφή:</span>
                <span>{formatDate(profile?.created_at)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#8a8580]" />
                <span className="text-[#6b6560]">Τελευταία σύνδεση:</span>
                <span>{formatDate(profile?.last_login)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Update Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5" />
              <span>Ενημέρωση Προφίλ</span>
            </CardTitle>
            <CardDescription>
              Ενημερώστε τα στοιχεία σας και αλλάξτε τον κωδικό πρόσβασης
            </CardDescription>
          </CardHeader>
          <CardContent>
            {message.text && (
              <Alert className={`mb-6 ${message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                {message.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Εισάγετε το email σας"
                  required
                />
              </div>

              {/* Password Change Section */}
              <div className="border-t pt-6">
                <h4 className="text-lg font-medium mb-4">Αλλαγή Κωδικού Πρόσβασης</h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Τρέχων Κωδικός</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Εισάγετε τον τρέχοντα κωδικό"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Νέος Κωδικός</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Εισάγετε νέο κωδικό (τουλάχιστον 6 χαρακτήρες)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Επιβεβαίωση Νέου Κωδικού</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Επιβεβαιώστε τον νέο κωδικό"
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Αποθήκευση...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Αποθήκευση Αλλαγών
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;