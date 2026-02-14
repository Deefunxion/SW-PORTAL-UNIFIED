#!/usr/bin/env python
"""
Seed database with demo forum discussions and posts.
Creates realistic Greek social welfare content for demo presentation.

Usage:
    python scripts/seed_demo_data.py
"""
import os
import sys

# Fix Unicode output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from my_project import create_app
from my_project.extensions import db
from my_project.models import User, Category, Discussion, Post


def seed_discussions():
    """Create demo forum discussions with posts."""
    app = create_app()

    with app.app_context():
        admin = User.query.filter_by(username='admin').first()
        staff = User.query.filter_by(username='staff').first()

        if not admin or not staff:
            print("Error: Default users not found. Run the app first to create seed users.")
            return

        categories = Category.query.all()
        if not categories:
            print("Error: No categories found.")
            return

        # Check if demo discussions already exist
        if Discussion.query.count() > 0:
            print("Discussions already exist. Skipping seed.")
            return

        cat_map = {c.title: c for c in categories}

        demo_data = [
            {
                "category": "Γενικά Θέματα",
                "title": "Νέα εγκύκλιος για τις δομές κοινωνικής φροντίδας",
                "description": "Συζήτηση για τις αλλαγές που φέρνει η νέα εγκύκλιος",
                "user": admin,
                "posts": [
                    (admin, "Αγαπητοί συνάδελφοι, δημοσιεύθηκε η νέα εγκύκλιος σχετικά με τις απαιτήσεις λειτουργίας δομών κοινωνικής φροντίδας. Παρακαλώ ελέγξτε τα νέα κριτήρια."),
                    (staff, "Ευχαριστούμε για την ενημέρωση. Υπάρχει συγκεκριμένη ημερομηνία εφαρμογής;"),
                    (admin, "Η εφαρμογή ξεκινά σε 3 μήνες. Θα αναρτήσω σύντομα αναλυτικό οδηγό στην ενότητα Αποθήκη."),
                ]
            },
            {
                "category": "Νομικά Θέματα",
                "title": "Ερώτηση για αδειοδότηση ΚΔΑΠ",
                "description": "Ποια δικαιολογητικά απαιτούνται για άδεια ίδρυσης ΚΔΑΠ;",
                "user": staff,
                "posts": [
                    (staff, "Καλησπέρα. Ετοιμάζω φάκελο αδειοδότησης για νέο ΚΔΑΠ στην Αττική. Ποια δικαιολογητικά χρειάζονται σύμφωνα με την τελευταία ΚΥΑ;"),
                    (admin, "Σύμφωνα με την ΚΥΑ, χρειάζεστε: 1) Αίτηση ίδρυσης, 2) Οικοδομική άδεια, 3) Πιστοποιητικό πυρασφάλειας, 4) Βεβαίωση ΕΦΕΤ. Δείτε αναλυτικά στην Αποθήκη > ΝΟΜΟΘΕΣΙΑ_ΚΟΙΝΩΝΙΚΗΣ_ΜΕΡΙΜΝΑΣ > ΚΔΑΠ."),
                ]
            },
            {
                "category": "Δύσκολα Θέματα",
                "title": "Χειρισμός περιπτώσεων ελέγχου δομών ΜΦΗ",
                "description": "Πρακτικές οδηγίες για τη διεξαγωγή ελέγχων σε Μονάδες Φροντίδας Ηλικιωμένων",
                "user": admin,
                "posts": [
                    (admin, "Θέλω να μοιραστώ ορισμένες πρακτικές που ακολουθούμε κατά τον έλεγχο ΜΦΗ. Η τήρηση πρωτοκόλλου είναι κρίσιμη."),
                    (staff, "Συμφωνώ απόλυτα. Ειδικά στον τομέα υγιεινής, η τεκμηρίωση πρέπει να είναι πολύ αναλυτική."),
                ]
            },
            {
                "category": "Νέα-Ανακοινώσεις",
                "title": "Ενημέρωση: Νέο σύστημα ηλεκτρονικής υποβολής αιτήσεων",
                "description": "Η πύλη ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ αναβαθμίζεται με AI βοηθό",
                "user": admin,
                "posts": [
                    (admin, "Με χαρά ανακοινώνουμε ότι η Πύλη Κοινωνικής Μέριμνας αναβαθμίστηκε με νέο AI βοηθό. Μπορείτε πλέον να κάνετε ερωτήσεις σχετικά με τη νομοθεσία και να λαμβάνετε απαντήσεις βασισμένες στα επίσημα έγγραφα."),
                ]
            },
            {
                "category": "Προτάσεις",
                "title": "Πρόταση: Αυτόματη ειδοποίηση λήξης αδειών",
                "description": "Σύστημα υπενθυμίσεων για ανανέωση αδειών λειτουργίας",
                "user": staff,
                "posts": [
                    (staff, "Προτείνω να προστεθεί δυνατότητα αυτόματης ειδοποίησης όταν πλησιάζει η λήξη αδειών λειτουργίας δομών. Αυτό θα αποτρέψει εκπρόθεσμες ανανεώσεις."),
                    (admin, "Εξαιρετική ιδέα! Θα τη συμπεριλάβουμε στην επόμενη αναβάθμιση."),
                ]
            },
        ]

        for item in demo_data:
            cat = cat_map.get(item["category"])
            if not cat:
                print(f"Category '{item['category']}' not found, skipping.")
                continue

            disc = Discussion(
                title=item["title"],
                description=item["description"],
                category_id=cat.id,
                user_id=item["user"].id,
            )
            db.session.add(disc)
            db.session.flush()

            for user, content in item["posts"]:
                post = Post(
                    content=content,
                    discussion_id=disc.id,
                    user_id=user.id,
                )
                db.session.add(post)

            print(f"  Created: {item['title']} ({len(item['posts'])} posts)")

        db.session.commit()
        print(f"\nSeeded {len(demo_data)} discussions with forum content.")


if __name__ == "__main__":
    seed_discussions()
