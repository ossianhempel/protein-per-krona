import XLSX from 'xlsx';

const EXCEL_PATH = '/Users/ossianhempel/.gemini/antigravity/brain/cc075396-6bb8-4c42-98be-fd2dffefe7b4/scratch/LivsmedelsDB.xlsx';

function main() {
  console.log('Loading workbook...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  console.log('Sheet names:', workbook.SheetNames);
  
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  
  // Read first 5 rows
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  console.log('Sheet range:', sheet['!ref']);
  
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  console.log('First 5 rows:');
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    console.log(`Row ${i}:`, rows[i].slice(0, 15), '...');
  }
}

main();
