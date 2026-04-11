import re
import os

files = [
    'src/app/vendas/page.tsx',
    'src/app/historico/page.tsx',
    'src/app/matriz/page.tsx',
    'src/app/positivacao/page.tsx',
    'src/app/positivacao-matriz/page.tsx'
]

# Patterns to replace the entire <select>...</select> snippet
replacements = [
    (
        r'<select value=\{filterManager\} onChange=\{\(e\) => setFilterManager\(e\.target\.value\)\} className="dash-filter-select">[\s\S]*?</select>',
        '<MultiSelect value={filterManager} onChange={setFilterManager} options={filterOptions.managers} className="dash-filter-select" placeholder="Todos" />'
    ),
    (
        r'<select value=\{filterFamilia\} onChange=\{\(e\) => setFilterFamilia\(e\.target\.value\)\} className="dash-filter-select">[\s\S]*?</select>',
        '<MultiSelect value={filterFamilia} onChange={setFilterFamilia} options={filterOptions.familias} className="dash-filter-select" placeholder="Todas" />'
    ),
    (
        r'<select value=\{filterUf\} onChange=\{\(e\) => setFilterUf\(e\.target\.value\)\} className="dash-filter-select">[\s\S]*?</select>',
        '<MultiSelect value={filterUf} onChange={setFilterUf} options={filterOptions.ufs} className="dash-filter-select" placeholder="Todos" />'
    ),
    (
        r'<select value=\{filterChannel\} onChange=\{\(e\) => setFilterChannel\(e\.target\.value\)\} className="dash-filter-select">[\s\S]*?</select>',
        '<MultiSelect value={filterChannel} onChange={setFilterChannel} options={filterOptions.channels} className="dash-filter-select" placeholder="Todas" />'
    ),
    (
        r'<select value=\{filterProduct\} onChange=\{\(e\) => setFilterProduct\(e\.target\.value\)\} className="dash-filter-select">[\s\S]*?</select>',
        '<MultiSelect value={filterProduct} onChange={setFilterProduct} options={filterOptions.products} className="dash-filter-select" placeholder="Todos" />'
    ),
    (
        r'<SearchableSelect value=\{filterMatriz\} onChange=\{setFilterMatriz\} options=\{filterOptions\.matrizes\} className="dash-filter-select" placeholder="Todas" />',
        '<MultiSelect value={filterMatriz} onChange={setFilterMatriz} options={filterOptions.matrizes} className="dash-filter-select" placeholder="Todas" />'
    ),
    (
        r'<SearchableSelect value=\{filterProduct\} onChange=\{setFilterProduct\} options=\{filterOptions\.products\} className="dash-filter-select" placeholder="Todos" />',
        '<MultiSelect value={filterProduct} onChange={setFilterProduct} options={filterOptions.products} className="dash-filter-select" placeholder="Todos" />'
    )
]

for filepath in files:
    try:
        if not os.path.exists(filepath):
            continue
        with open(filepath, 'r') as f:
            content = f.read()

        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
            
        # Also let's fix the imports
        if "import { SearchableSelect" in content:
            content = content.replace('import { SearchableSelect } from "@/components/SearchableSelect";', 
                                      'import { MultiSelect } from "@/components/MultiSelect";')
        elif 'import { MultiSelect' not in content:
            # Inject import after import Link 
            content = content.replace('import Link from "next/link";', 
                                      'import Link from "next/link";\nimport { MultiSelect } from "@/components/MultiSelect";')

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Replaced selects in {filepath}")
    except Exception as e:
        print(e)
