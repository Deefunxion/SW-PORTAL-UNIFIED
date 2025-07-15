You are a code developer with 20 years of experience in debugging and simplifying complex code projects, tasked with working on the SW Portal project located at:
C:\Users\dee\Desktop\SW-PORTAL-UNIFIED-main

Υπάρχει προβλημα  με το /api/files/structure και το 401 ή Network Error, και να πώς θα το διορθώσουμε, βήμα-βήμα:

1. Επιβεβαίωση Flask route & JWT handling για /api/files/structure
Στο app.py υπάρχει η διαδρομή:

python
Αντιγραφή
@app.route('/api/files/structure', methods=['GET'])
@jwt_required()
def get_file_structure():
    user_info = get_current_user_info()
    categories = scan_content_directory(user_info, acl_manager)
    return jsonify({
        'categories': categories,
        'metadata': {
            'total_categories': len(categories),
            'total_files': sum(len(cat['files']) for cat in categories),
            'last_updated': datetime.now().isoformat(),
            'version': '2.0'
        }
    })
Άρα η route υπάρχει και είναι προστατευμένη με @jwt_required(), που σημαίνει πως χρειάζεται έγκυρο JWT token στο header.

2. Το UPLOAD_FOLDER
Στο app.py:

python
Αντιγραφή
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'content')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
Άρα, το folder των αρχείων είναι ένα επίπεδο πάνω από το backend, στον φάκελο content/.

Αυτό συμφωνεί με όσα ανέφερες ότι υπάρχει φάκελος content/ με αρχεία.

Το scan_content_directory χρησιμοποιεί το app.config['UPLOAD_FOLDER'].

3. Frontend axios requests & .env
3.1. Στο api.js:
js
Αντιγραφή
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});

// auto-attach JWT
api.interceptors.request.use(config => {
  const token = Cookies.get('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
Το baseURL βασίζεται στην import.meta.env.VITE_API_URL η οποία φαίνεται να δεν υπάρχει (δεν ανέβηκε frontend .env) και fallback στο 'http://localhost:5000' — άρα η βάση είναι σωστή.

Ωστόσο, το Axios δεν χρησιμοποιείται στο ApothecaryPage.jsx!

Στο ApothecaryPage.jsx, η λήψη των αρχείων γίνεται με απλό fetch('http://localhost:5000/api/files/structure'), χωρίς να στέλνει JWT στο header.

3.2. Πώς γίνεται το login;
Στο backend /api/auth/login επιστρέφεται το access_token.

Στο frontend δεν έχουμε δείξει τον κώδικα αποθήκευσης του token στα cookies, αλλά στο api.js φαίνεται να το παίρνει από Cookies.get('token').

Άρα λογικά, μετά login, ο χρήστης πρέπει να έχει JWT αποθηκευμένο στα cookies ως token.

4. Το πρόβλημα είναι ότι το fetch στον ApothecaryPage.jsx ΔΕΝ στέλνει κανένα header για Authorization
fetch στο ApothecaryPage.jsx δεν στέλνει header με το JWT.

Αυτό προκαλεί 401 Unauthorized ή Network Error λόγω CORS ή ελλιπούς authorization.

5. Προτάσεις διόρθωσης
5.1. Στον ApothecaryPage.jsx:
Αντί για απλό fetch, χρησιμοποίησε το ήδη υπάρχον api.js που έχει ρυθμισμένο το axios με αυτόματη προσάρτηση JWT από cookie.

Παράδειγμα αλλαγής:

js
Αντιγραφή
import api from '@/lib/api.js'; // ή το σωστό path για το api.js

// ...

const fetchFiles = useCallback(async () => {
  try {
    setIsLoading(true);
    const response = await api.get('/api/files/structure');
    setFiles(response.data.categories || []);
  } catch (error) {
    console.error('Error fetching files:', error);
    setFiles([]);
  } finally {
    setIsLoading(false);
  }
}, []);
Αυτό εξασφαλίζει:

Ο σωστός baseURL θα χρησιμοποιηθεί

Το JWT token θα προστεθεί αυτόματα στο header Authorization

5.2. Εναλλακτικά, αν θες να χρησιμοποιήσεις fetch, πρέπει να προσθέσεις χειροκίνητα το JWT token από cookie:
js
Αντιγραφή
const fetchFiles = useCallback(async () => {
  try {
    setIsLoading(true);
    const token = getCookie('token'); // υλοποίησε getCookie ή χρησιμοποίησε js-cookie

    const response = await fetch('http://localhost:5000/api/files/structure', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    setFiles(data.categories || []);
  } catch (error) {
    console.error('Error fetching files:', error);
    setFiles([]);
  } finally {
    setIsLoading(false);
  }
}, []);
6. Extra έλεγχος: CORS
Στο backend app.py το CORS(app, origins="*") επιτρέπει όλα τα origins.

Άρα δεν πρέπει να υπάρχει CORS block.

Το σφάλμα AxiosError: Network Error μπορεί να προκύψει αν το request απορρίπτεται λόγω έλλειψης JWT ή λάθος configuration.

7. Βήματα που προτείνω να κάνεις άμεσα
Στο frontend ApothecaryPage.jsx, άλλαξε το fetch να χρησιμοποιεί api.get από το api.js.
Με αυτό το τρόπο, το JWT από το cookie θα προστεθεί αυτόματα.

Βεβαιώσου ότι μετά login αποθηκεύεις το JWT στο cookie token.
Αν δεν γίνεται, κάνε το με js-cookie:

js
Αντιγραφή
import Cookies from 'js-cookie';
// ... στο login handler
Cookies.set('token', access_token, { expires: 1 /*day*/, secure: false });
Δοκίμασε ξανά το /api/files/structure μέσω του frontend μετά login.
Πρέπει τώρα να περάσει το JWT και να σου επιστρέψει σωστά τη δομή.

Προαιρετικά: Μπορείς να κάνεις log του request header στο backend για debugging:

python
Αντιγραφή
@app.before_request
def log_request_headers():
    print(f"Request headers: {request.headers}")
8. Περίληψη
Θέμα	Τρέχουσα κατάσταση	Πρόταση διόρθωσης
Flask route /api/files/structure	Υπάρχει και προστατεύεται με @jwt_required()	ΟΚ
UPLOAD_FOLDER	Σωστά ορισμένο σε ../content	ΟΚ
Frontend fetch	Δεν στέλνει JWT header	Χρησιμοποίηση api.js με axios και JWT cookie
Axios api.js	Σωστά ρυθμισμένο με baseURL και interceptor	Χρήση του api.js από frontend
Login αποθήκευση token	Πιθανώς να λείπει	Αποθήκευση JWT token σε cookie με js-cookie

