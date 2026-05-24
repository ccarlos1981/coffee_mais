const xlsx = require('xlsx');
const filePath = '/Users/cristiano/Desktop/00.Realizado Jan 2025 a 18mai26.xlsx';
try {
  const workbook = xlsx.readFile(filePath);
  console.log('Keys of Sheets:', Object.keys(workbook.Sheets));
} catch (e) {
  console.error(e);
}
