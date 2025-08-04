#!/usr/bin/env python3
"""
Test runner script for SW Portal
Provides different test running options
"""
import os
import sys
import subprocess
import argparse

def run_command(cmd):
    """Run command and return success status."""
    result = subprocess.run(cmd, shell=True)
    return result.returncode == 0

def main():
    parser = argparse.ArgumentParser(description='Run SW Portal tests')
    parser.add_argument('--basic', action='store_true', help='Run only basic tests')
    parser.add_argument('--api', action='store_true', help='Run API tests')  
    parser.add_argument('--coverage', action='store_true', help='Run with coverage report')
    parser.add_argument('--watch', action='store_true', help='Watch for changes')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    # Build test command
    base_cmd = 'python -m pytest'
    
    # Change to backend directory
    original_dir = os.getcwd()
    os.chdir('backend')
    
    try:
        if args.basic:
            test_path = '../tests/test_basic.py'
        elif args.api:
            test_path = '../tests/test_api/'
        else:
            test_path = '../tests/'
        
        cmd_parts = [base_cmd, test_path]
        
        if args.verbose:
            cmd_parts.append('-v')
        
        if args.coverage:
            cmd_parts.extend(['--cov=my_project', '--cov-report=html', '--cov-report=term'])
        
        if args.watch:
            # For watch mode, we'll use pytest-watch if available
            cmd_parts = ['ptw'] + cmd_parts[1:]
        
        final_cmd = ' '.join(cmd_parts)
        
        print(f"Running tests: {final_cmd}")
        success = run_command(final_cmd)
        
        if args.coverage and success:
            print("Coverage report generated in htmlcov/")
        
        return success
        
    finally:
        os.chdir(original_dir)

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)