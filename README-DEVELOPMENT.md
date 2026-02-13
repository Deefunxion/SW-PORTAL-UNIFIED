# SW Portal - Development Setup

## Quick Start (Lightweight)

### Prerequisites
- Python 3.8+ 
- Git
- Optional: Node.js 18+ (for frontend)
- Optional: Redis (for background tasks)

### Setup Development Environment

```bash
# 1. Clone and enter directory
cd ΟΠΣΚΜ-UNIFIED

# 2. Run automated setup
python scripts/setup-dev.py

# 3. Start development servers
# Backend (Terminal 1)
cd backend && python app.py

# Frontend (Terminal 2) - if Node.js available  
cd frontend && npm run dev
```

### Manual Setup (if automated fails)

```bash
# Backend
cd backend
pip install -r requirements.txt
pip install -r requirements-test.txt
python create_db.py

# Frontend (optional)
cd frontend
npm install

# Create .env file
cp .env.example .env
```

## Development Workflow

### Running Tests
```bash
# All tests
python scripts/run-tests.py

# Just basic tests
python scripts/run-tests.py --basic

# With coverage
python scripts/run-tests.py --coverage

# API tests only
python scripts/run-tests.py --api --verbose
```

### Testing Individual Components
```bash
cd backend

# Test database connection
python -m pytest ../tests/test_basic.py::test_database_creation -v

# Test API endpoints
python -m pytest ../tests/test_api/ -v

# Test with markers
python -m pytest -m "not slow" -v
```

### Project Structure
```
├── backend/
│   ├── my_project/        # Flask application
│   ├── config/           # Environment configurations
│   ├── requirements.txt  # Python dependencies
│   └── app.py           # Main application entry
├── frontend/
│   ├── src/             # React components
│   └── package.json     # Node.js dependencies  
├── tests/
│   ├── test_basic.py    # Basic functionality tests
│   └── test_api/        # API endpoint tests
└── scripts/
    ├── setup-dev.py     # Development setup
    └── run-tests.py     # Test runner
```

## Configuration

### Environment Variables (.env)
```bash
FLASK_ENV=development
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///sw_portal_dev.db
CELERY_BROKER_URL=redis://localhost:6379/0
```

### Database Management
```bash
# Create tables
cd backend && python create_db.py

# Reset database  
rm backend/sw_portal_dev.db && python backend/create_db.py
```

## Development Features Ready

✅ **Working Now:**
- Flask backend with SQLAlchemy
- React frontend with modern UI (shadcn/ui)
- User authentication (JWT)
- File upload system
- Forum functionality  
- Testing infrastructure
- Configuration management

⏳ **In Progress:**
- AI integration (OpenAI, ChromaDB)
- Document processing pipeline
- Vector search functionality

## Troubleshooting

### Common Issues

**Database errors:**
```bash
cd backend
rm sw_portal_dev.db
python create_db.py
```

**Import errors:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend won't start:**
```bash
cd frontend  
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Tests failing:**
```bash
# Run basic tests to diagnose
python scripts/run-tests.py --basic -v
```

### Performance Considerations (8GB RAM)

- Use SQLite for development (not PostgreSQL)
- Skip heavy AI models during development
- Use `--basic` flag for faster tests
- Consider running frontend and backend separately

### Next Steps

1. **Testing**: Add more comprehensive test coverage
2. **Production Config**: Docker setup and deployment scripts  
3. **AI Integration**: Implement OpenAI chat functionality
4. **Document Processing**: Add real OCR and PII redaction

## Getting Help

- Check `CLAUDE.md` for project context
- Run `python scripts/setup-dev.py` for automated setup
- Use `python scripts/run-tests.py --basic` for quick validation