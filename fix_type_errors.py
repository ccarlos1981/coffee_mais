import re

files = [
    'src/app/vendas/page.tsx',
    'src/app/historico/page.tsx',
    'src/app/matriz/page.tsx',
    'src/app/positivacao/page.tsx',
    'src/app/positivacao-matriz/page.tsx'
]

# We are searching for conditions like `filterManager !== "Todos"` and replacing with `filterManager.length > 0`
replacements = [
    (r'filterManager !== "Todos"', r'filterManager.length > 0'),
    (r'filterFamilia !== "Todos"', r'filterFamilia.length > 0'),
    (r'filterUf !== "Todos"', r'filterUf.length > 0'),
    (r'filterChannel !== "Todos"', r'filterChannel.length > 0'),
    (r'filterProduct !== "Todos"', r'filterProduct.length > 0'),
    (r'filterMatriz !== "Todos"', r'filterMatriz.length > 0')
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        for old, new in replacements:
            content = re.sub(old, new, content)

        # But wait, what about the display logic in the UI?
        # {filterFamilia.length > 0 && <div>Família: <strong>{filterFamilia}</strong></div>} -> React can render arrays of strings natively, but they will be concatenated without spaces or commas if we don't .join them.
        # {filterFamilia} -> {filterFamilia.join(', ')}
        # We need a regex for `\{filter(.+?)\}` -> `\{filter\1.join(', ')\}` but only inside JSX where it was displaying them!
        
        # Let's manually replace the known JSX blocks displaying the filter names
        # Usually it's like <strong>{filterFamilia}</strong>
        content = re.sub(r'<strong>\{filter(Manager|Familia|Uf|Channel|Product|Matriz)\}</strong>', r'<strong>{filter\1.join(", ")}</strong>', content)
        # Also strong style={{...}}>{filterXXX}
        content = re.sub(r'<strong style=\{\{color:\'var\(--foreground\)\'\}\}>\{filter(Manager|Familia|Uf|Channel|Product|Matriz)\}</strong>', r'<strong style={{color:"var(--foreground)"}}>{filter\1.join(", ")}</strong>', content)
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed TS type condition errors in {filepath}")
    except Exception as e:
        print(e)
