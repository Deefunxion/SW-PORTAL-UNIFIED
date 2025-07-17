# Resources for Building a Dynamic RAG System in SW Portal

Below is a curated list of tools, libraries, tutorials, and architectural patterns to build a dynamic, self-updating Retrieval-Augmented Generation (RAG) system within the SW Portal, a web application with a Flask backend and React frontend. The system supports continuous learning from new documents and discussions for the AI Assistant, Apothecary, and Forum features.

## 1. Continuous Data Ingestion & Processing

### Resource Type: Tutorial
- **Resource Name**: How to Process PDFs in Python: A Step-by-Step Guide – Unstructured
- **Link**: [https://unstructured.io/blog/how-to-process-pdf-in-python](https://unstructured.io/blog/how-to-process-pdf-in-python)
- **Key Insight**: Guides parsing PDFs and DOCX files with unstructured.io, essential for Apothecary’s document processing.

**Details**: The tutorial demonstrates using the `unstructured` library to extract structured data from PDFs and DOCX files. Example code:
```python
from unstructured.partition.pdf import partition_pdf
elements = partition_pdf("example-docs/layout-parser-paper-fast.pdf")
```
It supports multiple document types and integrates with Flask for file upload processing. For background tasks, it suggests Celery, which can be triggered on file uploads via Flask routes.

### Resource Type: Documentation
- **Resource Name**: Background Tasks with Celery — Flask Documentation (3.1.x)
- **Link**: [https://flask.palletsprojects.com/en/stable/patterns/celery/](https://flask.palletsprojects.com/en/stable/patterns/celery/)
- **Key Insight**: Explains integrating Celery with Flask for background file processing, ensuring responsiveness.

**Details**: The Flask documentation outlines setting up Celery for tasks like file uploads. Example configuration:
```python
from celery import Celery
def celery_init_app(app):
    celery = Celery(app.name, backend=app.config['result_backend'], broker=app.config['broker_url'])
    celery.conf.update(app.config)
    return celery
```
It includes triggering tasks on file uploads via Flask routes, e.g., `task.delay(file_path)`.

### Resource Type: Tutorial
- **Resource Name**: Best Practices for Text Chunking in RAG
- **Link**: [https://docs.unstructured.io/best_practices/strategies.html](https://docs.unstructured.io/best_practices/strategies.html)
- **Key Insight**: Provides strategies for text chunking, optimizing RAG performance.

**Details**: Discusses chunking strategies (e.g., fixed-size, semantic) for RAG systems. Example with unstructured.io:
```python
from unstructured.chunking import add_chunking_strategy
@add_chunking_strategy
def partition_with_chunking(file_path):
    return partition_pdf(file_path, strategy="hi_res")
```
This ensures documents are split into manageable pieces for vector storage.

## 2. Vector Database Integration with Flask

### Resource Type: GitHub Repository
- **Resource Name**: Chatbot AI Assistant with OpenAI and ChromaDB
- **Link**: [https://github.com/joaocba/openai_chatbot_context_chromadb](https://github.com/joaocba/openai_chatbot_context_chromadb)
- **Key Insight**: Demonstrates ChromaDB integration with Flask for a chatbot, relevant for the AI Assistant.

**Details**: The repository uses ChromaDB for vector storage in a Flask app. Setup:
```python
import chromadb
client = chromadb.Client()
collection = client.create_collection("documents")
```
It shows adding embeddings and querying via Flask routes. Incremental updates are managed by appending new embeddings without rebuilding the index.

### Resource Type: Tutorial
- **Resource Name**: Stress Testing Vector Databases: Dockerizing a Flask App with ChromaDB
- **Link**: [https://dev.to/codermehraj/stress-testing-vector-databases-dockerizing-a-flask-app-with-chroma-db-pgvector-and-weaviate-running-locally-part-1-34m5](https://dev.to/codermehraj/stress-testing-vector-databases-dockerizing-a-flask-app-with-chroma-db-pgvector-and-weaviate-running-locally-part-1-34m5)
- **Key Insight**: Guides Dockerized Flask app with ChromaDB, focusing on scalability.

**Details**: Explains Flask-ChromaDB integration with Docker, ensuring no downtime during index updates. Example route:
```python
@app.route('/add_document', methods=['POST'])
def add_document():
    file = request.files['file']
    embeddings = generate_embeddings(file)
    collection.add(embeddings=embeddings, ids=[str(uuid.uuid4())])
    return jsonify({"status": "success"})
```

## 3. RAG Orchestration Frameworks

### Resource Type: Tutorial
- **Resource Name**: Building a Retrieval-Augmented Generation (RAG) Chatbot with LangChain and Flask in Python
- **Link**: [https://medium.com/@datalev/building-a-retrieval-augmented-generation-rag-chatbot-with-langchain-and-flask-in-python-fee3d49b5566](https://medium.com/@datalev/building-a-retrieval-augmented-generation-rag-chatbot-with-langchain-and-flask-in-python-fee3d49b5566)
- **Key Insight**: Shows building a RAG chatbot with LangChain and Flask, directly applicable to the AI Assistant.

**Details**: Covers setting up a RAG pipeline with LangChain, ChromaDB, and OpenAI. Example:
```python
from langchain.chains import RetrievalQA
from langchain.llms import OpenAI
qa = RetrievalQA.from_chain_type(llm=OpenAI(), chain_type="stuff", retriever=collection.as_retriever())
@app.route('/query', methods=['POST'])
def query():
    question = request.json['question']
    response = qa.run(question)
    return jsonify({"answer": response})
```
It handles query retrieval and response generation within Flask.

### Resource Type: Tutorial
- **Resource Name**: Build an LLM RAG Chatbot With LangChain – Real Python
- **Link**: [https://realpython.com/build-llm-rag-chatbot-with-langchain/](https://realpython.com/build-llm-rag-chatbot-with-langchain/)
- **Key Insight**: Provides a comprehensive RAG implementation with LangChain, adaptable to Flask.

**Details**: Uses LangChain with Neo4j but can be adapted for ChromaDB in Flask. Example chain:
```python
from langchain.chains import RetrievalQA
qa = RetrievalQA.from_chain_type(llm=ChatOpenAI(model="gpt-3.5-turbo"), retriever=vector_index.as_retriever(k=12))
```

## 4. Frontend: Streaming & Source Citing

### Resource Type: Article
- **Resource Name**: Server-sent events using Python (Flask) and React (JS)
- **Link**: [https://medium.com/@tahsinkheya/server-sent-events-using-python-flask-and-react-js-e564e03b03e9](https://medium.com/@tahsinkheya/server-sent-events-using-python-flask-and-react-js-e564e03b03e9)
- **Key Insight**: Explains streaming responses from Flask to React using SSE, ideal for real-time AI Assistant responses.

**Details**: Uses Flask-SSE and Redis for streaming. Backend example:
```python
from flask_sse import sse
@app.route('/events')
def stream():
    def generate():
        for message in redis_channel.listen():
            yield f"data: {message['data']}\n\n"
    return Response(generate(), mimetype="text/event-stream")
```
Frontend React code:
```jsx
useEffect(() => {
  const source = new EventSource('http://127.0.0.1:5000/events');
  source.onmessage = (event) => setMessages((prev) => [...prev, event.data]);
}, []);
```

### Resource Type: Article
- **Resource Name**: AI UX Patterns | Citations | ShapeofAI.com
- **Link**: [https://www.shapeof.ai/patterns/citations](https://www.shapeof.ai/patterns/citations)
- **Key Insight**: Discusses UI/UX patterns for citing sources, enhancing RAG chatbot transparency.

**Details**: Suggests inline citations (e.g., hyperlinks to document sections) and footnote-style lists, inspired by Adobe PDF and Perplexity. Example React component:
```jsx
function ChatResponse({ response, sources }) {
  return (
    <div>
      <p>{response}</p>
      <ul>
        {sources.map((source, index) => (
          <li key={index}>
            <a href={source.url}>{source.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Summary Table

| **Category**                     | **Resource Name**                              | **Link**                                                                 | **Use Case**                                                                 |
|----------------------------------|-----------------------------------------------|--------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Data Ingestion                   | How to Process PDFs in Python                  | [https://unstructured.io/blog/how-to-process-pdf-in-python](https://unstructured.io/blog/how-to-process-pdf-in-python) | Parse PDFs/DOCX for Apothecary                                               |
| Background Tasks                 | Background Tasks with Celery                   | [https://flask.palletsprojects.com/en/stable/patterns/celery/](https://flask.palletsprojects.com/en/stable/patterns/celery/) | Process uploads in background                                                |
| Text Chunking                    | Best Practices for Text Chunking               | [https://docs.unstructured.io/best_practices/strategies.html](https://docs.unstructured.io/best_practices/strategies.html) | Optimize document splitting for RAG                                          |
| Vector Database                  | Chatbot AI Assistant with ChromaDB             | [https://github.com/joaocba/openai_chatbot_context_chromadb](https://github.com/joaocba/openai_chatbot_context_chromadb) | Store embeddings for AI Assistant                                             |
| Vector Database                  | Stress Testing Vector Databases                | [https://dev.to/codermehraj/stress-testing-vector-databases-dockerizing-a-flask-app-with-chroma-db-pgvector-and-weaviate-running-locally-part-1-34m5](https://dev.to/codermehraj/stress-testing-vector-databases-dockerizing-a-flask-app-with-chroma-db-pgvector-and-weaviate-running-locally-part-1-34m5) | Scalable ChromaDB integration                                                |
| RAG Orchestration                | RAG Chatbot with LangChain and Flask           | [https://medium.com/@datalev/building-a-retrieval-augmented-generation-rag-chatbot-with-langchain-and-flask-in-python-fee3d49b5566](https://medium.com/@datalev/building-a-retrieval-augmented-generation-rag-chatbot-with-langchain-and-flask-in-python-fee3d49b5566) | Build RAG pipeline for AI Assistant                                          |
| RAG Orchestration                | Build an LLM RAG Chatbot With LangChain        | [https://realpython.com/build-llm-rag-chatbot-with-langchain/](https://realpython.com/build-llm-rag-chatbot-with-langchain/) | Adaptable RAG implementation                                                 |
| Streaming Responses               | Server-sent events using Python and React      | [https://medium.com/@tahsinkheya/server-sent-events-using-python-flask-and-react-js-e564e03b03e9](https://medium.com/@tahsinkheya/server-sent-events-using-python-flask-and-react-js-e564e03b03e9) | Stream AI responses to React frontend                                         |
| Source Citing                    | AI UX Patterns | Citations                     | [https://www.shapeof.ai/patterns/citations](https://www.shapeof.ai/patterns/citations) | Display sources in RAG chatbot                                                |

## Implementation Notes
- **unstructured.io**: Install with `pip install "unstructured[all-docs]"` for PDF/DOCX support. Use `strategy="hi_res"` for complex layouts.
- **Celery**: Requires a message broker (e.g., Redis). Configure in Flask app factory for scalability.
- **ChromaDB**: Use in-memory or persistent mode. Update indexes incrementally to avoid downtime.
- **LangChain**: Integrates with ChromaDB and OpenAI for RAG. Use `RetrievalQA` for simplicity.
- **SSE**: Flask-SSE simplifies streaming. React’s `EventSource` handles real-time updates.
- **Citations**: Combine inline links and a source list for transparency, styled with Tailwind CSS in React.

## Example Integration
Below is a sample Flask route for processing uploads and querying the RAG system:
```python
from flask import Flask, request, Response
from unstructured.partition.auto import partition
from langchain.chains import RetrievalQA
import chromadb

app = Flask(__name__)
client = chromadb.Client()
collection = client.create_collection("documents")

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    elements = partition(file)
    embeddings = generate_embeddings(elements)  # Custom function
    collection.add(embeddings=embeddings, ids=[str(uuid.uuid4())])
    return jsonify({"status": "success"})

@app.route('/query', methods=['POST'])
def query():
    question = request.json['question']
    qa = RetrievalQA.from_chain_type(llm=OpenAI(), retriever=collection.as_retriever())
    response = qa.run(question)
    return Response(response, mimetype="text/event-stream")
```

This setup ensures a dynamic, self-updating RAG system that learns from new documents and discussions, integrated seamlessly into the SW Portal.