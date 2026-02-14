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
