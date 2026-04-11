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
        with open(filepath, 'r') as file:
            content = file.read()
            
        content = content.replace('.filter(f => f !== "Todos").length;', '.filter(f => f.length > 0).length;')
        
        with open(filepath, 'w') as file:
            file.write(content)
        print(f"Fixed {filepath}")
    except Exception as e:
        print(e)
