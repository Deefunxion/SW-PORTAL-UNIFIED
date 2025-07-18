import subprocess
import platform
import os

def run_command(command, name, cwd):
    """Runs a command in a new terminal window."""
    abs_cwd = os.path.abspath(cwd)
    if platform.system() == "Windows":
        return subprocess.Popen(
            f'start "{name}" cmd /k "{command}"',
            shell=True,
            cwd=abs_cwd
        )
    elif platform.system() == "Darwin":
        script = f'tell app "Terminal" to do script "cd {abs_cwd} && {command}"'
        return subprocess.Popen(['osascript', '-e', script])
    else:
        return subprocess.Popen([
            'x-terminal-emulator',
            '-e',
            f'bash -c "cd {abs_cwd}; {command}; exec bash"'
        ])

def main():
    print("Starting SW Portal...")

    # --- Commands ---
    backend_command = "C:/Users/dee/Desktop/SW-PORTAL-UNIFIED/.venv/Scripts/python.exe app.py"
    frontend_command = "pnpm run dev"

    # --- Directories ---
    backend_dir = "backend"  # Run backend from backend directory!
    frontend_dir = "frontend"

    print(f"-> Starting Backend Server from '{backend_dir}'...")
    backend_process = run_command(backend_command, "SW Portal - Backend", backend_dir)

    print(f"-> Starting Frontend Server in '{frontend_dir}'...")
    frontend_process = run_command(frontend_command, "SW Portal - Frontend", frontend_dir)

    print("\nBoth servers have been launched in separate windows.")
    print("   - Backend is starting on http://127.0.0.1:5000")
    print("   - Frontend is starting on http://localhost:5173")
    print("\nTo stop the servers, simply close their respective terminal windows.")

if __name__ == "__main__":
    main()
