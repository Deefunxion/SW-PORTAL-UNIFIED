# 🔧 SW Portal - Τεχνική Τεκμηρίωση

## 📋 Περιεχόμενα

1. [Αρχιτεκτονική Συστήματος](#αρχιτεκτονική-συστήματος)
2. [Backend API Documentation](#backend-api-documentation)
3. [Frontend Architecture](#frontend-architecture)
4. [Database Schema](#database-schema)
5. [Security](#security)
6. [Performance](#performance)
7. [Development Guidelines](#development-guidelines)

## 🏗️ Αρχιτεκτονική Συστήματος

### Επισκόπηση

Το SW Portal είναι μια full-stack εφαρμογή που αποτελείται από:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Flask Backend  │    │   SQLite DB     │
│   (Port 5173)   │◄──►│   (Port 5000)   │◄──►│   (Local File)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │ Vite    │            │ Flask   │            │ Content │
    │ Build   │            │ CORS    │            │ Files   │
    │ System  │            │ SQLAlch │            │ System  │
    └─────────┘            └─────────┘            └─────────┘
```

### Τεχνολογίες

#### Backend:
- **Flask 2.3.3** - Web framework
- **SQLAlchemy 3.0.5** - ORM
- **Flask-CORS 4.0.0** - Cross-origin requests
- **OpenAI 1.3.0** - AI Assistant integration
- **Python-dotenv 1.0.0** - Environment variables

#### Frontend:
- **React 19.1.0** - UI framework
- **Vite 6.3.5** - Build tool
- **React Router DOM 7.6.1** - Routing
- **Tailwind CSS 4.1.7** - Styling
- **Lucide React 0.510.0** - Icons
- **Shadcn/UI** - Component library

#### Database:
- **SQLite** - Development/Small deployments
- **PostgreSQL** - Production (optional)

## 🔌 Backend API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
Προς το παρόν δεν υπάρχει authentication. Για παραγωγή, προτείνεται JWT tokens.

### Endpoints

#### Files API

##### GET /files/structure
Επιστρέφει τη δομή αρχείων και φακέλων.

**Response:**
```json
{
  "categories": [
    {
      "id": "news_feeds",
      "category": "NEWS_FEEDS_SOURCES",
      "files": [
        {
          "id": "file_1",
          "name": "sample_news.txt",
          "type": "text",
          "extension": "txt",
          "downloadUrl": "/content/NEWS_FEEDS_SOURCES/sample_news.txt",
          "lastModified": "2025-07-05T05:00:00Z"
        }
      ]
    }
  ],
  "metadata": {
    "total_files": 2,
    "total_categories": 6,
    "last_updated": "2025-07-05T05:00:00Z"
  }
}
```

##### POST /files/upload
Ανεβάζει αρχεία στο σύστημα.

**Request:**
```
Content-Type: multipart/form-data

file: [File]
targetFolder: string (optional)
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file_id": "new_file_123"
}
```

##### POST /folders/create
Δημιουργεί νέο φάκελο.

**Request:**
```json
{
  "name": "Νέος Φάκελος",
  "parentFolder": "parent_folder_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Folder created successfully",
  "folder_id": "new_folder_123"
}
```

#### Forum API

##### GET /discussions
Επιστρέφει όλες τις συζητήσεις ομαδοποιημένες κατά κατηγορία.

**Response:**
```json
[
  {
    "category": "ΓΕΝΙΚΑ ΘΕΜΑΤΑ",
    "description": "Γενικές συζητήσεις",
    "discussions": [
      {
        "id": 1,
        "title": "Τίτλος συζήτησης",
        "description": "Περιγραφή συζήτησης",
        "post_count": 5,
        "created_at": "2025-07-05T05:00:00Z",
        "updated_at": "2025-07-05T06:00:00Z",
        "last_post": {
          "user": "admin",
          "created_at": "2025-07-05T06:00:00Z"
        }
      }
    ]
  }
]
```

##### POST /discussions
Δημιουργεί νέα συζήτηση.

**Request:**
```json
{
  "title": "Τίτλος συζήτησης",
  "description": "Περιγραφή συζήτησης",
  "category_id": 1
}
```

##### GET /discussions/{id}/posts
Επιστρέφει τα posts μιας συζήτησης.

**Response:**
```json
{
  "discussion": {
    "id": 1,
    "title": "Τίτλος συζήτησης",
    "category": "ΓΕΝΙΚΑ ΘΕΜΑΤΑ"
  },
  "posts": [
    {
      "id": 1,
      "content": "Περιεχόμενο post",
      "user": "admin",
      "created_at": "2025-07-05T05:00:00Z"
    }
  ]
}
```

##### POST /discussions/{id}/posts
Προσθέτει νέο post σε συζήτηση.

**Request:**
```json
{
  "content": "Περιεχόμενο post"
}
```

##### GET /categories
Επιστρέφει όλες τις κατηγορίες φόρουμ.

**Response:**
```json
[
  {
    "id": 1,
    "title": "ΓΕΝΙΚΑ ΘΕΜΑΤΑ",
    "description": "Γενικές συζητήσεις"
  }
]
```

#### AI Assistant API

##### POST /chat
Στέλνει μήνυμα στον AI Assistant.

**Request:**
```json
{
  "message": "Πώς μπορώ να υποβάλω αίτηση;",
  "thread_id": "thread_123" // optional
}
```

**Response:**
```json
{
  "response": "Για να υποβάλετε αίτηση...",
  "thread_id": "thread_123"
}
```

#### Health Check

##### GET /health
Επιστρέφει την κατάσταση του συστήματος.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-05T05:00:00Z",
  "version": "1.0.0",
  "database": "connected",
  "ai_assistant": "configured"
}
```

## ⚛️ Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── ui/                 # Shadcn/UI components
│   └── ChatWidget.jsx      # Floating AI widget
├── pages/
│   ├── HomePage.jsx        # Dashboard
│   ├── ApothecaryPage.jsx  # File management
│   ├── ForumPage.jsx       # Forum discussions
│   ├── DiscussionDetail.jsx # Individual discussion
│   └── AssistantPage.jsx   # AI Assistant interface
├── App.jsx                 # Main app with routing
└── main.jsx               # Entry point
```

### State Management

Το project χρησιμοποιεί React hooks για state management:

- `useState` - Local component state
- `useEffect` - Side effects και API calls
- `useParams` - URL parameters
- `useLocation` - Current route information

### Routing

```jsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/apothecary" element={<ApothecaryPage />} />
  <Route path="/forum" element={<ForumPage />} />
  <Route path="/forum/:discussionId" element={<DiscussionDetail />} />
  <Route path="/assistant" element={<AssistantPage />} />
</Routes>
```

### API Integration

Όλα τα API calls γίνονται με fetch():

```javascript
const fetchData = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/endpoint');
    const data = await response.json();
    setData(data);
  } catch (error) {
    console.error('API Error:', error);
  }
};
```

## 🗄️ Database Schema

### Tables

#### categories
```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### discussions
```sql
CREATE TABLE discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id)
);
```

#### posts
```sql
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    user VARCHAR(100) DEFAULT 'anonymous',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discussion_id) REFERENCES discussions (id)
);
```

#### users (μελλοντική επέκταση)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_discussions_category ON discussions(category_id);
CREATE INDEX idx_posts_discussion ON posts(discussion_id);
CREATE INDEX idx_posts_created_at ON posts(created_at);
```

## 🔒 Security

### Current Security Measures

1. **CORS Protection** - Configured για localhost development
2. **File Upload Validation** - Έλεγχος τύπων αρχείων
3. **SQL Injection Protection** - SQLAlchemy ORM
4. **XSS Protection** - React built-in protection

### Προτάσεις για Παραγωγή

1. **Authentication & Authorization:**
   ```python
   from flask_jwt_extended import JWTManager, create_access_token
   
   # JWT configuration
   app.config['JWT_SECRET_KEY'] = 'your-secret-key'
   jwt = JWTManager(app)
   ```

2. **Input Validation:**
   ```python
   from marshmallow import Schema, fields, validate
   
   class PostSchema(Schema):
       content = fields.Str(required=True, validate=validate.Length(min=1, max=1000))
   ```

3. **Rate Limiting:**
   ```python
   from flask_limiter import Limiter
   
   limiter = Limiter(
       app,
       key_func=lambda: request.remote_addr,
       default_limits=["200 per day", "50 per hour"]
   )
   ```

4. **HTTPS Configuration:**
   ```python
   # Force HTTPS in production
   @app.before_request
   def force_https():
       if not request.is_secure and app.env != 'development':
           return redirect(request.url.replace('http://', 'https://'))
   ```

## ⚡ Performance

### Backend Optimization

1. **Database Connection Pooling:**
   ```python
   app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
       'pool_size': 10,
       'pool_recycle': 120,
       'pool_pre_ping': True
   }
   ```

2. **Caching:**
   ```python
   from flask_caching import Cache
   
   cache = Cache(app, config={'CACHE_TYPE': 'simple'})
   
   @cache.memoize(timeout=300)
   def get_file_structure():
       # Expensive operation
       pass
   ```

3. **Async Operations:**
   ```python
   import asyncio
   from concurrent.futures import ThreadPoolExecutor
   
   executor = ThreadPoolExecutor(max_workers=4)
   ```

### Frontend Optimization

1. **Code Splitting:**
   ```javascript
   const LazyComponent = lazy(() => import('./LazyComponent'));
   ```

2. **Memoization:**
   ```javascript
   const MemoizedComponent = memo(({ data }) => {
       return <div>{data}</div>;
   });
   ```

3. **Virtual Scrolling** (για μεγάλες λίστες):
   ```javascript
   import { FixedSizeList as List } from 'react-window';
   ```

### Monitoring

```python
import time
from functools import wraps

def monitor_performance(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()
        result = f(*args, **kwargs)
        end_time = time.time()
        print(f"{f.__name__} took {end_time - start_time:.2f} seconds")
        return result
    return decorated_function
```

## 👨‍💻 Development Guidelines

### Code Style

#### Python (Backend):
```python
# PEP 8 compliance
# Use type hints
def create_discussion(title: str, category_id: int) -> dict:
    """Create a new discussion."""
    pass

# Use docstrings
def upload_file(file_data: bytes, filename: str) -> bool:
    """
    Upload a file to the content directory.
    
    Args:
        file_data: Binary file data
        filename: Name of the file
        
    Returns:
        bool: True if successful, False otherwise
    """
    pass
```

#### JavaScript (Frontend):
```javascript
// Use const/let, avoid var
const API_BASE_URL = 'http://localhost:5000/api';

// Use arrow functions
const fetchData = async () => {
  // Implementation
};

// Use destructuring
const { data, loading, error } = useApiCall();

// Use meaningful names
const isUserAuthenticated = checkAuthStatus();
```

### Git Workflow

```bash
# Feature development
git checkout -b feature/new-feature
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Bug fixes
git checkout -b fix/bug-description
git commit -m "fix: resolve issue with..."

# Commit message format
# type(scope): description
# 
# Types: feat, fix, docs, style, refactor, test, chore
```

### Testing

#### Backend Tests:
```python
import unittest
from app import app, db

class TestAPI(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        
    def test_health_endpoint(self):
        response = self.app.get('/health')
        self.assertEqual(response.status_code, 200)
```

#### Frontend Tests:
```javascript
import { render, screen } from '@testing-library/react';
import HomePage from './HomePage';

test('renders welcome message', () => {
  render(<HomePage />);
  const linkElement = screen.getByText(/καλώς ήρθατε/i);
  expect(linkElement).toBeInTheDocument();
});
```

### Environment Setup

#### Development:
```bash
# Backend
export FLASK_ENV=development
export FLASK_DEBUG=1

# Frontend
npm run dev
```

#### Production:
```bash
# Backend
export FLASK_ENV=production
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Frontend
npm run build
serve -s dist
```

### API Versioning

```python
# Version 1
@app.route('/api/v1/discussions')
def get_discussions_v1():
    pass

# Version 2 (future)
@app.route('/api/v2/discussions')
def get_discussions_v2():
    pass
```

### Error Handling

#### Backend:
```python
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500
```

#### Frontend:
```javascript
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return <div>Κάτι πήγε στραβά. Παρακαλώ ανανεώστε τη σελίδα.</div>;
  }
  
  return children;
};
```

---

**Δημιουργήθηκε για την Περιφέρεια Αττικής**  
*Τελευταία ενημέρωση: 5 Ιουλίου 2025*

