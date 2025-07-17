import re
import os

# --- Settings ---
input_filepath = r'C:\Users\dee\Desktop\scr.md'
output_filepath = r'C:\Users\dee\Desktop\scr_CLEANED.md'
# --- End Settings ---

print(f"Reading from: {input_filepath}")
print(f"Writing to: {output_filepath}")

try:
    with open(input_filepath, 'r', encoding='utf-8') as infile, \
         open(output_filepath, 'w', encoding='utf-8') as outfile:
        
        lines_processed = 0
        lines_cleaned = 0

        for line in infile:
            # CORRECTED REGEX:
            # ^     - Start of the line
            # \s*   - Zero or more whitespace characters (the leading spaces)
            # \d+   - One or more digits (the line number)
            # \s    - A single space after the number
            cleaned_line, num_substitutions = re.subn(r'^\s*\d+\s', '', line)
            
            if num_substitutions > 0:
                lines_cleaned += 1

            outfile.write(cleaned_line)
            lines_processed += 1

    print("\n--- Cleaning Complete ---")
    print(f"Total lines processed: {lines_processed}")
    print(f"Lines cleaned (numbers removed): {lines_cleaned}")
    print(f"Clean file saved as '{os.path.basename(output_filepath)}' on your Desktop.")

except FileNotFoundError:
    print(f"\n--- ERROR ---")
    print(f"Input file not found at: {input_filepath}")
    print("Please ensure the file exists at the specified path.")
except Exception as e:
    print(f"\n--- An unexpected error occurred ---")
    print(e)