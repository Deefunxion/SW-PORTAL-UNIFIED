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
