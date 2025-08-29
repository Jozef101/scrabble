import re
import json
from pathlib import Path

# Vstupný súbor
input_file = Path("C:/Projects/Scrabble/scrabble/src/podstatne.txt")
with open(input_file, encoding="utf-8") as f:
    text = f.read()

# Nájdi všetky sekvencie písmen (vrátane diakritiky)
words = re.findall(r"[A-Za-zÀ-ž]+", text)

# Odfiltruj len slová dlhšie ako 2 znaky a preved na veľké písmená
valid_words = [word.upper() for word in words if len(word) > 2]

# Výstupný súbor
output_file = Path("C:/Projects/Scrabble/scrabble/src/podstatne.json")
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(valid_words, f, indent=2, ensure_ascii=False)

print(f"Hotovo! Počet slov: {len(valid_words)}")
