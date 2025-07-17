import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { 
  showSuccessToast, 
  showErrorToast, 
  showWarningToast, 
  showInfoToast, 
  showLoadingToast,
  showActionToast,
  dismissAllToasts 
} from '@/lib/toast';

/**
 * Demo component to showcase toast notification functionality
 * This can be temporarily added to any page for testing
 */
function ToastDemo() {
  const handlePromiseToast = () => {
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        Math.random() > 0.5 ? resolve('Success!') : reject('Failed!');
      }, 2000);
    });

    showPromiseToast(promise, {
      loading: 'Επεξεργασία...',
      success: 'Η λειτουργία ολοκληρώθηκε επιτυχώς!',
      error: 'Η λειτουργία απέτυχε!'
    });
  };

  const handleActionToast = () => {
    showActionToast(
      'Θέλετε να διαγράψετε αυτό το αρχείο;',
      'Αναίρεση',
      () => showInfoToast('Η ενέργεια ακυρώθηκε')
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>🎯 Toast Notifications Demo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Button 
            onClick={() => showSuccessToast('Επιτυχής λειτουργία!')}
            className="bg-green-600 hover:bg-green-700"
          >
            ✅ Success
          </Button>
          
          <Button 
            onClick={() => showErrorToast('Σφάλμα στη λειτουργία!')}
            variant="destructive"
          >
            ❌ Error
          </Button>
          
          <Button 
            onClick={() => showWarningToast('Προσοχή! Ελέγξτε τα δεδομένα.')}
            className="bg-orange-600 hover:bg-orange-700"
          >
            ⚠️ Warning
          </Button>
          
          <Button 
            onClick={() => showInfoToast('Πληροφοριακό μήνυμα')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            ℹ️ Info
          </Button>
          
          <Button 
            onClick={() => showLoadingToast('Φόρτωση δεδομένων...')}
            className="bg-gray-600 hover:bg-gray-700"
          >
            ⏳ Loading
          </Button>
          
          <Button 
            onClick={handlePromiseToast}
            className="bg-purple-600 hover:bg-purple-700"
          >
            🔄 Promise
          </Button>
          
          <Button 
            onClick={handleActionToast}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            🎬 Action
          </Button>
          
          <Button 
            onClick={dismissAllToasts}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            🗑️ Clear All
          </Button>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Usage Examples:</h3>
          <code className="text-sm text-gray-700">
            showSuccessToast('File uploaded successfully!');<br/>
            showErrorToast('Failed to save changes');<br/>
            showInfoToast('Feature not implemented yet');
          </code>
        </div>
      </CardContent>
    </Card>
  );
}

export default ToastDemo;
