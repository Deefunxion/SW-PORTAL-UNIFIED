"""
Celery Tasks for ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ
Contains all background tasks for document processing and other async operations
"""

from my_project.extensions import celery
import time
from datetime import datetime

@celery.task
def process_document_pipeline(file_path, original_filename, file_id):
    """
    Process documents through OCR, NLP and other ML pipelines
    """
    print(f"Starting document processing for: {original_filename}")
    
    try:
        # Simulate document processing
        # In a real implementation, this would include:
        # - OCR extraction
        # - NLP analysis
        # - Content indexing
        # - Metadata extraction
        
        time.sleep(2)  # Simulate processing time
        
        print(f"Document processing completed for: {original_filename}")
        
        return {
            'status': 'completed',
            'file_id': file_id,
            'processed_at': datetime.now().isoformat(),
            'message': f'Successfully processed {original_filename}'
        }
        
    except Exception as e:
        print(f"Error processing document {original_filename}: {str(e)}")
        return {
            'status': 'failed',
            'file_id': file_id,
            'error': str(e),
            'message': f'Failed to process {original_filename}'
        }

@celery.task
def send_notification_email(user_email, subject, content):
    """
    Send notification email to user
    """
    print(f"Sending notification email to {user_email}: {subject}")
    
    try:
        # Simulate email sending
        time.sleep(1)
        
        print(f"Email sent successfully to {user_email}")
        
        return {
            'status': 'sent',
            'recipient': user_email,
            'subject': subject,
            'sent_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Failed to send email to {user_email}: {str(e)}")
        return {
            'status': 'failed',
            'recipient': user_email,
            'error': str(e)
        }

@celery.task
def cleanup_temporary_files():
    """
    Clean up temporary files older than 24 hours
    """
    print("Starting cleanup of temporary files...")
    
    try:
        # Simulate cleanup process
        time.sleep(1)
        
        cleaned_count = 5  # Simulate number of files cleaned
        
        print(f"Cleanup completed. Removed {cleaned_count} temporary files.")
        
        return {
            'status': 'completed',
            'files_removed': cleaned_count,
            'cleaned_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Error during cleanup: {str(e)}")
        return {
            'status': 'failed',
            'error': str(e)
        }