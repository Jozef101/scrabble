import re
import json
from pathlib import Path

# Vstupný súbor
input_file = Path("C:/Projects/Scrabble/scrabble/src/final.txt")
with open(input_file, encoding="utf-8") as f:
    text = f.read()

# Rozdeľ všetko po riadkoch
words = text.splitlines()

# Odfiltruj len slová s 2–5 znakmi a preved na veľké písmená
valid_words = [word.strip().upper() for word in words if 2 <= len(word.strip()) <= 5]

# Výstupný súbor
output_file = Path("C:/Projects/Scrabble/scrabble/src/validWords.json")
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(valid_words, f, indent=2, ensure_ascii=False)

print(f"Hotovo! Počet slov: {len(valid_words)}")
