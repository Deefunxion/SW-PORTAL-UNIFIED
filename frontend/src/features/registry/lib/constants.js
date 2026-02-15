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
// Each criterion: { id, label, category }
// Ratings: 'pass' | 'partial' | 'fail' | null (not evaluated)
export const INSPECTION_CRITERIA = {
  MFH: {
    label: 'Μονάδα Φροντίδας Ηλικιωμένων',
    categories: ['Στελέχωση', 'Υγιεινή & Ασφάλεια', 'Φροντίδα', 'Υποδομές'],
    criteria: [
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / ωφελούμενων', category: 'Στελέχωση' },
      { id: 'staff_qualifications', label: 'Τίτλοι σπουδών / πιστοποιήσεις', category: 'Στελέχωση' },
      { id: 'nurse_presence', label: 'Παρουσία νοσηλευτή ανά βάρδια', category: 'Στελέχωση' },
      { id: 'hygiene_common', label: 'Καθαριότητα κοινόχρηστων χώρων', category: 'Υγιεινή & Ασφάλεια' },
      { id: 'hygiene_rooms', label: 'Καθαριότητα δωματίων', category: 'Υγιεινή & Ασφάλεια' },
      { id: 'fire_safety', label: 'Πυροπροστασία / Πυροσβεστήρες', category: 'Υγιεινή & Ασφάλεια' },
      { id: 'emergency_plan', label: 'Σχέδιο εκκένωσης', category: 'Υγιεινή & Ασφάλεια' },
      { id: 'meal_quality', label: 'Ποιότητα σίτισης', category: 'Φροντίδα' },
      { id: 'medical_equipment', label: 'Ιατρικός εξοπλισμός', category: 'Φροντίδα' },
      { id: 'care_plans', label: 'Ατομικά πλάνα φροντίδας', category: 'Φροντίδα' },
      { id: 'accessibility', label: 'Προσβασιμότητα ΑμεΑ', category: 'Υποδομές' },
      { id: 'capacity_compliance', label: 'Τήρηση δυναμικότητας', category: 'Υποδομές' },
    ],
  },
  KDAP: {
    label: 'Κέντρο Δημιουργικής Απασχόλησης Παιδιών',
    categories: ['Στελέχωση', 'Ασφάλεια', 'Πρόγραμμα', 'Υποδομές'],
    criteria: [
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / παιδιών', category: 'Στελέχωση' },
      { id: 'staff_qualifications', label: 'Τίτλοι σπουδών παιδαγωγών', category: 'Στελέχωση' },
      { id: 'playground_safety', label: 'Ασφάλεια αύλειων χώρων', category: 'Ασφάλεια' },
      { id: 'first_aid', label: 'Κουτί πρώτων βοηθειών', category: 'Ασφάλεια' },
      { id: 'fire_safety', label: 'Πυροπροστασία', category: 'Ασφάλεια' },
      { id: 'curriculum', label: 'Εκπαιδευτικό πρόγραμμα', category: 'Πρόγραμμα' },
      { id: 'activities', label: 'Δημιουργικές δραστηριότητες', category: 'Πρόγραμμα' },
      { id: 'facility_condition', label: 'Κατάσταση εγκαταστάσεων', category: 'Υποδομές' },
      { id: 'capacity_compliance', label: 'Τήρηση δυναμικότητας', category: 'Υποδομές' },
    ],
  },
  SYD: {
    label: 'Συμβουλευτικό Κέντρο',
    categories: ['Στελέχωση', 'Υπηρεσίες', 'Υποδομές'],
    criteria: [
      { id: 'staff_qualifications', label: 'Ειδικότητες συμβούλων', category: 'Στελέχωση' },
      { id: 'confidentiality', label: 'Τήρηση απορρήτου / χώρος συνεδριών', category: 'Υπηρεσίες' },
      { id: 'case_management', label: 'Σύστημα διαχείρισης περιστατικών', category: 'Υπηρεσίες' },
      { id: 'referral_network', label: 'Δίκτυο παραπομπών', category: 'Υπηρεσίες' },
      { id: 'accessibility', label: 'Προσβασιμότητα', category: 'Υποδομές' },
      { id: 'waiting_area', label: 'Χώρος αναμονής', category: 'Υποδομές' },
    ],
  },
  'KDHF-KAA': {
    label: 'Κέντρο Διημέρευσης / Αποκατάστασης',
    categories: ['Στελέχωση', 'Υπηρεσίες', 'Υποδομές'],
    criteria: [
      { id: 'staff_qualifications', label: 'Ειδικότητες θεραπευτών', category: 'Στελέχωση' },
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / ωφελούμενων', category: 'Στελέχωση' },
      { id: 'therapy_programs', label: 'Θεραπευτικά προγράμματα', category: 'Υπηρεσίες' },
      { id: 'individual_plans', label: 'Εξατομικευμένα πλάνα αποκατάστασης', category: 'Υπηρεσίες' },
      { id: 'equipment', label: 'Εξοπλισμός αποκατάστασης', category: 'Υποδομές' },
      { id: 'accessibility', label: 'Προσβασιμότητα ΑμεΑ', category: 'Υποδομές' },
    ],
  },
  // Fallback for unknown structure types
  DEFAULT: {
    label: 'Γενικά κριτήρια',
    categories: ['Στελέχωση', 'Ασφάλεια', 'Υποδομές'],
    criteria: [
      { id: 'staff_ratio', label: 'Αναλογία προσωπικού / ωφελούμενων', category: 'Στελέχωση' },
      { id: 'staff_qualifications', label: 'Τίτλοι σπουδών', category: 'Στελέχωση' },
      { id: 'fire_safety', label: 'Πυροπροστασία', category: 'Ασφάλεια' },
      { id: 'hygiene', label: 'Υγιεινή χώρων', category: 'Ασφάλεια' },
      { id: 'accessibility', label: 'Προσβασιμότητα', category: 'Υποδομές' },
      { id: 'capacity_compliance', label: 'Τήρηση δυναμικότητας', category: 'Υποδομές' },
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
