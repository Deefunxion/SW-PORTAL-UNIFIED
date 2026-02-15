export const STRUCTURE_STATUS = {
  active: { label: 'Ενεργή', color: 'green' },
  suspended: { label: 'Αναστολή', color: 'orange' },
  revoked: { label: 'Ανάκληση', color: 'red' },
  closed: { label: 'Κλειστή', color: 'gray' },
};

export const OWNERSHIP_TYPES = {
  public: 'Δημόσια',
  private_profit: 'Ιδιωτική κερδοσκοπική',
  private_nonprofit: 'Ιδιωτική μη κερδοσκοπική',
  npdd: 'ΝΠΔΔ',
  npid: 'ΝΠΙΔ',
};

export const INSPECTION_TYPES = {
  regular: 'Τακτικός',
  extraordinary: 'Έκτακτος',
  reinspection: 'Επανέλεγχος',
};

export const INSPECTION_STATUS = {
  scheduled: { label: 'Προγραμματισμένος', color: 'blue' },
  completed: { label: 'Ολοκληρωμένος', color: 'green' },
  cancelled: { label: 'Ακυρωμένος', color: 'gray' },
};

export const INSPECTION_CONCLUSIONS = {
  normal: { label: 'Κανονική λειτουργία', color: 'green' },
  observations: { label: 'Παρατηρήσεις', color: 'orange' },
  serious_violations: { label: 'Σοβαρές παραβάσεις', color: 'red' },
};

export const REPORT_STATUS = {
  draft: { label: 'Πρόχειρο', color: 'gray' },
  submitted: { label: 'Υποβληθέν', color: 'blue' },
  approved: { label: 'Εγκεκριμένο', color: 'green' },
  returned: { label: 'Επιστράφηκε', color: 'orange' },
};

export const LICENSE_STATUS = {
  active: { label: 'Ενεργή', color: 'green' },
  expiring: { label: 'Λήγουσα', color: 'orange' },
  expired: { label: 'Ληγμένη', color: 'red' },
  revoked: { label: 'Ανακληθείσα', color: 'red' },
};

export const SANCTION_TYPES = {
  fine: 'Πρόστιμο',
  suspension: 'Αναστολή λειτουργίας',
  revocation: 'Ανάκληση άδειας',
  warning: 'Σύσταση',
};

export const SANCTION_STATUS = {
  imposed: { label: 'Επιβληθείσα', color: 'red' },
  paid: { label: 'Εξοφληθείσα', color: 'green' },
  appealed: { label: 'Σε ένσταση', color: 'orange' },
  cancelled: { label: 'Ακυρωθείσα', color: 'gray' },
};

export const VIOLATION_CATEGORIES = {
  safety: { label: 'Ασφάλεια', icon: 'Shield' },
  hygiene: { label: 'Υγιεινή', icon: 'Droplets' },
  admin: { label: 'Διοικητικά', icon: 'FileText' },
  staff: { label: 'Προσωπικό', icon: 'Users' },
  general: { label: 'Γενικά', icon: 'AlertTriangle' },
};

