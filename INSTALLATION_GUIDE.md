# Οδηγός Εγκατάστασης - SW Portal Extensions v2.0.0

Αυτός ο οδηγός περιγράφει πώς να εγκαταστήσετε τις νέες επεκτάσεις στο υπάρχον SW Portal σας.

## Προαπαιτούμενα

- Υπάρχον SW Portal installation
- Python 3.8+
- Node.js 16+
- SQLite ή PostgreSQL database

## Βήμα 1: Backup

**ΣΗΜΑΝΤΙΚΟ**: Πάντα κάντε backup πριν από οποιαδήποτε αλλαγή!

```bash
# Backup της βάσης δεδομένων
cp your_database.db your_database_backup.db

# Backup του κώδικα
cp -r your-sw-portal your-sw-portal-backup
```

## Βήμα 2: Αντιγραφή Νέων Αρχείων

### Backend Αρχεία:
Αντιγράψτε τα παρακάτω αρχεία στον backend φάκελό σας:

```bash
# Νέα modules
cp backend/roles.py your-sw-portal/backend/
cp backend/user_management.py your-sw-portal/backend/
cp backend/notifications.py your-sw-portal/backend/
```

### Frontend Αρχεία:
Αντιγράψτε τα παρακάτω αρχεία στον frontend φάκελό σας:

```bash
# Νέα components
cp frontend/PermissionGuard.jsx your-sw-portal/frontend/src/components/
cp frontend/ProfilePage.jsx your-sw-portal/frontend/src/pages/
cp frontend/AdminDashboardPage.jsx your-sw-portal/frontend/src/pages/
cp frontend/NotificationBell.jsx your-sw-portal/frontend/src/components/
```

## Βήμα 3: Ενημέρωση Υπάρχοντων Αρχείων

### Backend: app.py

Προσθέστε τα παρακάτω imports στην αρχή του αρχείου:

```python
# Προσθήκη στα imports
from roles import role_required, admin_only, staff_and_admin, user_can
from user_management import create_user_management_routes
from notifications import create_notification_model, create_notification_routes, create_notification, notify_new_forum_post, notify_new_file_upload
```

Προσθέστε το Notification model μετά τα άλλα models:

```python
# Create Notification model
Notification = None  # Will be initialized in initialize_modules
```

Ενημερώστε την initialize_modules function:

```python
def initialize_modules(app, db, User):
    global jwt, acl_manager, analytics_manager, Notification
    # ... υπάρχων κώδικας ...
    
    # Initialize Notification model
    Notification = create_notification_model(db)

    # Register module blueprints
    # ... υπάρχοντα routes ...
    create_user_management_routes(app, db, User)
    create_notification_routes(app, db, User, Notification)
```

Προσθέστε το νέο permissions endpoint:

```python
@app.route('/api/user/permissions', methods=['GET'])
@jwt_required()
def get_user_permissions():
    user_info = get_current_user_info()
    if not user_info:
        return jsonify({'error': 'User not found'}), 404
    
    user = User.query.get(user_info['id'])
    if not user:
        return jsonify({'error': 'User not found in database'}), 404
    
    role = getattr(user, 'role', 'guest')
    
    permissions = {
        'can_upload_files': role in ['admin', 'staff'],
        'can_create_discussions': role in ['admin', 'staff'],
        'can_delete_posts': role in ['admin'],
        'can_access_admin_dashboard': role in ['admin'],
        'can_manage_users': role in ['admin']
    }
    
    return jsonify(permissions)
```

Ενημερώστε τα υπάρχοντα endpoints με role protection:

```python
# Αλλάξτε από @jwt_required() σε @role_required(['admin', 'staff'])
@app.route('/api/discussions', methods=['POST'])
@role_required(['admin', 'staff'])
def create_discussion():
    # ... υπάρχων κώδικας ...

@app.route('/api/discussions/<int:discussion_id>/posts', methods=['POST'])
@role_required(['admin', 'staff'])
def create_post(discussion_id):
    # ... υπάρχων κώδικας ...
    
    # Προσθήκη notification trigger
    if Notification:
        notify_new_forum_post(db, Notification, discussion_id, user_info['id'], data['content'])
    
    # ... υπόλοιπος κώδικας ...

@app.route('/api/files/upload', methods=['POST'])
@role_required(['admin', 'staff'])
def upload_file():
    # ... υπάρχων κώδικας ...
    
    # Προσθήκη notification trigger
    if Notification:
        notify_new_file_upload(db, Notification, filename, user_info['id'], target_folder)
    
    # ... υπόλοιπος κώδικας ...
```

