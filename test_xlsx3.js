const xlsx = require('xlsx');
const filePath = '/Users/cristiano/Desktop/00.Realizado Jan 2025 a 18mai26.xlsx';
try {
  const workbook = xlsx.readFile(filePath);
  const worksheet = workbook.Sheets['BASE'];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('BASE Headers:', data[0]);
} catch (e) {
  console.error(e);
}
