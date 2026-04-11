import re

files = [
    'src/app/vendas/page.tsx',
    'src/app/historico/page.tsx',
    'src/app/matriz/page.tsx',
    'src/app/positivacao/page.tsx',
    'src/app/positivacao-matriz/page.tsx'
]

replacements = [
    (r'setFilterManager\("Todos"\);?', r'setFilterManager([]);'),
    (r'setFilterFamilia\("Todos"\);?', r'setFilterFamilia([]);'),
    (r'setFilterUf\("Todos"\);?', r'setFilterUf([]);'),
    (r'setFilterChannel\("Todos"\);?', r'setFilterChannel([]);'),
    (r'setFilterProduct\("Todos"\);?', r'setFilterProduct([]);'),
    (r'setFilterMatriz\("Todos"\);?', r'setFilterMatriz([]);')
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        for old, new in replacements:
            content = re.sub(old, new, content)

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed clear methods in {filepath}")
    except Exception as e:
        print(e)
