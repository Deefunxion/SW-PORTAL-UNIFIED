# SW Portal Extensions v2.0.0

Επεκτάσεις για το SW Portal που προσθέτουν προηγμένες λειτουργίες διαχείρισης χρηστών, ασφάλειας και ειδοποιήσεων.

## 🚀 Νέες Λειτουργίες

### 1. Granular Role-Based Access Control (RBAC)
- **Προστασία API endpoints** βάσει ρόλου χρήστη (admin, staff, guest)
- **Frontend permission guards** για conditional rendering
- **Ιεραρχία ρόλων** με διαφορετικά δικαιώματα
- **Αυτόματη προστασία** κρίσιμων λειτουργιών

### 2. User Profile & Admin Dashboard
- **Διαχείριση προφίλ** με αλλαγή email και password
- **Admin dashboard** για διαχείριση χρηστών
- **Στατιστικά συστήματος** και χρηστών
- **CRUD operations** για χρήστες (admin only)

### 3. Real-Time Notification System
- **Αυτόματες ειδοποιήσεις** για forum posts και file uploads
- **Real-time polling** κάθε 30 δευτερόλεπτα
- **Notification management** (mark as read, delete)
- **Καμπανάκι ειδοποιήσεων** στη navigation bar

## 📁 Δομή Αρχείων

```
sw-portal-extensions/
├── backend/
│   ├── roles.py                    # RBAC decorators και utilities
│   ├── user_management.py          # User management endpoints
│   ├── notifications.py            # Notification system
│   └── app.py                      # Τροποποιημένο κύριο αρχείο
├── frontend/
│   ├── PermissionGuard.jsx         # Permission-based rendering
│   ├── ProfilePage.jsx             # User profile page
│   ├── AdminDashboardPage.jsx      # Admin dashboard
│   ├── NotificationBell.jsx        # Notification component
│   ├── AuthContext.jsx             # Τροποποιημένο auth context
│   └── App.jsx                     # Τροποποιημένο main app
├── CHANGELOG_MANUS.md              # Λεπτομερείς αλλαγές
├── INSTALLATION_GUIDE.md           # Οδηγός εγκατάστασης
└── README.md                       # Αυτό το αρχείο
```

## 🔧 Εγκατάσταση

Δείτε το [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) για λεπτομερείς οδηγίες εγκατάστασης.

### Γρήγορη Εγκατάσταση

1. **Backup** του υπάρχοντος συστήματος
2. **Αντιγραφή** των νέων αρχείων
3. **Ενημέρωση** των υπάρχοντων αρχείων
4. **Εκκίνηση** του συστήματος

```bash
# Backend
cd backend && python app.py

# Frontend  
cd frontend && npm run dev
```

## 🛡️ Ασφάλεια

### Role Hierarchy
- **Admin**: Πλήρη δικαιώματα, διαχείριση χρηστών
- **Staff**: Δημιουργία content, upload αρχείων
- **Guest**: Μόνο ανάγνωση

### Protected Endpoints
- `/api/discussions` (POST) - Admin/Staff only
- `/api/files/upload` (POST) - Admin/Staff only
- `/api/admin/*` - Admin only
- `/api/user/profile` (PUT) - Authenticated users

## 📊 API Endpoints

### User Management
```
GET    /api/user/profile           # Προφίλ χρήστη
PUT    /api/user/profile           # Ενημέρωση προφίλ
GET    /api/user/permissions       # Δικαιώματα χρήστη
```

### Admin Dashboard
```
GET    /api/admin/users            # Λίστα χρηστών
POST   /api/admin/users            # Δημιουργία χρήστη
PUT    /api/admin/users/:id        # Ενημέρωση χρήστη
DELETE /api/admin/users/:id        # Διαγραφή χρήστη
GET    /api/admin/stats            # Στατιστικά
```

### Notifications
```
GET    /api/notifications          # Λίστα ειδοποιήσεων
POST   /api/notifications/mark-as-read  # Σήμανση ως αναγνωσμένες
DELETE /api/notifications/:id      # Διαγραφή ειδοποίησης
```

## 🎨 Frontend Components

### PermissionGuard
```jsx
<PermissionGuard permission="can_upload_files">
  <UploadButton />
</PermissionGuard>
```

### usePermissions Hook
```jsx
const permissions = usePermissions();
if (permissions.canAccessAdminDashboard()) {
  // Show admin content
}
```

### NotificationBell
Αυτόματα εμφανίζεται στη navigation bar για authenticated users.

## 🔄 Συμβατότητα

- **100% Backward Compatible**: Δεν αλλοιώνει υπάρχουσες λειτουργίες
- **Προαιρετικές επεκτάσεις**: Μπορούν να ενεργοποιηθούν σταδιακά
- **Υπάρχοντα accounts**: Συνεχίζουν να λειτουργούν (default guest role)

## 🧪 Testing

### Test Credentials
```
Admin:  admin / admin123
Staff:  staff / staff123
Guest:  guest / guest123
```

### Test Scenarios
1. **RBAC**: Δοκιμάστε πρόσβαση με διαφορετικούς ρόλους
2. **Profile**: Αλλάξτε email και password
3. **Admin Dashboard**: Διαχειριστείτε χρήστες
4. **Notifications**: Δημιουργήστε forum post και ελέγξτε ειδοποιήσεις

## 📈 Performance

- **Minimal overhead**: Οι νέες λειτουργίες δεν επηρεάζουν την απόδοση
- **Efficient polling**: Notifications polling κάθε 30s
- **Database optimization**: Indexes στα κρίσιμα πεδία
- **Frontend optimization**: Lazy loading και conditional rendering

## 🐛 Troubleshooting

### Συχνά Προβλήματα

1. **Import Errors**: Ελέγξτε τα paths των αρχείων
2. **Permission Denied**: Ελέγξτε τους ρόλους χρηστών
3. **Database Errors**: Τρέξτε migrations ή recreate database
4. **Frontend Errors**: Ελέγξτε τα component imports

### Debug Mode
```bash
# Backend debug
export FLASK_DEBUG=1
python app.py

# Frontend debug
npm run dev -- --debug
```

## 📝 Changelog

Δείτε το [CHANGELOG_MANUS.md](CHANGELOG_MANUS.md) για λεπτομερείς αλλαγές.

## 🤝 Συνεισφορά

Για προσθήκη νέων λειτουργιών:

1. Δημιουργήστε νέα modules αντί να τροποποιείτε υπάρχοντα
2. Χρησιμοποιήστε τα υπάρχοντα patterns (decorators, hooks)
3. Προσθέστε documentation και tests
4. Ενημερώστε το CHANGELOG_MANUS.md

## 📞 Υποστήριξη

- **Documentation**: Ανατρέξτε στα .md αρχεία
- **Code Comments**: Inline documentation στον κώδικα
- **Error Messages**: Φιλικά μηνύματα στα ελληνικά

## 📄 Άδεια

Αυτές οι επεκτάσεις ακολουθούν την ίδια άδεια με το κύριο SW Portal project.

---

**Έκδοση**: 2.0.0  
**Ημερομηνία**: 14 Ιουλίου 2025  
**Developer**: Manus AI Assistant  
**Συμβατότητα**: SW Portal v1.x και νεότερες

