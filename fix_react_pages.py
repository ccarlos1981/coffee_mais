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
            
        content = content.replace("useState(\"Todos\")", "useState<string[]>([])")
        
        # Replace the params sent to the API
        content = content.replace("manager=${filterManager}", "manager=${filterManager.length > 0 ? filterManager.join(',') : 'all'}")
        content = content.replace("familia=${filterFamilia}", "familia=${filterFamilia.length > 0 ? filterFamilia.join(',') : 'all'}")
        content = content.replace("uf=${filterUf}", "uf=${filterUf.length > 0 ? filterUf.join(',') : 'all'}")
        content = content.replace("channel=${filterChannel}", "channel=${filterChannel.length > 0 ? filterChannel.join(',') : 'all'}")
        content = content.replace("product=${filterProduct}", "product=${filterProduct.length > 0 ? filterProduct.join(',') : 'all'}")
        content = content.replace("matriz=${filterMatriz}", "matriz=${filterMatriz.length > 0 ? filterMatriz.join(',') : 'all'}")
        
        # In history APIs:
        content = content.replace("manager=${encodeURIComponent(filterManager)}", "manager=${encodeURIComponent(filterManager.length > 0 ? filterManager.join(',') : 'all')}")
        content = content.replace("familia=${encodeURIComponent(filterFamilia)}", "familia=${encodeURIComponent(filterFamilia.length > 0 ? filterFamilia.join(',') : 'all')}")
        content = content.replace("uf=${encodeURIComponent(filterUf)}", "uf=${encodeURIComponent(filterUf.length > 0 ? filterUf.join(',') : 'all')}")
        content = content.replace("channel=${encodeURIComponent(filterChannel)}", "channel=${encodeURIComponent(filterChannel.length > 0 ? filterChannel.join(',') : 'all')}")
        content = content.replace("product=${encodeURIComponent(filterProduct)}", "product=${encodeURIComponent(filterProduct.length > 0 ? filterProduct.join(',') : 'all')}")
        content = content.replace("matriz=${encodeURIComponent(filterMatriz)}", "matriz=${encodeURIComponent(filterMatriz.length > 0 ? filterMatriz.join(',') : 'all')}")

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed param formatting in {filepath}")
    except Exception as e:
        print(e)
