import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  Users, 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  BarChart3,
  Activity,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle,
  Calendar
} from 'lucide-react';
import authService from './auth';

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'guest',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersResponse, statsResponse] = await Promise.all([
        authService.api('/api/admin/users'),
        authService.api('/api/admin/stats')
      ]);
      
      setUsers(usersResponse.users || []);
      setStats(statsResponse);
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Σφάλμα κατά τη φόρτωση δεδομένων: ' + (error.message || 'Άγνωστο σφάλμα')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.email || !formData.password) {
      setMessage({ type: 'error', text: 'Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία' });
      return;
    }

    try {
      await authService.api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      setMessage({ type: 'success', text: 'Ο χρήστης δημιουργήθηκε επιτυχώς!' });
      setShowCreateForm(false);
      setFormData({ username: '', email: '', password: '', role: 'guest', is_active: true });
      await fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Σφάλμα κατά τη δημιουργία χρήστη: ' + (error.message || 'Άγνωστο σφάλμα')
      });
    }
  };

  const handleUpdateUser = async (userId) => {
    try {
      await authService.api(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });

      setMessage({ type: 'success', text: 'Ο χρήστης ενημερώθηκε επιτυχώς!' });
      setEditingUser(null);
      setFormData({ username: '', email: '', password: '', role: 'guest', is_active: true });
      await fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Σφάλμα κατά την ενημέρωση χρήστη: ' + (error.message || 'Άγνωστο σφάλμα')
      });
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε τον χρήστη "${username}";`)) {
      return;
    }

    try {
      await authService.api(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      setMessage({ type: 'success', text: `Ο χρήστης "${username}" διαγράφηκε επιτυχώς!` });
      await fetchData();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Σφάλμα κατά τη διαγραφή χρήστη: ' + (error.message || 'Άγνωστο σφάλμα')
      });
    }
  };

  const startEdit = (user) => {
    setEditingUser(user.id);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active
    });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setShowCreateForm(false);
    setFormData({ username: '', email: '', password: '', role: 'guest', is_active: true });
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'staff': return 'bg-blue-100 text-blue-800';
      case 'guest': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Δεν υπάρχει';
    return new Date(dateString).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Πίνακας Ελέγχου Διαχειριστή</h1>
        <p className="text-gray-600">Διαχείριση χρηστών και στατιστικά συστήματος</p>
      </div>

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

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Σύνολο Χρηστών</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.users?.total || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ενεργοί Χρήστες</p>
                  <p className="text-2xl font-bold text-green-600">{stats.users?.active || 0}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Νέοι Χρήστες (30 ημέρες)</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.users?.recent || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Διαχειριστές</p>
                  <p className="text-2xl font-bold text-red-600">{stats.users?.by_role?.admin || 0}</p>
                </div>
                <Shield className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Διαχείριση Χρηστών</span>
              </CardTitle>
              <CardDescription>
                Προβολή, επεξεργασία και διαγραφή χρηστών
              </CardDescription>
            </div>
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Νέος Χρήστης
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Αναζήτηση χρηστών..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Create User Form */}
          {showCreateForm && (
            <Card className="mb-6 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">Δημιουργία Νέου Χρήστη</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Όνομα Χρήστη *</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Κωδικός Πρόσβασης *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Ρόλος</Label>
                      <select
                        id="role"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="guest">Guest</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Δημιουργία
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Ακύρωση
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-gray-600">Χρήστης</th>
                  <th className="text-left p-4 font-medium text-gray-600">Email</th>
                  <th className="text-left p-4 font-medium text-gray-600">Ρόλος</th>
                  <th className="text-left p-4 font-medium text-gray-600">Κατάσταση</th>
                  <th className="text-left p-4 font-medium text-gray-600">Εγγραφή</th>
                  <th className="text-left p-4 font-medium text-gray-600">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userItem) => (
                  <tr key={userItem.id} className="border-b hover:bg-gray-50">
                    {editingUser === userItem.id ? (
                      <td colSpan="6" className="p-4">
                        <form onSubmit={(e) => { e.preventDefault(); handleUpdateUser(userItem.id); }} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Email</Label>
                              <Input
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label>Ρόλος</Label>
                              <select
                                value={formData.role}
                                onChange={(e) => setFormData({...formData, role: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="guest">Guest</option>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                            <div>
                              <Label>Νέος Κωδικός (προαιρετικό)</Label>
                              <Input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                placeholder="Αφήστε κενό για να μην αλλάξει"
                              />
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">
                              Αποθήκευση
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                              Ακύρωση
                            </Button>
                          </div>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-blue-100 text-blue-800 text-sm">
                                {userItem.username[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{userItem.username}</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">{userItem.email}</td>
                        <td className="p-4">
                          <Badge className={getRoleBadgeColor(userItem.role)}>
                            {userItem.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {userItem.is_active ? (
                            <Badge className="bg-green-100 text-green-800">Ενεργός</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Ανενεργός</Badge>
                          )}
                        </td>
                        <td className="p-4 text-gray-600">{formatDate(userItem.created_at)}</td>
                        <td className="p-4">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(userItem)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            {userItem.id !== user?.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Δεν βρέθηκαν χρήστες
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;

