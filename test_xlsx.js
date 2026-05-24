const xlsx = require('xlsx');
const filePath = '/Users/cristiano/Desktop/00.Realizado Jan 2025 a 18mai26.xlsx';
try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  for (let i = 0; i < 20; i++) {
    console.log(`Row ${i}:`, data[i]);
  }
} catch (e) {
  console.error(e);
}
