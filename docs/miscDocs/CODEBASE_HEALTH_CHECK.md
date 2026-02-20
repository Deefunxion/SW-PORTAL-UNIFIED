# Έλεγχος Υγείας Codebase — Πύλη Κοινωνικής Μέριμνας

## Οδηγίες για Claude Code

Σαρώσε ολόκληρο το codebase του project και εκτέλεσε τους παρακάτω ελέγχους έναν-έναν. Για κάθε checkpoint:
1. Αναφέρε αν υπάρχει πρόβλημα (ΝΑΙ/ΟΧΙ)
2. Δείξε τα συγκεκριμένα αρχεία και γραμμές κώδικα που αφορούν
3. Πρότεινε τη διόρθωση
4. Εφάρμοσε τη διόρθωση αφού περιγράψεις τι θα αλλάξεις

Σειρά προτεραιότητας: ξεκίνα από το Checkpoint 1 (κρίσιμο θέμα ασφαλείας) και προχώρα με τη σειρά.

---

## Checkpoint 1 — ΚΡΙΣΙΜΟ: Ασφάλεια API Keys & Secrets

**Τι ψάχνεις:** API keys, tokens, passwords, secrets που είναι γραμμένα απευθείας μέσα στον κώδικα (hardcoded) αντί να φορτώνονται από environment variables.

**Πού ψάχνεις:**
- Σε ΟΛΑ τα frontend αρχεία (React components, .tsx, .ts, .jsx, .js στον φάκελο src/)
- Σε config αρχεία
- Σε αρχεία .env που μπορεί να είναι committed στο repo (έλεγξε το .gitignore)

**Συγκεκριμένα ψάξε για:**
- OpenAI API keys (sk-...)
- Supabase keys/URLs γραμμένα απευθείας στον κώδικα
- Οποιοδήποτε token ή password σε plaintext
- Frontend κώδικα που καλεί απευθείας third-party APIs (π.χ. OpenAI) χωρίς να περνάει από backend

**Πώς διορθώνεται:**
- Μετέφερε ΟΛΕΣ τις κλήσεις σε third-party APIs στο backend (Flask)
- Χρησιμοποίησε environment variables για κάθε secret
- Βεβαιώσου ότι το .env είναι στο .gitignore
- Το frontend πρέπει να μιλάει ΜΟΝΟ με το δικό μας backend, ποτέ απευθείας με εξωτερικά APIs

---

## Checkpoint 2 — Αποδοτικότητα Database Queries (N+1 Problem)

**Τι ψάχνεις:** Κλήσεις στη βάση δεδομένων μέσα σε loops — δηλαδή ο κώδικας φορτώνει μια λίστα αντικειμένων και μετά για ΚΑΘΕ αντικείμενο κάνει ξεχωριστή κλήση στη βάση.

**Πού ψάχνεις:**
- Backend routes/endpoints (Flask)
- Οποιοδήποτε σημείο που φορτώνει λίστες εγγραφών (μονάδες, επιθεωρήσεις, κυρώσεις κλπ.)

**Παράδειγμα προβλήματος:**
```python
# ΚΑΚΟ — N+1 query
facilities = db.query(Facility).all()
for facility in facilities:
    inspections = db.query(Inspection).filter_by(facility_id=facility.id).all()
```

**Πώς διορθώνεται:**
```python
# ΚΑΛΟ — Batch query με JOIN ή eager loading
facilities = db.query(Facility).options(joinedload(Facility.inspections)).all()
```

Κάνε batch τα queries. Φόρτωσε σχετικά δεδομένα μαζί αντί ένα-ένα.

---

## Checkpoint 3 — Error Handling στα Κρίσιμα Flows

**Τι ψάχνεις:** Σημεία στον κώδικα όπου μια αποτυχία (network error, timeout, server error) οδηγεί σε κενή οθόνη, κρέμασμα, ή ακατανόητο μήνυμα.

**Ποια flows ελέγχεις (με σειρά σημασίας):**
1. Login/Authentication — τι βλέπει ο χρήστης αν λήξει το session;
2. AI Legal Assistant — τι γίνεται αν το OpenAI API δεν απαντήσει ή επιστρέψει error;
3. Αποθήκευση επιθεωρήσεων — τι γίνεται αν η βάση δεδομένων δεν αποκριθεί;
4. Φόρτωση δεδομένων dashboard — υπάρχει loading state ή μένει κενή η οθόνη;