### Frontend: AuthContext.jsx

Προσθέστε permissions state και functions:

```jsx
// Προσθήκη στο state
const [permissions, setPermissions] = useState({});

// Προσθήκη της fetchPermissions function
const fetchPermissions = async () => {
  try {
    const response = await authService.api('/api/user/permissions');
    setPermissions(response);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    setPermissions({});
  }
};

// Προσθήκη της canDo function
const canDo = (permission) => {
  return permissions[permission] || false;
};

// Ενημέρωση του login function
const login = async (username, password) => {
  // ... υπάρχων κώδικας ...
  
  // Προσθήκη μετά το successful login
  await fetchPermissions();
  
  // ... υπόλοιπος κώδικας ...
};

// Ενημέρωση του logout function
const logout = async () => {
  // ... υπάρχων κώδικας ...
  setPermissions({});
  // ... υπόλοιπος κώδικας ...
};

// Ενημέρωση του value object
const value = {
  // ... υπάρχοντα values ...
  permissions,
  canDo
};
```

### Frontend: App.jsx

Προσθέστε τα imports:

```jsx
import PermissionGuard, { usePermissions } from './components/PermissionGuard';
import ProfilePage from './pages/ProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import NotificationBell from './components/NotificationBell';
```

Ενημερώστε τη Navigation function:

```jsx
// Προσθήκη του permissions hook
const permissions = usePermissions();

// Προσθήκη admin navigation items
const adminNavItems = permissions.canAccessAdminDashboard() ? [
  { path: '/admin', label: 'Διαχείριση', icon: Shield },
] : [];

const allNavItems = [...navItems, ...adminNavItems];

// Χρήση allNavItems αντί για navItems στο rendering
```

Προσθέστε το NotificationBell στη navigation:

```jsx
{isAuthenticated ? (
  <>
    <NotificationBell />
    <div className="relative">
      {/* ... υπάρχων user menu κώδικας ... */}
    </div>
  </>
) : (
  // ... login button ...
)}
```

Προσθέστε τα νέα routes:

```jsx
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
```

## Βήμα 4: Database Migration

Το νέο Notification model θα δημιουργηθεί αυτόματα κατά την πρώτη εκκίνηση. Αν χρησιμοποιείτε migrations, προσθέστε:

```python
# Αν χρησιμοποιείτε Flask-Migrate
flask db migrate -m "Add notification model"
flask db upgrade
```

## Βήμα 5: Εκκίνηση και Έλεγχος

1. **Εκκίνηση Backend**:
```bash
cd your-sw-portal/backend
python app.py
```

2. **Εκκίνηση Frontend**:
```bash
cd your-sw-portal/frontend
npm install  # αν χρειάζεται
npm run dev
```

3. **Έλεγχος Λειτουργίας**:
   - Επισκεφθείτε http://localhost:5173
   - Συνδεθείτε με admin credentials
   - Ελέγξτε ότι εμφανίζεται το καμπανάκι ειδοποιήσεων
   - Ελέγξτε ότι υπάρχει πρόσβαση στο Admin Dashboard (/admin)
   - Ελέγξτε ότι το Profile page λειτουργεί (/profile)

## Αντιμετώπιση Προβλημάτων

### Πρόβλημα: Import errors στο backend
**Λύση**: Βεβαιωθείτε ότι όλα τα νέα modules είναι στον σωστό φάκελο και ότι τα imports είναι σωστά.

### Πρόβλημα: Component not found errors στο frontend
**Λύση**: Βεβαιωθείτε ότι τα paths στα imports είναι σωστά και ότι τα αρχεία είναι στους σωστούς φακέλους.

### Πρόβλημα: Database errors
**Λύση**: Διαγράψτε το database file και αφήστε το να δημιουργηθεί ξανά, ή τρέξτε migrations.

### Πρόβλημα: Permissions δεν λειτουργούν
**Λύση**: Βεβαιωθείτε ότι οι χρήστες έχουν τον σωστό role στη βάση δεδομένων.

## Rollback

Αν χρειαστεί να επιστρέψετε στην προηγούμενη έκδοση:

1. Αντικαταστήστε τα τροποποιημένα αρχεία με τα backup
2. Διαγράψτε τα νέα αρχεία
3. Επαναφέρετε τη βάση δεδομένων από το backup

## Υποστήριξη

Για προβλήματα ή ερωτήσεις, ανατρέξτε στο CHANGELOG_MANUS.md για λεπτομέρειες των αλλαγών.

