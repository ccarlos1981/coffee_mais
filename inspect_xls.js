const XLSX = require('xlsx');

function readFirstRows() {
  const filePath = './Dados da Coffee mais/VisãoHistórica KA (2).xlsb';
  console.log('Loading file...');
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  
  console.log('Sheets found:', workbook.SheetNames);
  
  const sheetName = 'ÚltimasVendas';
  
  if (workbook.SheetNames.includes(sheetName)) {
    console.log(`Reading sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(JSON.stringify(rawData.slice(0, 15), null, 2));
  } else {
    // try first sheet
    const sName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sName]);
    console.log(`First sheet ${sName}:`, JSON.stringify(data.slice(0, 3), null, 2));
  }
}

readFirstRows();