**Τι πρέπει να υπάρχει:**
- Try/catch blocks σε κάθε API call (backend ΚΑΙ frontend)
- Loading states (spinner ή μήνυμα "Φόρτωση...") σε κάθε σημείο που περιμένουμε δεδομένα
- Κατανοητά μηνύματα λάθους στα Ελληνικά για τον χρήστη
- Αυτόματο redirect σε login αν λήξει το session

---

## Checkpoint 4 — Διαχωρισμός Staging / Production

**Τι ψάχνεις:** Υπάρχει τρόπος να δοκιμάζουμε αλλαγές ΠΡΙΝ τις δουν οι χρήστες;

**Έλεγξε:**
- Υπάρχουν ξεχωριστά environment configurations (π.χ. .env.development, .env.production);
- Η βάση δεδομένων του testing είναι ξεχωριστή από αυτή του production;
- Υπάρχει κάποιο deployment pipeline ή γίνεται manual push;

**Αν ΔΕΝ υπάρχει διαχωρισμός:**
- Πρότεινε τη δομή για ξεχωριστά environments στο Render
- Δημιούργησε config αρχεία που διαχωρίζουν development/staging/production settings

---

## Checkpoint 5 — Αντοχή σε Αυξημένο Φορτίο

**Τι ψάχνεις:** Σημεία που θα σπάσουν πρώτα αν αυξηθούν οι χρήστες (π.χ. από 5 κοινωνικούς λειτουργούς σε 50).

**Συγκεκριμένα έλεγξε:**
- Database queries χωρίς pagination (φόρτωση ΟΛΩΝ των εγγραφών αντί σελιδοποίησης)
- Uploads χωρίς size limit (αν υπάρχει ανέβασμα αρχείων)
- API rate limits — υπάρχει rate limiting στα endpoints μας;
- OpenAI API calls — υπάρχει κάποιο caching ή throttling για να μην εξαντληθεί το quota;

**Πώς διορθώνεται:**
- Πρόσθεσε pagination σε κάθε endpoint που επιστρέφει λίστες
- Πρόσθεσε size limits σε file uploads
- Εφάρμοσε rate limiting (π.χ. Flask-Limiter)
- Πρόσθεσε caching για συχνά ζητούμενα δεδομένα

---

## Checkpoint 6 — Γενική Ποιότητα Κώδικα

**Τι ψάχνεις:** Προβλήματα που δυσκολεύουν τη συντήρηση και ανάπτυξη του κώδικα.

**Έλεγξε:**
- Duplicate code — ίδια λογική γραμμένη σε πολλά σημεία αντί να είναι σε κοινή function
- Αρχεία υπερβολικά μεγάλα (>300 γραμμές) που πρέπει να σπάσουν σε μικρότερα
- Console.log / print statements που έμειναν από debugging
- Unused imports και dead code (κώδικας που δεν καλείται πουθενά)
- Σχόλια που εξηγούν τι κάνει ο κώδικας (ιδιαίτερα σε πολύπλοκη business logic)

---

## Αναφορά Αποτελεσμάτων

Μετά τον έλεγχο, δημιούργησε αναφορά με:

| Checkpoint | Κατάσταση | Ευρήματα | Διορθώσεις |
|---|---|---|---|
| 1. API Keys | 🔴/🟡/🟢 | ... | ... |
| 2. DB Queries | 🔴/🟡/🟢 | ... | ... |
| 3. Error Handling | 🔴/🟡/🟢 | ... | ... |
| 4. Staging/Prod | 🔴/🟡/🟢 | ... | ... |
| 5. Scalability | 🔴/🟡/🟢 | ... | ... |
| 6. Code Quality | 🔴/🟡/🟢 | ... | ... |

🔴 = Κρίσιμο, πρέπει να διορθωθεί αμέσως
🟡 = Σημαντικό, πρέπει να διορθωθεί σύντομα
🟢 = Εντάξει ή ελάσσονα θέματα
