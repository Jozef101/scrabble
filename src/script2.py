import json
from pathlib import Path

# Cesta k priečinku, kde máš svoje JSON súbory
input_dir = Path("C:/Projects/Scrabble/scrabble/src/ZoznamySlov")

# Nájde všetky .json súbory v priečinku (môžeš prispôsobiť filter)
json_files = list(input_dir.glob("*.json"))

all_words = set()

for file in json_files:
    with open(file, encoding="utf-8") as f:
        try:
            words = json.load(f)
            if isinstance(words, list):
                all_words.update(words)
        except json.JSONDecodeError:
            print(f"⚠️ Súbor {file} nie je validný JSON, preskakujem...")

# Výsledný zoznam utriedime abecedne
unique_words = sorted(all_words)

# Výstupný súbor
output_file = input_dir / "additionalSlovakWords.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(unique_words, f, indent=2, ensure_ascii=False)

print(f"Hotovo! Počet unikátnych slov: {len(unique_words)}")
