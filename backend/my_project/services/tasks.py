# tasks.py
from backend.app import celery, document_collection # Εισαγωγή από το app.py
from transformers import pipeline
import time
from unstructured.partition.auto import partition
from sentence_transformers import SentenceTransformer

# Αρχικοποίηση των pipelines (γίνεται μία φορά όταν ξεκινά ο worker)
ocr_pipeline = pipeline("image-to-text", model="nanonets/Nanonets-OCR-s")
ner_pipeline = pipeline("ner", model="amichailidis/bert-base-greek-uncased-v1-finetuned-ner")
tagging_pipeline = pipeline("zero-shot-classification", model="joeddav/xlm-roberta-large-xnli")
summarizer_pipeline = pipeline("summarization", model="allenai/led-large-16384-arxiv")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

@celery.task
def process_document_pipeline(file_path, original_filename, file_id):
    """
    Το κύριο Celery task που εκτελεί ολόκληρο το pipeline.
    """
    print(f"Ξεκινά η επεξεργασία για το αρχείο: {original_filename}")

    # Βήμα 1 & 2: OCR και Ανάλυση Δομής
    try:
        elements = partition(filename=file_path)
        extracted_text = "\n\n".join([str(el) for el in elements])
        print("Βήματα 1 & 2: OCR και Layout Analysis ολοκληρώθηκαν.")
    except Exception as e:
        print(f"Σφάλμα στο unstructured: {e}")
        return {"status": "Failed", "error": "Could not process file layout."}

    # Βήμα 3: PII Redaction (Ανώνυμοποίηση)
    entities = ner_pipeline(extracted_text)
    anonymized_text = extracted_text
    for entity in entities:
        if entity['entity_group'] in ['PER', 'LOC']: # Αν είναι Πρόσωπο ή Τοποθεσία
            anonymized_text = anonymized_text.replace(entity['word'], f"[{entity['entity_group']}]")
    print(f"Βήμα 3: Εντοπίστηκαν {len(entities)} οντότητες. Η ανωνυμοποίηση ολοκληρώθηκε.")

    # Βήμα 4: Αυτόματη Δημιουργία Ετικετών
    candidate_labels = ["Οικογενειακή Βία", "Νομική Συνδρομή", "Ανήλικοι", "Διοικητικά", "Οικονομικά"]
    tagging_result = tagging_pipeline(anonymized_text, candidate_labels, multi_label=True)
    tags = [label for label, score in zip(tagging_result['labels'], tagging_result['scores']) if score > 0.7]
    print(f"Βήμα 4: Οι προτεινόμενες ετικέτες είναι: {tags}")

    # Βήμα 5: Δημιουργία Περίληψης
    # (Προσοχή: Το summarizer μπορεί να θέλει πολύ μνήμη/χρόνο)
    summary = summarizer_pipeline(anonymized_text, max_length=150, min_length=30, do_sample=False)[0]['summary_text']
    print("Βήμα 5: Η περίληψη δημιουργήθηκε.")

    # Βήμα 6: Δημιουργία Embeddings και Αποθήκευση
    embedding = embedding_model.encode(anonymized_text).tolist()
    document_collection.add(
        embeddings=[embedding],
        documents=[anonymized_text],
        metadatas=[{
            "original_filename": original_filename,
            "summary": summary,
            "tags": ",".join(tags), # Αποθήκευση ως string
            "file_id": file_id
        }],
        ids=[str(file_id)] # Χρήση του ID του αρχείου ως μοναδικό ID
    )
    print("Βήμα 6: Το έγγραφο προστέθηκε στη vector database.")

    print(f"Η επεξεργασία για το αρχείο {original_filename} ολοκληρώθηκε.")
    return {"status": "Completed", "file_id": file_id, "summary": summary, "tags": tags}