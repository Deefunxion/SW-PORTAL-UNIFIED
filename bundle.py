import os

def bundle_python_files(input_path, output_file='bundle.py'):
    if not os.path.exists(input_path):
        print(f'ERROR: Path "{input_path}" δεν υπάρχει.')
        return

    # Αν είναι φάκελος, βρες όλα τα .py αρχεία αναδρομικά
    if os.path.isdir(input_path):
        py_files = []
        for root, _, files in os.walk(input_path):
            for f in files:
                if f.endswith('.py'):
                    py_files.append(os.path.join(root, f))
        py_files.sort()
    else:
        # Αν είναι αρχείο, μόνο αυτό
        if input_path.endswith('.py'):
            py_files = [input_path]
        else:
            print('ERROR: Το path δεν είναι .py αρχείο.')
            return

    if not py_files:
        print('Δεν βρέθηκαν αρχεία .py για bundle.')
        return

    with open(output_file, 'w', encoding='utf-8') as outf:
        for filepath in py_files:
            outf.write(f'\n\n# ===== FILE: {filepath} =====\n\n')
            with open(filepath, 'r', encoding='utf-8') as inf:
                content = inf.read()
                outf.write(content)
                outf.write('\n')  # φροντίζουμε να έχει κενό μετά

    print(f'Bundling ολοκληρώθηκε. Αρχείο εξόδου: {output_file}')
    print(f'Περιέχονται {len(py_files)} αρχεία.')

if __name__ == '__main__':
    input_path = input('Δώσε absolute path φακέλου ή αρχείου (.py): ').strip()
    bundle_python_files(input_path)
