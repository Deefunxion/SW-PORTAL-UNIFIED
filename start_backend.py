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

def main():
    print("Starting SW Portal Backend...")

    backend_command = "C:/Users/dee/Desktop/SW-PORTAL-UNIFIED/.venv/Scripts/python.exe app.py"
    backend_dir = "backend"

    print(f"-> Starting Backend Server from '{backend_dir}'...")
    backend_process = run_command(backend_command, "SW Portal - Backend", backend_dir)

    print("\nBackend server has been launched.")
    print("   - Backend is starting on http://127.0.0.1:5000")

if __name__ == "__main__":
    main()