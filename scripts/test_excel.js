const ExcelJS = require('exceljs');
const filePath = '/Users/cristiano/Desktop/00.Realizado Jan 2025 a 18mai26.xlsx';

async function run() {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: 'emit'
  });
  
  let i = 0;
  for await (const worksheetReader of workbook) {
    if (worksheetReader.name !== 'BASE') continue;
    let rowCount = 0;
    for await (const row of worksheetReader) {
      if (rowCount === 1) {
        console.log(JSON.stringify(row.values, null, 2));
        break;
      }
      rowCount++;
    }
  }
}
run().catch(console.error);
