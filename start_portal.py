import subprocess
import platform
import os

def run_command(command, name, cwd):
    """Runs a command in a new terminal window."""
    if platform.system() == "Windows":
        # On Windows, 'start' opens a new command prompt window.
        # We use 'cmd /c' to execute the command within that new window.
        return subprocess.Popen(f'start "{name}" cmd /c "{command}"', shell=True, cwd=cwd)
    elif platform.system() == "Darwin":
        # On macOS, we can use osascript to open a new Terminal window.
        # Note: This might require Terminal app permissions.
        script = f'tell app "Terminal" to do script "cd {os.path.join(os.getcwd(), cwd)} && {command}"'
        return subprocess.Popen(['osascript', '-e', script])
    else:
        # On Linux, we can use x-terminal-emulator to open a new terminal.
        # This is a generic command that should work on most Debian/Ubuntu based systems.
        return subprocess.Popen([
            'x-terminal-emulator',
            '-e',
            f'bash -c "cd {os.path.join(os.getcwd(), cwd)}; {command}; exec bash"'
        ])

def main():
    """
    Starts the backend and frontend servers in parallel, each in its own terminal window.
    """
    print("🚀 Starting SW Portal...")

    # --- Commands ---
    # Backend command: activate venv and run flask app
    backend_command = "python app.py"
    
    # Frontend command: install dependencies (if needed) and run dev server
    frontend_command = "pnpm run dev"

    # --- Directories ---
    backend_dir = "backend"
    frontend_dir = "frontend"

    print(f"-> Starting Backend Server in '{backend_dir}'...")
    backend_process = run_command(backend_command, "SW Portal - Backend", backend_dir)

    print(f"-> Starting Frontend Server in '{frontend_dir}'...")
    frontend_process = run_command(frontend_command, "SW Portal - Frontend", frontend_dir)

    print("\n✅ Both servers have been launched in separate windows.")
    print("   - Backend is starting on http://127.0.0.1:5000")
    print("   - Frontend is starting on http://localhost:5173")
    print("\nTo stop the servers, simply close their respective terminal windows.")

if __name__ == "__main__":
    main()