export const SANCTION_DECISION_STATUSES = {
  draft: { label: 'Προσχέδιο', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  submitted: { label: 'Υποβληθείσα', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Εγκεκριμένη', className: 'bg-green-50 text-green-700 border-green-200' },
  returned: { label: 'Επιστράφηκε', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  exported: { label: 'Εξαγόμενη', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  notified: { label: 'Κοινοποιηθείσα', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Εξοφληθείσα', className: 'bg-green-50 text-green-700 border-green-200' },
  appealed: { label: 'Σε ένσταση', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  overdue: { label: 'Εκπρόθεσμη', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Ακυρωθείσα', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

export const USER_ROLES = {
  social_advisor: 'Κοινωνικός Σύμβουλος',
  committee_member: 'Μέλος Επιτροπής Ελέγχου',
  administrative: 'Διοικητικός / Γραμματεία',
  director: 'Προϊστάμενος / Διευθυντής',
};

export const COMMITTEE_ROLES = {
  president: 'Πρόεδρος',
  member: 'Μέλος',
  secretary: 'Γραμματέας',
};

export const ADVISOR_REPORT_TYPES = {
  regular: 'Τακτική αξιολόγηση',
  extraordinary: 'Έκτακτη αξιολόγηση',
  incident: 'Αναφορά συμβάντος',
};

// Structured inspection criteria per structure type code
// Each criterion: { id, label, category, legal_ref?, is_required? }
// Ratings: 'pass' | 'partial' | 'fail' | null (not evaluated)
// Source: Ministerial Decision templates in content/ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ/
export const INSPECTION_CRITERIA = {
  MFH: {
    label: 'Μονάδα Φροντίδας Ηλικιωμένων',
    categories: ['Στελέχωση', 'Υγιεινή & Ασφάλεια', 'Φροντίδα', 'Υποδομές'],
    criteria: [
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / ωφελούμενων', category: 'Στελέχωση', legal_ref: 'ΥΑ Π1γ/οικ.81551 Άρθρο 4', is_required: true },
      { id: 'staff_qualifications', label: 'Τίτλοι σπουδών / πιστοποιήσεις', category: 'Στελέχωση', is_required: true },
      { id: 'nurse_presence', label: 'Παρουσία νοσηλευτή ανά βάρδια', category: 'Στελέχωση', is_required: true },
      { id: 'hygiene_common', label: 'Καθαριότητα κοινόχρηστων χώρων', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'hygiene_rooms', label: 'Καθαριότητα δωματίων', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'fire_safety', label: 'Πυροπροστασία / Πυροσβεστήρες', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'emergency_plan', label: 'Σχέδιο εκκένωσης', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'meal_quality', label: 'Ποιότητα σίτισης', category: 'Φροντίδα', is_required: true },
      { id: 'medical_equipment', label: 'Ιατρικός εξοπλισμός', category: 'Φροντίδα', is_required: true },
      { id: 'care_plans', label: 'Ατομικά πλάνα φροντίδας', category: 'Φροντίδα', is_required: true },
      { id: 'accessibility', label: 'Προσβασιμότητα ΑμεΑ', category: 'Υποδομές', is_required: true },
      { id: 'capacity_compliance', label: 'Τήρηση δυναμικότητας', category: 'Υποδομές', is_required: true },
    ],
  },
  KDAP: {
    label: 'Κέντρο Δημιουργικής Απασχόλησης Παιδιών',
    categories: ['Στελέχωση', 'Ασφάλεια', 'Πρόγραμμα', 'Υποδομές'],
    criteria: [
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / παιδιών', category: 'Στελέχωση', is_required: true },
      { id: 'staff_qualifications', label: 'Τίτλοι σπουδών παιδαγωγών', category: 'Στελέχωση', is_required: true },
      { id: 'playground_safety', label: 'Ασφάλεια αύλειων χώρων', category: 'Ασφάλεια', is_required: true },
      { id: 'first_aid', label: 'Κουτί πρώτων βοηθειών', category: 'Ασφάλεια', is_required: true },
      { id: 'fire_safety', label: 'Πυροπροστασία', category: 'Ασφάλεια', is_required: true },
      { id: 'curriculum', label: 'Εκπαιδευτικό πρόγραμμα', category: 'Πρόγραμμα', is_required: true },
      { id: 'activities', label: 'Δημιουργικές δραστηριότητες', category: 'Πρόγραμμα' },
      { id: 'facility_condition', label: 'Κατάσταση εγκαταστάσεων', category: 'Υποδομές', is_required: true },
      { id: 'capacity_compliance', label: 'Τήρηση δυναμικότητας', category: 'Υποδομές', is_required: true },
    ],
  },
  SYD: {
    label: 'Στέγη Υποστηριζόμενης Διαβίωσης',
    categories: ['Δομικά & Υποδομές', 'Ασφάλεια & Υγιεινή', 'Υποστήριξη Φιλοξενούμενων', 'Γενικά & Διοικητικά'],
    criteria: [
      // Δομικά Χαρακτηριστικά & Υποδομές (from Έντυπο Ελέγχου ΣΥΔ)
      { id: 'building_condition', label: 'Κατάσταση κτιρίου (τοίχοι, οροφή, δάπεδο)', category: 'Δομικά & Υποδομές', is_required: true },
      { id: 'windows_doors', label: 'Κατάσταση και λειτουργία παραθύρων και θυρών', category: 'Δομικά & Υποδομές', is_required: true },
      { id: 'fire_safety', label: 'Προστασία από πυρκαγιές (ανίχνευση, πυροσβεστήρες)', category: 'Δομικά & Υποδομές', is_required: true },
      { id: 'accessibility', label: 'Συμβατότητα με κανονισμούς προσβασιμότητας', category: 'Δομικά & Υποδομές', is_required: true },
      { id: 'plumbing_sewage', label: 'Υγιεινές συνθήκες χώρων (αποχέτευση, υδραυλικά)', category: 'Δομικά & Υποδομές', is_required: true },
      // Ασφάλεια & Υγειονομική Προστασία
      { id: 'emergency_exits', label: 'Παρουσία εξόδων κινδύνου και σήμανση', category: 'Ασφάλεια & Υγιεινή', is_required: true },
      { id: 'hygiene_common', label: 'Υγιεινές συνθήκες στα κοινόχρηστα δωμάτια', category: 'Ασφάλεια & Υγιεινή', is_required: true },
      { id: 'first_aid', label: 'Κατάσταση εξοπλισμού πρώτων βοηθειών', category: 'Ασφάλεια & Υγιεινή', is_required: true },
      { id: 'lighting_ventilation', label: 'Επαρκής φωτισμός και αερισμός', category: 'Ασφάλεια & Υγιεινή', is_required: true },
      { id: 'kitchen_condition', label: 'Κατάσταση εγκαταστάσεων κουζίνας', category: 'Ασφάλεια & Υγιεινή', is_required: true },
      // Υποστήριξη & Διαχείριση Φιλοξενούμενων
      { id: 'staff_trained', label: 'Διαθεσιμότητα κατάλληλα εκπαιδευμένου προσωπικού', category: 'Υποστήριξη Φιλοξενούμενων', is_required: true },
      { id: 'individualized_services', label: 'Παροχή εξατομικευμένων υπηρεσιών και υποστήριξης', category: 'Υποστήριξη Φιλοξενούμενων', is_required: true },
      { id: 'operation_rules', label: 'Καθορισμός κανόνων και πολιτικών λειτουργίας', category: 'Υποστήριξη Φιλοξενούμενων', is_required: true },
      { id: 'psychosocial_assessment', label: 'Αξιολόγηση ψυχοκοινωνικής κατάστασης φιλοξενούμενων', category: 'Υποστήριξη Φιλοξενούμενων', is_required: true },
      { id: 'complaint_management', label: 'Διαχείριση καταγγελιών και προβλημάτων', category: 'Υποστήριξη Φιλοξενούμενων', is_required: true },
      // Γενικά Θέματα
      { id: 'documentation', label: 'Αρχεία και έγγραφα διαδικασιών λειτουργίας', category: 'Γενικά & Διοικητικά', is_required: true },
      { id: 'regulatory_compliance', label: 'Συμμόρφωση με ισχύοντες κανονισμούς', category: 'Γενικά & Διοικητικά', is_required: true },
      { id: 'training_programs', label: 'Συμμετοχή σε εκπαιδευτικά προγράμματα', category: 'Γενικά & Διοικητικά' },
      { id: 'equipment_maintenance', label: 'Έλεγχος συντήρησης και αποθήκευσης εξοπλισμού', category: 'Γενικά & Διοικητικά' },
    ],
  },
  'KDHF-KAA': {
    label: 'Κέντρο Διημέρευσης / Αποκατάστασης',
    categories: ['Στελέχωση', 'Υπηρεσίες', 'Υποδομές'],
    criteria: [
      { id: 'staff_qualifications', label: 'Ειδικότητες θεραπευτών', category: 'Στελέχωση', is_required: true },
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / ωφελούμενων', category: 'Στελέχωση', is_required: true },
      { id: 'therapy_programs', label: 'Θεραπευτικά προγράμματα', category: 'Υπηρεσίες', is_required: true },
      { id: 'individual_plans', label: 'Εξατομικευμένα πλάνα αποκατάστασης', category: 'Υπηρεσίες', is_required: true },
      { id: 'equipment', label: 'Εξοπλισμός αποκατάστασης', category: 'Υποδομές', is_required: true },
      { id: 'accessibility', label: 'Προσβασιμότητα ΑμεΑ', category: 'Υποδομές', is_required: true },
    ],
  },
  MFPAD: {
    label: 'Μονάδα Φροντίδας Προσχολικής Αγωγής & Διαπαιδαγώγησης',
    categories: ['Στελέχωση', 'Υγιεινή & Ασφάλεια', 'Πρόγραμμα & Φροντίδα', 'Διοικητικά'],
    criteria: [
      // Source: ΜΦΠΑΔ.docx — Έκθεση Αυτοψίας
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / νηπίων-βρεφών', category: 'Στελέχωση', is_required: true },
      { id: 'staff_qualifications', label: 'Ειδικότητες (νηπιαγωγοί, βρεφονηπιοκόμοι)', category: 'Στελέχωση', is_required: true },
      { id: 'staff_health_certs', label: 'Θεωρημένα πιστοποιητικά υγείας προσωπικού', category: 'Στελέχωση', is_required: true },
      { id: 'staff_municipal_approval', label: 'Έγκριση προσωπικού από Δήμο', category: 'Στελέχωση', is_required: true },
      { id: 'facility_condition', label: 'Περιγραφή χώρων και συνθηκών διαβίωσης', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'hygiene_safety', label: 'Συνθήκες καθαριότητας, υγιεινής και ασφαλούς παραμονής', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'fire_safety', label: 'Πιστοποιητικό πυρασφάλειας', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'facility_changes', label: 'Αλλαγές/παρεμβάσεις χώρων μετά την αδειοδότηση', category: 'Υγιεινή & Ασφάλεια' },
      { id: 'capacity_compliance', label: 'Τήρηση δυναμικότητας (φιλοξενούμενα νήπια/βρέφη)', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'diet_posted', label: 'Αναρτημένο διαιτολόγιο / Παροχή φαγητού', category: 'Υγιεινή & Ασφάλεια', is_required: true },
      { id: 'pedagogical_program', label: 'Παιδαγωγικό πρόγραμμα (ψυχοσυναισθηματική ανάπτυξη)', category: 'Πρόγραμμα & Φροντίδα', is_required: true },
      { id: 'medical_monitoring', label: 'Πρόβλεψη ιατρικής παρακολούθησης', category: 'Πρόγραμμα & Φροντίδα', is_required: true },
      { id: 'psychologist_support', label: 'Συνεργασία με κοινωνικούς λειτουργούς / ψυχολόγους', category: 'Πρόγραμμα & Φροντίδα' },
      { id: 'book_incidents', label: 'Βιβλίο Συμβάντων', category: 'Διοικητικά', is_required: true },
      { id: 'book_health_cards', label: 'Κάρτες Υγείας Νηπίων', category: 'Διοικητικά', is_required: true },
      { id: 'book_attendance', label: 'Βιβλίο Παρουσίας Νηπίων', category: 'Διοικητικά', is_required: true },
      { id: 'book_registry', label: 'Μητρώο Βρεφών/Νηπίων', category: 'Διοικητικά', is_required: true },
      { id: 'book_staff_attendance', label: 'Κατάσταση Παρουσίας Προσωπικού', category: 'Διοικητικά', is_required: true },
    ],
  },
  CAMP: {
    label: 'Παιδική Κατασκήνωση',
    legal_ref: 'ΥΑ Δ22/οικ.37641/1450/2016 (ΦΕΚ Β\' 2710)',
    categories: ['Διοικητικός Έλεγχος', 'Τεχνικός & Υγειονομικός Έλεγχος'],
    criteria: [
      // Source: ΕΝΤΥΠΟ ΠΡΟΕΛΕΓΧΟΥ ΠΑΙΔΙΚΗΣ ΚΑΤΑΣΚΗΝΩΣΗΣ
      // Β. Διοικητικός Έλεγχος Πληρότητας Φακέλου
      { id: 'application', label: 'Αίτηση Φορέα', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'founding_license', label: 'Άδεια Ίδρυσης', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'building_permit', label: 'Οικοδομική Άδεια', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'structural_cert', label: 'Βεβαίωση Στατικής Επάρκειας', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'operation_rules', label: 'Κανονισμός Λειτουργίας', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'activity_program', label: 'Ετήσιο Πρόγραμμα Δραστηριοτήτων', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'diet_plan', label: 'Εβδομαδιαίο Διαιτολόγιο', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'staff_list', label: 'Πίνακας Προσωπικού (με ειδικότητες)', category: 'Διοικητικός Έλεγχος', is_required: true },
      { id: 'evacuation_plan', label: 'Σχέδιο Εκκένωσης (κοινοποιήσεις)', category: 'Διοικητικός Έλεγχος', is_required: true },
      // Γ. Τεχνικός & Υγειονομικός Έλεγχος
      { id: 'fencing', label: 'Επαρκής και ασφαλής περίφραξη', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'gatehouse', label: 'Ύπαρξη θυρωρείου / ελεγχόμενης εισόδου', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'dormitories', label: 'Διαρρύθμιση κοιτώνων ανά ηλικιακή ομάδα', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'wc_baths', label: 'Επαρκής αριθμός WC και λουτρών', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'kitchen', label: 'Καταλληλότητα κουζίνας και χώρου σίτισης', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'first_aid', label: 'Εξοπλισμός πρώτων βοηθειών', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'fire_safety', label: 'Πυρασφάλεια (πυροσβεστήρες, σχέδιο διαφυγής)', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'lightning_rod', label: 'Αλεξικέραυνο σε λειτουργία', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'drinking_water', label: 'Πιστοποιητικό ύδρευσης (πόσιμο νερό)', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'sewage_cleanliness', label: 'Κατάλληλη αποχέτευση – καθαριότητα', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'shade_areas', label: 'Ύπαρξη χώρων σκίασης και δροσιάς', category: 'Τεχνικός & Υγειονομικός Έλεγχος' },
      { id: 'sports_facilities', label: 'Ύπαρξη αθλητικών εγκαταστάσεων (ασφάλεια)', category: 'Τεχνικός & Υγειονομικός Έλεγχος' },
      { id: 'health_training', label: 'Ενημέρωση προσωπικού για υγειονομικά μέτρα', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
      { id: 'medical_staff', label: 'Ιατρικό προσωπικό – χώρος ιατρείου', category: 'Τεχνικός & Υγειονομικός Έλεγχος', is_required: true },
    ],
  },
  // Fallback for unknown structure types
  DEFAULT: {
    label: 'Γενικά κριτήρια',
    categories: ['Στελέχωση', 'Ασφάλεια', 'Υποδομές'],
    criteria: [
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / ωφελούμενων', category: 'Στελέχωση', is_required: true },
      { id: 'staff_qualifications', label: 'Τίτλοι σπουδών', category: 'Στελέχωση', is_required: true },
      { id: 'fire_safety', label: 'Πυροπροστασία', category: 'Ασφάλεια', is_required: true },
      { id: 'hygiene', label: 'Υγιεινή χώρων', category: 'Ασφάλεια', is_required: true },
      { id: 'accessibility', label: 'Προσβασιμότητα', category: 'Υποδομές' },
      { id: 'capacity_compliance', label: 'Τήρηση δυναμικότητας', category: 'Υποδομές', is_required: true },
    ],
  },
};

// Peripheral units (Περιφερειακές Ενότητες) for multi-tenant isolation
export const PERIPHERAL_UNITS = {
  'PE_ATT_KENTRIKOY': 'Π.Ε. Κεντρικού Τομέα Αθηνών',
  'PE_ATT_VORIOY': 'Π.Ε. Βόρειου Τομέα Αθηνών',
  'PE_ATT_NOTIOY': 'Π.Ε. Νότιου Τομέα Αθηνών',
  'PE_ATT_DYTIKOU': 'Π.Ε. Δυτικού Τομέα Αθηνών',
  'PE_PIREOS': 'Π.Ε. Πειραιώς',
  'PE_ANATOLIKIS': 'Π.Ε. Ανατολικής Αττικής',
  'PE_DYTIKIS': 'Π.Ε. Δυτικής Αττικής',
  'PE_THESSALONIKIS': 'Π.Ε. Θεσσαλονίκης',
  'PE_ACHAIAS': 'Π.Ε. Αχαΐας',
  'PE_IRAKLIOY': 'Π.Ε. Ηρακλείου',
  'PE_LARISAS': 'Π.Ε. Λάρισας',
  'PE_MAGNISIAS': 'Π.Ε. Μαγνησίας',
  'PE_IOANNIKON': 'Π.Ε. Ιωαννίνων',
};

// Legislation search tags per structure type code
// Used for auto-searching the knowledge base for relevant legislation
export const LEGISLATION_TAGS = {
  MFH: {
    label: 'Νομοθεσία ΜΦΗ',
    queries: [
      'αδειοδότηση μονάδων φροντίδας ηλικιωμένων',
      'κανονισμός λειτουργίας γηροκομείων',
      'προδιαγραφές μονάδων ηλικιωμένων',
    ],
  },
  KDAP: {
    label: 'Νομοθεσία ΚΔΑΠ',
    queries: [
      'κέντρα δημιουργικής απασχόλησης παιδιών',
      'αδειοδότηση ΚΔΑΠ',
      'προδιαγραφές παιδικών σταθμών',
    ],
  },
  SYD: {
    label: 'Νομοθεσία ΣΥΔ',
    queries: [
      'στέγες υποστηριζόμενης διαβίωσης',
      'δικαιώματα ΑμεΑ αυτόνομη διαβίωση',
      'προδιαγραφές δομών ΑμεΑ',
    ],
  },
  'KDHF-KAA': {
    label: 'Νομοθεσία ΚΔΗΦ/ΚΑΑ',
    queries: [
      'κέντρα ημερήσιας φροντίδας αποκατάσταση',
      'αδειοδότηση δομών αποκατάστασης',
    ],
  },
  MFPAD: {
    label: 'Νομοθεσία ΜΦΠΑΔ',
    queries: [
      'μονάδες φροντίδας παιδιών αναπηρία',
      'ιδρύματα φροντίδας ΑμεΑ',
    ],
  },
  CAMP: {
    label: 'Νομοθεσία Κατασκηνώσεων',
    queries: [
      'αδειοδότηση παιδικών κατασκηνώσεων',
      'κανονισμός λειτουργίας κατασκηνώσεων',
    ],
  },
};

// Forum categories linked to structure types
export const STRUCTURE_FORUM_CATEGORIES = {
  MFH: 'Εποπτεία ΜΦΗ',
  KDAP: 'Εποπτεία ΚΔΑΠ',
  SYD: 'Εποπτεία ΣΥΔ',
  'KDHF-KAA': 'Εποπτεία ΚΔΗΦ/ΚΑΑ',
  MFPAD: 'Εποπτεία ΜΦΠΑΔ',
  CAMP: 'Εποπτεία Κατασκηνώσεων',
};
