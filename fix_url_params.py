import re
import glob

files = [
    'src/app/historico/page.tsx',
    'src/app/matriz/page.tsx',
    'src/app/positivacao/page.tsx',
    'src/app/positivacao-matriz/page.tsx'
]

# We need to replace:
# if (filterManager !== "Todos") params.set("manager", filterManager);
# with:
# if (filterManager.length > 0) params.set("manager", filterManager.join(','));

replacements = [
    (r'if \(filterManager !== "Todos"\) params\.set\("manager", filterManager\);', r'if (filterManager.length > 0) params.set("manager", filterManager.join(","));'),
    (r'if \(filterFamilia !== "Todos"\) params\.set\("familia", filterFamilia\);', r'if (filterFamilia.length > 0) params.set("familia", filterFamilia.join(","));'),
    (r'if \(filterUf !== "Todos"\) params\.set\("uf", filterUf\);', r'if (filterUf.length > 0) params.set("uf", filterUf.join(","));'),
    (r'if \(filterChannel !== "Todos"\) params\.set\("channel", filterChannel\);', r'if (filterChannel.length > 0) params.set("channel", filterChannel.join(","));'),
    (r'if \(filterProduct !== "Todos"\) params\.set\("product", filterProduct\);', r'if (filterProduct.length > 0) params.set("product", filterProduct.join(","));'),
    (r'if \(filterMatriz !== "Todos"\) params\.set\("matriz", filterMatriz\);', r'if (filterMatriz.length > 0) params.set("matriz", filterMatriz.join(","));')
]

for filepath in files:
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        for old, new in replacements:
            content = re.sub(old, new, content)

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed URL params in {filepath}")
    except Exception as e:
        print(e)
