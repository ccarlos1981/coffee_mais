import os
import glob
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We want to replace:
    # if (filters.manager) query = query.eq('manager', filters.manager);
    # with:
    # if (filters.manager) query = query.in('manager', filters.manager.split(','));
    
    # Let's find all `if (filters.XXX) query = query.eq('YYY', filters.XXX);`
    # or similar patterns.
    
    replacements = [
        ("if (filters.manager) query = query.eq('manager', filters.manager);",
         "if (filters.manager) query = query.in('manager', filters.manager.split(','));"),
        ("if (filters.familia) query = query.eq('tipo_produto', filters.familia);",
         "if (filters.familia) query = query.in('tipo_produto', filters.familia.split(','));"),
        ("if (filters.uf) query = query.eq('uf', filters.uf);",
         "if (filters.uf) query = query.in('uf', filters.uf.split(','));"),
        ("if (filters.channel) query = query.eq('channel', filters.channel);",
         "if (filters.channel) query = query.in('channel', filters.channel.split(','));"),
        ("if (filters.product) query = query.eq('product', filters.product);",
         "if (filters.product) query = query.in('product', filters.product.split(','));"),
        ("if (filters.matriz) query = query.eq('rede', filters.matriz);",
         "if (filters.matriz) query = query.in('rede', filters.matriz.split(','));")
    ]
    
    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

for f in glob.glob('src/app/api/dashboard/**/*.ts', recursive=True):
    fix_file(f)
