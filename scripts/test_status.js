const { execSync } = require('child_process');
try {
  console.log(execSync('ps aux | grep import_faturamento', { encoding: 'utf8' }));
} catch (e) {}
