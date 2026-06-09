const xlsx = require('xlsx');
const filePath = '/Users/cristiano/Downloads/Base CFOP_maio.xlsx';

try {
  console.log("Reading file:", filePath);
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log("Sheet names:", sheetNames);
  
  if (sheetNames.length === 0) {
    console.log("No sheets found.");
    process.exit(1);
  }

  const sheet = workbook.Sheets[sheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total raw rows in sheet "${sheetNames[0]}": ${rawRows.length}`);
  
  console.log("\nFirst 5 rows:");
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    console.log(`Row ${i}:`, rawRows[i]);
  }
} catch (err) {
  console.error("Error:", err.message);
}
