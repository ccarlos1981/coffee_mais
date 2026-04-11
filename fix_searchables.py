import re
import glob

files = [
    'src/app/vendas/page.tsx',
    'src/app/historico/page.tsx',
    'src/app/matriz/page.tsx',
    'src/app/positivacao/page.tsx',
    'src/app/positivacao-matriz/page.tsx'
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        content = content.replace("<SearchableSelect", "<MultiSelect")
        content = content.replace("</SearchableSelect>", "</MultiSelect>")

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed SearchableSelect in {filepath}")
    except Exception as e:
        print(e)
