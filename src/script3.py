import json
from pathlib import Path

# Vstupný súbor
input_file = Path("C:/Projects/Scrabble/scrabble/src/data/slovakWords.json")

# Výstupný súbor
output_file = Path("C:/Projects/Scrabble/scrabble/src/uniqueSlovakWords.json")

with open(input_file, encoding="utf-8") as f:
    words = json.load(f)

# Odstránenie duplicitov, zachovanie pôvodného poradia
unique_words = list(dict.fromkeys(words))

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(unique_words, f, indent=2, ensure_ascii=False)

print(f"Hotovo! Počet unikátnych slov: {len(unique_words)}")
