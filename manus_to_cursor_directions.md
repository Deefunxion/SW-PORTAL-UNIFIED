**Project:** SW Portal - Final Backend Refactoring

**Current State:**
The Flask backend was originally a single, large `app.py` file. We have initiated a major refactoring to implement the "Application Factory" pattern and improve modularity. An AI agent has already performed some initial steps, such as moving some model definitions and creating a `my_project` directory. However, the project is currently in a broken, non-functional state with numerous `ModuleNotFoundError` and circular import issues across many files.

**Primary Goal:**
Take the project from its current, partially-refactored state to a **fully functional, clean, and professional Flask application structure.** The final application must be runnable, and the Celery worker must start without any errors. This prompt contains the complete and final set of instructions to achieve this.

**Target Directory Structure:**
Our final goal is a clean separation of concerns. The structure inside the `backend/` directory should be:

backend/
├── app.py              # The main entry point to run the app.
├── tasks.py            # All Celery tasks.
├── config.py           # All configuration variables.
└── my_project/
├── init.py     # The Application Factory (create_app function).
├── extensions.py   # Initializes extensions (db, celery, etc.).
├── models.py       # All SQLAlchemy model classes.
└── routes.py       # All Flask routes, organized in a Blueprint.
*(Note: You have the authority to create, move, and delete files to achieve this structure.)*

**Comprehensive Step-by-Step Instructions:**

1.  **Analyze the Entire `backend` Directory:** Please read and understand all `.py` files currently inside the `backend` directory and its subdirectories to get a complete picture of the current, broken state.

2.  **Consolidate and Structure the Codebase:**
    *   **Configuration (`config.py`):** Ensure ALL configuration variables (e.g., `SECRET_KEY`, `SQLALCHEMY_DATABASE_URI`, `CELERY_BROKER_URL`) are located *only* in `backend/config.py`.
    *   **Extensions (`my_project/extensions.py`):** Initialize all Flask extensions here, without an app instance. This is the most critical step to break circular dependencies.
        ```python
        # backend/my_project/extensions.py
        from flask_sqlalchemy import SQLAlchemy
        from celery import Celery

        db = SQLAlchemy()
        # Initialize celery here, but it will be configured in the factory
        celery = Celery(__name__, broker='redis://localhost:6379/0', backend='redis://localhost:6379/0')
        ```
    *   **Models (`my_project/models.py`):** Consolidate ALL SQLAlchemy model classes (`User`, `Category`, `Post`, etc.) into this single file. They must import `db` from `.extensions`.
    *   **Routes (`my_project/routes.py`):** Consolidate ALL Flask routes (`@app.route`) into this file. They **must** be refactored to use a single Flask `Blueprint`. Inside the route functions, application context objects (like `db.session` or `current_app.config`) must be accessed via `from flask import current_app` or by importing `db` from `.extensions`.

3.  **Refactor the Application Factory (`my_project/__init__.py`):**
    *   This file must contain the `create_app()` function.
    *   Inside `create_app()`, it must perform the following, in order:
        1.  Create the Flask `app` instance.
        2.  Load the configuration from `config.py`.
        3.  Initialize the extensions by calling `db.init_app(app)` and `celery.conf.update(app.config)`.
        4.  Import the `Blueprint` from `routes.py` and register it with `app.register_blueprint(...)`.
        5.  Within an `with app.app_context():`, call `db.create_all()` to ensure tables are created.
        6.  Return the `app` instance.

4.  **Finalize the Entry Point (`app.py`) and Tasks (`tasks.py`):**
    *   The main `backend/app.py` file should become very simple. It should only import `create_app` from `my_project` to create the `app` instance, and import `celery` from `my_project.extensions`.
    *   The `backend/tasks.py` file should also import the `celery` instance from `backend/my_project.extensions`.

5.  **Fix All Imports (Crucial):**
    *   Go through every single `.py` file again and ensure all `import` statements are **absolute and correct** based on the final, clean structure. This includes fixing the imports in all the files that the previous agent failed to update, such as `analytics.py`, `roles.py`, `forum_api.py`, etc. There should be no remaining relative imports (`..`) that cause errors.

**Final Success Metrics:**
The refactoring is complete and successful ONLY when the following two commands run **without any errors**:

1.  From the project root, start the web server: `flask run` (or `python backend/app.py`).
2.  In a separate terminal, from the project root, start the Celery worker: `celery -A backend.app:celery worker --loglevel=info`.

Please proceed with this complete and final refactoring plan.