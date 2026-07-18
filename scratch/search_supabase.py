import os

keywords = ["transfer", "transferir", "transferencia", "transferência", "mover", "vincular"]
found = []

for root, dirs, files in os.walk("supabase"):
    for file in files:
        if file.endswith((".sql", ".js", ".json", ".md")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_idx, line in enumerate(f, 1):
                        for kw in keywords:
                            if kw in line.lower():
                                found.append(f"{path}:{line_idx} ({kw}): {line.strip()}")
            except Exception:
                pass

for f in found:
    print(f)
