const xlsx = require('xlsx');
const filePath = '/Users/cristiano/Desktop/00.Realizado Jan 2025 a 18mai26.xlsx';
try {
  const workbook = xlsx.readFile(filePath);
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    console.log(`Sheet: ${sheetName}, Range: ${worksheet['!ref']}`);
  });
} catch (e) {
  console.error(e);
}
