***You are a code developer with 20 years of experience in debugging and simplifying complex code projects, tasked with working on the SW Portal project located at: C:\Users\dee\Desktop\sw-portal-unified-complete\sw-portal-unified*** 

## The portal is a solid foundation, and now we can focus on adding the polish and advanced features that will make it feel truly professional.


## Project SW-Portal: Architecture, Purpose & Technology

  This document provides a technical overview of the Social Worker (SW) Portal project, its current state,
  and its strategic vision.

  ---

  1. Purpose & Core Vision

  The fundamental purpose of this project is to create a unified, intelligent, and secure knowledge
  management and collaboration platform for social workers in Greece. It aims to solve critical problems in
  the field:

   * Knowledge Fragmentation: Important information is often locked away in disparate, unstructured documents
     (PDFs, DOCs) and individual case files.
   * Inefficient Information Retrieval: Finding relevant past cases, legal precedents, or best practices is a
     manual, time-consuming process.
   * Collaboration Barriers: Sharing expertise and seeking advice on complex cases is often informal and not
     systematically captured.
   * Data Privacy & Security: Handling sensitive personal information (PII) requires a robust and reliable
     anonymization/redaction process.

  The end-goal is to build an AI-powered assistant that transforms a static repository of documents into a
  dynamic, searchable, and interactive knowledge base.

  ---

  2. Architecture

  The project follows a modern, decoupled, service-oriented architecture.

   * Overall Structure: It's a classic Single Page Application (SPA) + REST API model. The frontend and
     backend are maintained in a single repository, mimicking a monorepo structure for development
     convenience.
   * Frontend: A React-based SPA responsible for all user interaction and rendering. It is a pure client that
     communicates with the backend via HTTP requests. It has no direct access to the database or other
     infrastructure.
   * Backend: A Python-based application that serves a RESTful API. It handles business logic, user
     authentication, database interactions, and, most importantly, orchestrates the complex AI/ML pipeline.
   * AI/ML Pipeline: This is the core of the project's intelligence. It's designed as a multi-stage,
     asynchronous pipeline that processes uploaded documents. The use of Celery and Redis indicates that these
      tasks are handled as background jobs, preventing the API from blocking during long-running operations
     like OCR, analysis, and vectorization.

  ---

  3. Technology Stack

  Backend
   * Framework: Flask is the core web framework, extended with Flask-RESTX for building structured REST APIs
     and generating API documentation.
   * Database & ORM: Flask-SQLAlchemy is used, implying a relational database (like PostgreSQL or SQLite) for
     storing structured data (users, posts, file metadata).
   * Authentication: Flask-JWT-Extended is used for token-based authentication (JWTs), with bcrypt for
     password hashing.
   * Asynchronous Tasks: Celery with a Redis message broker is implemented for managing the background
     processing of documents. This is critical for performance and scalability.
   * File Processing: unstructured[all-docs] is a powerful library used to ingest and parse various document
     types (PDF, DOCX, etc.) into a clean format. PyMuPDF and python-docx are also available for more direct
     control.

  Frontend
   * Framework: React 18 is the core library for building the user interface.
   * Build Tool: Vite provides a fast and modern development experience and build process.
   * UI Components: The project heavily utilizes shadcn/ui. This is evident from the numerous @radix-ui
     dependencies and the components/ui directory structure. It's a modern approach that combines
     utility-first CSS (Tailwind) with unstyled, accessible components.
   * Styling: Tailwind CSS is used for styling, providing a highly efficient and consistent design system.
   * Routing: React Router v7 (react-router-dom) handles client-side routing.
   * State Management & Forms: A combination of React Context (AuthContext.jsx), local state, and React Hook
     Form (react-hook-form) with Zod for schema validation.
   * API Communication: Axios is used for making HTTP requests to the backend API.

  AI/ML & Data Processing
  This is the most ambitious part of the project. The vision laid out in GEMINI.md describes a sophisticated
  pipeline using a series of specialized transformer models:
   * Document Ingestion: unstructured to parse documents.
   * OCR: A service like Nanonets-OCR is envisioned for converting scanned images to text.
   * Layout Analysis: LayoutLMv3 to understand the structure (tables, forms) of the documents.
   * PII Redaction: A Greek BERT-NER model (likely from the spacy and transformers libraries) to find and
     redact sensitive data.
   * Auto-Tagging: XLM-RoBERTa (Zero-Shot) for classifying documents into categories without prior training on
      those specific labels.
   * Summarization: LED-Summarizer to create concise summaries of long documents.
   * Vectorization: all-MiniLM-L6-v2 (via sentence-transformers) to create vector embeddings from the
     processed text.
   * Vector Storage: ChromaDB is listed as a dependency, which is a specialized vector database for storing
     and searching the embeddings.
   * RAG (Retrieval-Augmented Generation): The core search mechanism. When a user asks a question, the system
     will use embeddings to retrieve relevant document chunks from ChromaDB and feed them into a large
     language model to generate a context-aware answer.
   * Document QA: impira/layoutlm-document-qa is planned for a high-precision Q&A feature, allowing users to
     ask questions directly about the content of a specific document and receive answers with citations.
   * Content Moderation: multilingual-toxic-xlm-roberta is planned to check forum posts for toxic content in
     real-time.

  ---

  4. Η Πορεία του Έργου (Project Status & Roadmap)

  Που Βρίσκεται Τώρα (Current State)
  The project is at a solid foundational stage.
   * The backend and frontend applications are set up and can communicate.
   * User authentication and routing are in place.
   * The UI is well-structured with a professional component library (shadcn/ui), and key pages (ForumPage,
     ApothecaryPage, AssistantPage) have been scaffolded.
   * The backend has the necessary dependencies for the AI pipeline (transformers, celery, chromadb), and the
     asynchronous task infrastructure is set up.
   * Basic features like file uploads (DropZone.jsx) and forum threads (PostThread.jsx) are conceptually
     present.

  Essentially, the "plumbing" and the "skeleton" are complete. The project is a functional web application,
  but the advanced AI features that deliver its core value proposition are not yet fully integrated.

  Που Θέλουμε να το Φτάσουμε (The Vision)
  The goal is to bring the full AI/ML pipeline described above to life. The roadmap is to transition from a
  simple CRUD application to a fully-fledged AI assistant. This involves:

   1. Activate the Pipeline: Fully implement the Celery tasks that trigger the OCR -> Layout Analysis -> PII
      Redaction -> Tagging -> Summarization -> Vectorization sequence upon file upload.
   2. Build the RAG System: Implement the search functionality in the Forum and Assistant pages. This means
      taking a user's query, converting it to a vector, querying ChromaDB for relevant documents, and feeding
      that context to a generative model to produce a high-quality answer.
   3. Implement High-Precision QA: Integrate the layoutlm-document-qa model to allow users to "chat" with
      specific documents.
   4. Refine and Polish: Improve the UI/UX, add real-time features (like notifications via
      NotificationBell.jsx), and ensure the entire system is robust, secure, and performant.

  The final product will be a system where a social worker can upload any case file and have it instantly
  and automatically processed, anonymized, and integrated into a collective, searchable intelligence.
 We will work on that now. 