const fs = require('fs');

const filesToUpdate = [
  'src/app/api/audit-network/route.ts',
  'src/app/api/dashboard/positivacao-matriz/route.ts',
  'src/app/api/dashboard/debug/route.ts',
  'src/app/investimento/planejamento/page.tsx',
  'src/app/investimento/por-mes/page.tsx',
  'src/app/investimento/page.tsx',
  'src/app/investimento/gerencial/page.tsx',
  'src/app/investimento/invest-cliente/page.tsx'
];

for (const file of filesToUpdate) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Ensure the import includes resolveSupabaseTableName
  if (content.includes('OFFICIAL_ANALYTICS_SOURCES')) {
    if (!content.includes('resolveSupabaseTableName')) {
      // Find the import line
      content = content.replace(
        /import\s+{([^}]*OFFICIAL_ANALYTICS_SOURCES[^}]*)}\s+from\s+["']@\/lib\/governance\/analytics(\/sources)?["'];?/,
        (match, imports) => {
          if (!imports.includes('resolveSupabaseTableName')) {
            return match.replace('OFFICIAL_ANALYTICS_SOURCES', 'OFFICIAL_ANALYTICS_SOURCES, resolveSupabaseTableName');
          }
          return match;
        }
      );
    }
    
    // Replace .from(OFFICIAL_ANALYTICS_SOURCES...) with .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES...))
    content = content.replace(
      /\.from\(\s*(OFFICIAL_ANALYTICS_SOURCES\.[A-Z_]+)\s*\)/g,
      '.from(resolveSupabaseTableName($1))'
    );
    
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
