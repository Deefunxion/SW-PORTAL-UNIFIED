#!/usr/bin/env python3
"""
Development setup script for ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ
Lightweight setup that works on any machine
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_command(cmd, description, check=True):
    """Run a command and handle errors gracefully."""
    print(f"[*] {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if check and result.returncode != 0:
            print(f"[ERROR] {result.stderr}")
            return False
        if result.stdout:
            print(f"[OK] {result.stdout.strip()}")
        return True
    except Exception as e:
        print(f"[ERROR] Error running command: {e}")
        return False

def main():
    """Setup development environment."""
    print("Setting up ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ development environment...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("[ERROR] Python 3.8+ is required")
        return False
    
    print(f"[OK] Python {sys.version_info.major}.{sys.version_info.minor} detected")
    
    # Create necessary directories
    directories = ['uploads', 'logs', 'backend/instance']
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"[OK] Created directory: {directory}")
    
    # Copy environment file if it doesn't exist
    if not os.path.exists('.env'):
        if os.path.exists('.env.development'):
            shutil.copy('.env.development', '.env')
            print("[OK] Copied .env.development to .env")
        elif os.path.exists('.env.example'):
            shutil.copy('.env.example', '.env')
            print("[OK] Copied .env.example to .env")
    
    # Install backend dependencies
    print("\nInstalling backend dependencies...")
    if not run_command('pip install -r backend/requirements.txt', 'Installing backend packages'):
        print("[WARN] Some packages might not have installed correctly")
    
    # Install testing dependencies (optional)
    if os.path.exists('backend/requirements-test.txt'):
        run_command('pip install -r backend/requirements-test.txt', 'Installing test packages', check=False)
    
    # Check if Node.js is available for frontend
    if run_command('node --version', 'Checking Node.js', check=False):
        print("\nInstalling frontend dependencies...")
        os.chdir('frontend')
        if not run_command('npm install', 'Installing frontend packages'):
            print("[WARN] Frontend setup failed - you can run 'npm install' later in the frontend/ directory")
        os.chdir('..')
    else:
        print("[INFO] Node.js not found - skipping frontend setup")
    
    # Initialize database
    print("\nSetting up database...")
    os.chdir('backend')
    run_command('python create_db.py', 'Creating database', check=False)
    os.chdir('..')
    
    # Test basic functionality
    print("\nRunning basic tests...")
    os.chdir('backend')
    run_command('python -m pytest ../tests/test_basic.py -v', 'Running basic tests', check=False)
    os.chdir('..')
    
    print("\nDevelopment setup complete!")
    print("\nNext steps:")
    print("1. Review .env file and update any necessary values")
    print("2. Start the backend: python backend/app.py")
    print("3. Start the frontend: cd frontend && npm run dev")
    print("4. Run tests: cd backend && python -m pytest ../tests/")
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)