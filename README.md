# 🏛️ SW Portal - Ενιαίο Σύστημα Περιφέρειας Αττικής

## 📋 Επισκόπηση

Το **SW Portal** είναι ένα ενιαίο, τοπικά εκτελέσιμο σύστημα που συνδυάζει:

- 📁 **Apothecary Enhanced** - Σύστημα διαχείρισης αρχείων με drag & drop, upload και folder management
- 💬 **Forum Module** - Επαγγελματικό φόρουμ συζητήσεων με κατηγοριοποίηση
- 🤖 **AI Assistant** - Έξυπνος βοηθός για νομικές συμβουλές και υποστήριξη

## 🏗️ Αρχιτεκτονική

```
sw-portal-unified/
├── backend/          # Flask API Server
│   ├── app.py        # Κύρια εφαρμογή Flask
│   ├── requirements.txt
│   └── .env.example
├── frontend/         # React Application
│   ├── src/
│   │   ├── pages/    # Σελίδες εφαρμογής
│   │   ├── components/ # React components
│   │   └── App.jsx   # Κύρια εφαρμογή
│   ├── package.json
│   └── index.html
├── content/          # Downloadable Files
│   ├── NEWS_FEEDS_SOURCES/
│   ├── ΑΠΟΦΑΣΕΙΣ_ΑΔΕΙΟΔΟΤΗΣΗΣ/
│   └── ...
└── README.md         # Αυτό το αρχείο
```

## 🚀 Γρήγορη Εκκίνηση

### Προαπαιτούμενα

- **Python 3.8+** (για το backend)
- **Node.js 18+** (για το frontend)
- **Git** (για κλωνοποίηση του project)

### 1️⃣ Κλωνοποίηση του Project

```bash
git clone <repository-url>
cd sw-portal-unified
```

### 2️⃣ Εκκίνηση Backend (Flask)

```bash
# Μετάβαση στον φάκελο backend
cd backend

# Εγκατάσταση dependencies
pip install -r requirements.txt

# Αντιγραφή και επεξεργασία environment variables
cp .env.example .env

# Εκκίνηση server
python app.py
```

Το backend θα τρέχει στο: `http://localhost:5000`

### 3️⃣ Εκκίνηση Frontend (React)

```bash
# Άνοιγμα νέου terminal
# Μετάβαση στον φάκελο frontend
cd frontend

# Εγκατάσταση dependencies
npm install

# Εκκίνηση development server
npm run dev
```

Το frontend θα τρέχει στο: `http://localhost:5173`

### 4️⃣ Πρόσβαση στην Εφαρμογή

Ανοίξτε το browser και πηγαίνετε στο: `http://localhost:5173`

## 📖 Αναλυτικές Οδηγίες Εγκατάστασης

### 🪟 Windows

#### Βήμα 1: Εγκατάσταση Python

1. Κατεβάστε το Python από: https://www.python.org/downloads/
2. Κατά την εγκατάσταση, επιλέξτε "Add Python to PATH"
3. Ανοίξτε Command Prompt και ελέγξτε: `python --version`

#### Βήμα 2: Εγκατάσταση Node.js

1. Κατεβάστε το Node.js από: https://nodejs.org/
2. Εγκαταστήστε με τις προεπιλεγμένες ρυθμίσεις
3. Ανοίξτε Command Prompt και ελέγξτε: `node --version`

#### Βήμα 3: Εγκατάσταση Git (προαιρετικό)

1. Κατεβάστε το Git από: https://git-scm.com/download/win
2. Εγκαταστήστε με τις προεπιλεγμένες ρυθμίσεις

#### Βήμα 4: Εκκίνηση Εφαρμογής

1. **Εκκίνηση Backend:**
   ```cmd
   cd backend
   pip install -r requirements.txt
   copy .env.example .env
   python app.py
   ```

2. **Εκκίνηση Frontend (νέο Command Prompt):**
   ```cmd
   cd frontend
   npm install
   npm run dev
   ```

### 🐧 Linux (Ubuntu/Debian)

#### Βήμα 1: Εγκατάσταση Python

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
python3 --version
```

#### Βήμα 2: Εγκατάσταση Node.js

```bash
# Μέθοδος 1: Από τα repositories
sudo apt install nodejs npm

# Μέθοδος 2: Από NodeSource (συνιστάται)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

node --version
npm --version
```

#### Βήμα 3: Εγκατάσταση Git

```bash
sudo apt install git
```

#### Βήμα 4: Εκκίνηση Εφαρμογής

1. **Εκκίνηση Backend:**
   ```bash
   cd backend
   pip3 install -r requirements.txt
   cp .env.example .env
   python3 app.py
   ```

2. **Εκκίνηση Frontend (νέο terminal):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## ⚙️ Ρυθμίσεις

### Environment Variables (.env)

Επεξεργαστείτε το αρχείο `backend/.env`:

```env
# Flask Configuration
SECRET_KEY=sw-portal-secret-key-2025
FLASK_ENV=development

