# 🚀 SW Portal - Οδηγός Εγκατάστασης και Deployment

## 📋 Περιεχόμενα

1. [Προαπαιτούμενα](#προαπαιτούμενα)
2. [Εγκατάσταση για Windows](#εγκατάσταση-για-windows)
3. [Εγκατάσταση για Linux](#εγκατάσταση-για-linux)
4. [Ρυθμίσεις Παραγωγής](#ρυθμίσεις-παραγωγής)
5. [Αντιμετώπιση Προβλημάτων](#αντιμετώπιση-προβλημάτων)
6. [Συντήρηση](#συντήρηση)

## 🔧 Προαπαιτούμενα

### Λογισμικό που απαιτείται:

- **Python 3.8 ή νεότερο**
- **Node.js 18 ή νεότερο**
- **Git** (προαιρετικό, για version control)

### Συστήματα που υποστηρίζονται:

- ✅ Windows 10/11
- ✅ Ubuntu 20.04+
- ✅ Debian 11+
- ✅ CentOS 8+
- ✅ macOS 12+ (μη δοκιμασμένο)

## 🪟 Εγκατάσταση για Windows

### Βήμα 1: Εγκατάσταση Python

1. **Κατέβασμα Python:**
   - Πηγαίνετε στο https://www.python.org/downloads/
   - Κατεβάστε την τελευταία έκδοση Python 3.x

2. **Εγκατάσταση:**
   - Εκτελέστε το installer
   - ⚠️ **ΣΗΜΑΝΤΙΚΟ:** Επιλέξτε "Add Python to PATH"
   - Κάντε κλικ "Install Now"

3. **Επαλήθευση:**
   ```cmd
   python --version
   pip --version
   ```

### Βήμα 2: Εγκατάσταση Node.js

1. **Κατέβασμα Node.js:**
   - Πηγαίνετε στο https://nodejs.org/
   - Κατεβάστε την LTS έκδοση

2. **Εγκατάσταση:**
   - Εκτελέστε το installer
   - Ακολουθήστε τις προεπιλεγμένες ρυθμίσεις

3. **Επαλήθευση:**
   ```cmd
   node --version
   npm --version
   ```

### Βήμα 3: Εγκατάσταση SW Portal

1. **Κατέβασμα του project:**
   ```cmd
   # Αν έχετε Git
   git clone <repository-url>
   cd sw-portal-unified
   
   # Ή αποσυμπιέστε το ZIP αρχείο και μεταβείτε στον φάκελο
   ```

2. **Εγκατάσταση Backend:**
   ```cmd
   cd backend
   pip install -r requirements.txt
   copy .env.example .env
   ```

3. **Εγκατάσταση Frontend:**
   ```cmd
   cd ..\frontend
   npm install
   ```

### Βήμα 4: Εκκίνηση Εφαρμογής

1. **Εκκίνηση Backend (Command Prompt 1):**
   ```cmd
   cd backend
   python app.py
   ```

2. **Εκκίνηση Frontend (Command Prompt 2):**
   ```cmd
   cd frontend
   npm run dev
   ```

3. **Πρόσβαση:**
   - Ανοίξτε browser: http://localhost:5173

## 🐧 Εγκατάσταση για Linux

### Βήμα 1: Εγκατάσταση Dependencies

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv nodejs npm git
```

#### CentOS/RHEL:
```bash
sudo yum update
sudo yum install python3 python3-pip nodejs npm git
```

### Βήμα 2: Εγκατάσταση Node.js (νεότερη έκδοση)

```bash
# Εγκατάσταση NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Επαλήθευση
node --version
npm --version
```

### Βήμα 3: Εγκατάσταση SW Portal

```bash
# Κλωνοποίηση project
git clone <repository-url>
cd sw-portal-unified

# Backend setup
cd backend
pip3 install -r requirements.txt --user
cp .env.example .env

# Frontend setup
cd ../frontend
npm install
```

### Βήμα 4: Εκκίνηση Εφαρμογής

```bash
# Terminal 1 - Backend
cd backend
python3 app.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 🏭 Ρυθμίσεις Παραγωγής

### 1. Environment Variables

Επεξεργαστείτε το αρχείο `backend/.env`:

```env
# Παραγωγή
SECRET_KEY=your-super-secret-production-key-here
FLASK_ENV=production

# Database (προαιρετικό - για PostgreSQL)
# DATABASE_URL=postgresql://user:password@localhost/sw_portal

# OpenAI (προαιρετικό)
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_assistant_id

# Security
MAX_CONTENT_LENGTH=16777216  # 16MB
```

### 2. Build Frontend για Παραγωγή

```bash
cd frontend
npm run build
```

### 3. Production Server Setup

#### Με Gunicorn (Linux):

```bash
# Εγκατάσταση Gunicorn
pip3 install gunicorn

# Εκκίνηση production server
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

#### Με Apache/Nginx (προχωρημένο):

Δημιουργήστε virtual host για το frontend build και reverse proxy για το backend.

### 4. Database Migration (προαιρετικό)

Για μετάβαση από SQLite σε PostgreSQL:

```bash
# Εγκατάσταση PostgreSQL driver
pip3 install psycopg2-binary

# Ενημέρωση DATABASE_URL στο .env
# Εκκίνηση εφαρμογής για δημιουργία tables
```

## 🔧 Αντιμετώπιση Προβλημάτων

### Συνήθη Προβλήματα

#### 1. "Python not found"

**Windows:**
```cmd
# Επανεγκατάσταση Python με "Add to PATH"
# Ή προσθήκη manual στο PATH:
# C:\Users\YourUser\AppData\Local\Programs\Python\Python3x\
```

**Linux:**
```bash
# Εγκατάσταση python3
sudo apt install python3 python3-pip
```

#### 2. "Port already in use"

```bash
# Εύρεση διεργασίας
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux:
lsof -ti:5000 | xargs kill -9
```

#### 3. "Module not found"

```bash
# Επανεγκατάσταση dependencies
cd backend
pip3 install -r requirements.txt --force-reinstall

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

#### 4. "Database locked"

```bash
# Διαγραφή και επαναδημιουργία database
cd backend
rm sw_portal.db
python3 app.py  # Θα δημιουργηθεί νέα βάση
```

#### 5. "CORS errors"

Βεβαιωθείτε ότι το backend τρέχει στο port 5000 και το frontend στο 5173.

### Debug Mode

Για περισσότερες πληροφορίες σφαλμάτων:

```bash
# Backend debug
cd backend
FLASK_DEBUG=1 python3 app.py

# Frontend debug
cd frontend
npm run dev -- --debug
```

### Logs

```bash
# Backend logs
tail -f backend/app.log

# System logs (Linux)
journalctl -f -u sw-portal
```

## 🔄 Συντήρηση

### Καθημερινή Συντήρηση

1. **Backup Database:**
   ```bash
   cp backend/sw_portal.db backup/sw_portal_$(date +%Y%m%d).db
   ```

2. **Έλεγχος Logs:**
   ```bash
   tail -n 100 backend/app.log
   ```

3. **Έλεγχος Disk Space:**
   ```bash
   df -h
   du -sh content/
   ```

### Εβδομαδιαία Συντήρηση

1. **Ενημέρωση Dependencies:**
   ```bash
   cd backend
   pip3 list --outdated
   
   cd ../frontend
   npm outdated
   ```

2. **Καθαρισμός Logs:**
   ```bash
   find . -name "*.log" -mtime +30 -delete
   ```

3. **Έλεγχος Performance:**
   ```bash
   htop
   iotop
   ```

### Μηνιαία Συντήρηση

1. **Security Updates:**
   ```bash
   # System updates
   sudo apt update && sudo apt upgrade
   
   # Python packages
   pip3 install --upgrade pip
   pip3 list --outdated
   
   # Node packages
   npm audit
   npm audit fix
   ```

2. **Database Optimization:**
   ```bash
   # SQLite vacuum
   sqlite3 backend/sw_portal.db "VACUUM;"
   ```

3. **Backup Verification:**
   ```bash
   # Test backup restore
   cp backup/sw_portal_latest.db test_restore.db
   sqlite3 test_restore.db ".tables"
   ```

## 📊 Monitoring

### Health Check Endpoints

- **Backend:** http://localhost:5000/health
- **Frontend:** http://localhost:5173 (visual check)

### Performance Metrics

```bash
# Memory usage
ps aux | grep python
ps aux | grep node

# Disk usage
du -sh backend/
du -sh frontend/
du -sh content/

# Network connections
netstat -tulpn | grep :5000
netstat -tulpn | grep :5173
```

### Automated Monitoring Script

```bash
#!/bin/bash
# monitor.sh

echo "=== SW Portal Health Check ==="
echo "Date: $(date)"

# Check backend
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: DOWN"
fi

# Check frontend
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend: OK"
else
    echo "❌ Frontend: DOWN"
fi

# Check disk space
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️  Disk usage: ${DISK_USAGE}% (High)"
else
    echo "✅ Disk usage: ${DISK_USAGE}%"
fi

echo "=========================="
```

## 🆘 Υποστήριξη

### Επικοινωνία

- **Email:** support@swportal.gr
- **Τηλέφωνο:** +30 210 1234567
- **Ώρες υποστήριξης:** Δευτέρα-Παρασκευή, 09:00-17:00

### Αναφορά Προβλημάτων

Όταν αναφέρετε πρόβλημα, παρακαλώ συμπεριλάβετε:

1. **Λειτουργικό σύστημα και έκδοση**
2. **Python και Node.js εκδόσεις**
3. **Μήνυμα σφάλματος (πλήρες)**
4. **Βήματα αναπαραγωγής**
5. **Screenshots (αν χρειάζεται)**

### Χρήσιμα Commands για Debug

```bash
# System info
uname -a
python3 --version
node --version
npm --version

# Process info
ps aux | grep python
ps aux | grep node

# Port usage
netstat -tulpn | grep :5000
netstat -tulpn | grep :5173

# Logs
tail -f backend/app.log
journalctl -f
```

---

**Δημιουργήθηκε για την Περιφέρεια Αττικής**  
*Τελευταία ενημέρωση: 5 Ιουλίου 2025*

