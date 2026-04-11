const XLSX = require('xlsx');

function checkUniqueNetworks() {
  const filePath = './Dados da Coffee mais/VisãoHistórica KA (2).xlsb';
  console.log('Loading file...');
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  
  const sheet = workbook.Sheets['ÚltimasVendas'];
  // The headers are on row 8 (0-indexed). So range 8 skips the first 8 rows.
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 4 });
  
  console.log('First data row keys:', Object.keys(data[0] || {}));
  console.log('First data row data:', data[0]);
  
  const networks = new Set();
  data.forEach(row => {
    // try to find the key containing "Rede" or "UF" if Rede_UF is not exact
    const key = Object.keys(row).find(k => k.includes('Rede_UF') || k.includes('Rede'));
    if (key && row[key]) {
      networks.add(row[key]);
    }
  });
  
  console.log('Unique Rede_UF values found in data:', Array.from(networks).slice(0, 20));
}

checkUniqueNetworks();
