import os

keywords = ["transfer", "transferir", "transferencia", "transferência", "mover", "vincular"]
found = []

for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith((".ts", ".tsx", ".js", ".jsx", ".css", ".sql", ".md")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_idx, line in enumerate(f, 1):
                        for kw in keywords:
                            if kw in line.lower():
                                found.append(f"{path}:{line_idx} ({kw}): {line.strip()}")
            except Exception:
                pass

with open("scratch/search_all_results.txt", "w", encoding="utf-8") as f:
    for line in found:
        f.write(line + "\n")

print(f"Written {len(found)} matches to scratch/search_all_results.txt")
