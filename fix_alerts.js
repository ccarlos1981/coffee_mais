const fs = require('fs');
const filepath = 'src/app/api/cron/generate-alerts/route.ts';
let code = fs.readFileSync(filepath, 'utf8');

// Insert a failsafe counter
code = code.replace(/let from = 0;/, "let from = 0;\n    let pageCount = 0;");
code = code.replace(/while \(true\) \{/g, "while (pageCount < 100) {\n      pageCount++;\n      console.log('Fetching page: ' + pageCount + ' from: ' + from);");

fs.writeFileSync(filepath, code);
