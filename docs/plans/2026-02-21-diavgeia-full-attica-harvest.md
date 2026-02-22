# Diavgeia Full Attica Harvest — Design Document

## Στόχος

Επέκταση του harvest script ώστε να κατεβάζει αποφάσεις από **όλες τις 7 Δ/νσεις Κοινωνικής Μέριμνας** της Αττικής (όχι μόνο Ανατολική Αττική) και να τις συνδέει με τις 2,046 δομές του μητρώου.

## Τρέχουσα κατάσταση

- Script: `backend/scripts/harvest_diavgeia.py`
- Μόνο unit `80888` (ΠΕ Ανατολικής Αττικής) → 522 αποφάσεις, 262 licenses
- Matching engine: 7 strategies (db_name_in_subject, entity_exact/substring/tokens, subject_tokens, collapsed_doubles, distinctive_token, stem_prefix)
- Αποτέλεσμα: 74% match rate (262/355 relevant)

## Unit IDs — Πλήρης Χάρτης

| ΠΕ | Unit ID | Δομές | Σημείωση |
|----|---------|-------|----------|
| Κεντρικός Τομέας (+ Ανατολικός) | `78977` | 476 | Διεύθυνση Κοινωνικής Μέριμνας |
| Βόρειος Τομέας | `79005` | 413 | ΔΔΥΚΜ ΠΕ Βορείου Τομέα Αθηνών |
| Νότιος Τομέας | `78997` | 331 | ΔΔΥΚΜ ΠΕ Νοτίου Τομέα Αθηνών |
| Ανατολική Αττική | `80888` | 290 | **Ήδη harvested** |
| Πειραιάς & Νήσοι | `100034109` | 219 | ΔΔΥΚΜ ΠΕ Πειραιώς και Νήσων |
| Δυτικός Τομέας | `81945` | 202 | ΔΔΥΚΜ ΠΕ Δυτικού Τομέα |
| Δυτική Αττική | `80893` | 115 | ΔΔΥΚΜ ΠΕ Δυτικής Αττικής |
| **Σύνολο** | **7** | **2,046** | |

## Αλλαγές στο Script

### 1. Multi-unit configuration

Αντικατάσταση του σκληρά-κωδικοποιημένου `UNIT_ID = '80888'` με dictionary:

```python
UNITS = {
    '78977': 'Κεντρικός Τομέας',
    '79005': 'Βόρειος Τομέας',
    '78997': 'Νότιος Τομέας',
    '80888': 'Ανατολική Αττική',
    '100034109': 'Πειραιάς & Νήσοι',
    '81945': 'Δυτικός Τομέας',
    '80893': 'Δυτική Αττική',
}
```

### 2. PE mapping — δομές → unit

Για το matching, κάθε δομή ανήκει σε ΠΕ. Πρέπει να αντιστοιχίσουμε `peripheral_unit` → unit_id ώστε οι candidates να φιλτράρονται σωστά:

```python
PE_TO_UNIT = {
    'ΚΕΝΤΡΙΚΟΣ ΤΟΜΕΑΣ': '78977',
    'ΚΕΝΤΡΙΚΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ': '78977',
    'ΑΝΑΤΟΛΙΚΟΣ ΤΟΜΕΑΣ': '78977',      # falls under central
    'ΒΟΡΕΙΟΣ ΤΟΜΕΑΣ': '79005',
    'ΒΟΡΕΙΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ': '79005',
    'ΝΟΤΙΟΣ ΤΟΜΕΑΣ': '78997',
    'ΝΟΤΙΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ': '78997',
    'ΑΝΑΤΟΛΙΚΗ ΑΤΤΙΚΗ': '80888',
    'ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ': '80888',
    'ΠΕΙΡΑΙΩΣ ΚΑΙ ΝΗΣΩΝ': '100034109',
    'ΠΕΙΡΑΙΩΣ ΝΗΣΩΝ': '100034109',
    'ΠΕΙΡΑΙΩΣ & ΝΗΣΩΝ': '100034109',
    'ΠΕΙΡΑΙΩΣ -ΝΗΣΩΝ': '100034109',
    'ΔΥΤΙΚΟΣ ΤΟΜΕΑΣ': '81945',
    'ΔΥΤΙΚΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ': '81945',
    'ΔΥΤΙΚΗ ΑΤΤΙΚΗ': '80893',
    'ΔΥΤΙΚΗΣ ΑΤΤΙΚΗΣ': '80893',
}
```

