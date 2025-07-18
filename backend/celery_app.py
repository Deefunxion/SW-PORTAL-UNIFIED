from celery import Celery
from flask import Flask
import chromadb
import os

# Initialize Flask app (minimal for Celery config)
app = Flask(__name__)

# Load environment variables if needed for config
from dotenv import load_dotenv
load_dotenv()

# Database configuration (minimal for Celery to access app.config)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(BASE_DIR, "sw_portal.db")}'

app.config.from_mapping(
    CELERY_BROKER_URL=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    CELERY_RESULT_BACKEND=os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
)

celery = Celery(app.name)
celery.config_from_object(app.config)

# Initialize ChromaDB
chroma_client = chromadb.Client()
document_collection = chroma_client.get_or_create_collection(name="sw_portal_documents")