# OpenAI Configuration (Προαιρετικό - για AI Assistant)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_ASSISTANT_ID=your_assistant_id_here

# Database Configuration
# DATABASE_URL=sqlite:///sw_portal.db  # Προεπιλογή

# File Upload Configuration
MAX_CONTENT_LENGTH=16777216  # 16MB
```

### Ρύθμιση AI Assistant (Προαιρετικό)

Για να λειτουργήσει πλήρως το AI Assistant:

1. Δημιουργήστε λογαριασμό στο OpenAI
2. Αποκτήστε API key από: https://platform.openai.com/api-keys
3. Δημιουργήστε έναν Assistant στο OpenAI platform
4. Προσθέστε τα στοιχεία στο `.env` αρχείο

**Σημείωση:** Το AI Assistant θα λειτουργεί με mock responses χωρίς OpenAI configuration.

## 🗂️ Διαχείριση Αρχείων

### Προσθήκη Αρχείων στο Apothecary

1. Τοποθετήστε αρχεία στον φάκελο `content/`
2. Οργανώστε τα σε κατηγορίες (φακέλους)
3. Τα αρχεία θα εμφανιστούν αυτόματα στο Apothecary

### Δομή Φακέλων

```
content/
├── NEWS_FEEDS_SOURCES/
├── ΑΠΟΦΑΣΕΙΣ_ΑΔΕΙΟΔΟΤΗΣΗΣ/
│   ├── ΚΑΑ - ΚΔΗΦ/
│   ├── ΚΔΑΠ - ΚΔΑΠ ΑμεΑ/
│   └── ...
├── ΕΚΠΑΙΔΕΥΤΙΚΟ_ΥΛΙΚΟ/
├── ΕΝΤΥΠΑ_ΑΙΤΗΣΕΩΝ/
└── ΝΟΜΟΘΕΣΙΑ_ΚΟΙΝΩΝΙΚΗΣ_ΜΕΡΙΜΝΑΣ/
```

## 🔧 Συντήρηση

### Backup Database

```bash
# Backup της βάσης δεδομένων
cp backend/sw_portal.db backup/sw_portal_$(date +%Y%m%d).db
```

### Ενημέρωση Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt --upgrade

# Frontend
cd frontend
npm update
```

### Logs και Debugging

- **Backend logs:** Εμφανίζονται στο terminal όπου τρέχει το `python app.py`
- **Frontend logs:** Εμφανίζονται στο browser console (F12)
- **Database:** SQLite αρχείο στο `backend/sw_portal.db`

## 🚨 Αντιμετώπιση Προβλημάτων

### Συνήθη Προβλήματα

#### 1. Port Already in Use

```bash
# Εύρεση και τερματισμός διεργασίας
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux
lsof -ti:5000 | xargs kill -9
```

#### 2. Python Module Not Found

```bash
# Εγκατάσταση ξανά των dependencies
cd backend
pip install -r requirements.txt --force-reinstall
```

#### 3. Node Modules Issues

```bash
# Καθαρισμός και επανεγκατάσταση
cd frontend
rm -rf node_modules package-lock.json
npm install
```

#### 4. Database Issues

```bash
# Reset της βάσης δεδομένων
cd backend
rm sw_portal.db
python app.py  # Θα δημιουργηθεί νέα βάση
```

### Επικοινωνία για Υποστήριξη

- 📧 **Email:** support@swportal.gr
- 📱 **Τηλέφωνο:** +30 210 1234567
- 🏢 **Διεύθυνση:** Περιφέρεια Αττικής

## 📊 Χαρακτηριστικά

### ✅ Apothecary Enhanced
- Drag & drop functionality
- File upload με progress tracking
- Folder creation και management
- Αναζήτηση αρχείων σε πραγματικό χρόνο
- Grid/List view modes
- Responsive design

### ✅ Forum Module
- Κατηγοριοποιημένες συζητήσεις
- Real-time post tracking
- User management
- Responsive interface
- Greek language support

### ✅ AI Assistant
- 24/7 διαθεσιμότητα
- Νομικές συμβουλές
- Floating widget σε όλες τις σελίδες
- Thread-based conversations
- Fallback responses χωρίς OpenAI

## 🔒 Ασφάλεια

- Τοπική εγκατάσταση (δεν απαιτείται cloud)
- SQLite database για απλότητα
- File validation για uploads
- CORS protection
- Environment variables για sensitive data

## 📈 Μελλοντικές Βελτιώσεις

- [ ] User authentication system
- [ ] Advanced file permissions
- [ ] Email notifications
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] API documentation
- [ ] Docker containerization

## 📄 Άδεια Χρήσης

Αυτό το project προορίζεται για χρήση από την Περιφέρεια Αττικής και τις υπηρεσίες της.

---

**Δημιουργήθηκε με ❤️ για την Περιφέρεια Αττικής**

*Τελευταία ενημέρωση: 5 Ιουλίου 2025*