### 3. Harvest flow αλλαγές

```
harvest_diavgeia.py --all-units --link            # Dry run, all units
harvest_diavgeia.py --all-units --link --apply     # Apply all
harvest_diavgeia.py --unit 79005 --link            # Single unit
harvest_diavgeia.py --skip-harvest --link          # Re-match existing data
```

**Νέο CLI:**
- `--all-units`: harvest all 7 units (default: only 80888)
- `--unit <id>`: harvest specific unit
- Τα `--skip-harvest`, `--link`, `--apply`, `--create-camps` παραμένουν

### 4. Αποθήκευση — ενιαίο JSON

Ένα `diavgeia_harvest.json` με πεδίο `harvest_unit_id` σε κάθε record:

```json
{
  "ada": "Ψ1ΒΛ7Λ7-ΞΘΛ",
  "harvest_unit_id": "80888",
  "subject": "...",
  ...
}
```

Deduplication by ADA (μια απόφαση μπορεί να εμφανίζεται σε >1 unit).

### 5. Matching improvements — PE-scoped candidates

Σημαντική βελτίωση: αντί να ψάχνουμε σε ΟΛΕΣτις δομές, φιλτράρουμε candidates με βάση τo unit ID → ΠΕ:

```python
# Current: candidates = by_type[detected_type] (all 171 KDAPs)
# New: candidates filtered by PE of the harvesting unit
unit_pe_structures = {unit_id: [s for s in structures if pe_match(s, unit_id)]}

# For each decision from unit X:
#   candidates = unit_pe_structures[X] filtered by type
```

Αυτό μειώνει false positives δραματικά (π.χ. "ΚΔΑΠ Αχαρνών" δεν θα ταιριάζει με αποφάσεις του Νοτίου Τομέα).

**Fallback**: αν δεν βρεθεί match στην ίδια ΠΕ, ψάχνουμε σε ΟΛΕΣτις δομές (κάποιες αποφάσεις αφορούν δομές εκτός ΠΕ).

### 6. Εκτιμήσεις

| Μετρική | Εκτίμηση |
|---------|----------|
| Αποφάσεις/unit | ~400-800 (2016-2026) |
| Σύνολο νέων αποφάσεων | ~3,000-4,500 |
| Relevant (μετά φιλτράρισμα overtime) | ~2,500-3,500 |
| Expected match rate | ~70-75% (based on AA experience) |
| Νέα licenses | ~1,500-2,500 |
| API time | ~25-35 λεπτά (0.3s sleep × ~3,000 pages) |
| Χωρητικότητα JSON | ~2-3 MB ενιαίο |

### 7. Export for Render

Μετά το harvest + match + apply:

```bash
# Re-export both JSONs
python scripts/export_for_render.py   # ή inline στο harvest script

# Outputs:
#   data/attica_structures.json  (2,046 structures, ίδιο format)
#   data/diavgeia_licenses.json  (~1,700+ licenses, ενιαίο)
```

Το `seed_attica.py` ήδη φορτώνει και τα δύο — δεν χρειάζεται αλλαγή.

## Κίνδυνοι

1. **Rate limiting**: 0.3s sleep ανά request. Αν χρειαστεί, αυξάνουμε σε 0.5s.
2. **Duplicate ADAs**: Η ίδια απόφαση μπορεί να εμφανίζεται σε >1 unit (π.χ. inter-PE transfers). Dedup by ADA.
3. **Cross-PE structures**: Κάποιες δομές μπορεί να έχουν αποφάσεις σε γειτονική ΠΕ. Fallback search covers this.
4. **Κεντρικός Τομέας data volume**: Ως κεντρική Δ/νση μπορεί να έχει πολλές γενικές αποφάσεις (οριζόντιες). Περισσότερα "?" unmatched.

## Βήματα Υλοποίησης

1. **Refactor harvest_diavgeia.py**: Multi-unit support, PE mapping, CLI flags
2. **Run harvest**: 6 νέα units (~30 min)
3. **Run matching**: Classify + link with PE-scoped candidates
4. **Review results**: Match rates per unit, false positives check
5. **Apply**: Create License records
6. **Export**: Re-export JSONs for Render
7. **Test seed**: Verify seed_attica.py works with expanded data
