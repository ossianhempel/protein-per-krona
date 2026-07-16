import XLSX from 'xlsx';
import { db } from '../db';
import { foods } from '../db/schema';

const EXCEL_PATH = '/Users/ossianhempel/.gemini/antigravity/brain/cc075396-6bb8-4c42-98be-fd2dffefe7b4/scratch/LivsmedelsDB.xlsx';

// WHO/FAO 2007 Reference Pattern for Adults (mg per g of protein)
const REF_PATTERN = {
  histidine: 15,
  isoleucine: 30,
  leucine: 59,
  lysine: 45,
  metCys: 22, // Methionine + Cysteine
  pheTyir: 38, // Phenylalanine + Tyrosine
  threonine: 23,
  tryptophan: 6,
  valine: 39
};

// Essential Amino Acid profiles by food category (mg per g of protein)
const AA_PROFILES: Record<string, {
  histidine: number;
  isoleucine: number;
  leucine: number;
  lysine: number;
  methionine: number;
  cysteine: number;
  phenylalanine: number;
  tyrosine: number;
  threonine: number;
  tryptophan: number;
  valine: number;
}> = {
  // Complete animal protein
  animal: {
    histidine: 25,
    isoleucine: 48,
    leucine: 80,
    lysine: 70,
    methionine: 25,
    cysteine: 10, // Met+Cys = 35 (Ref = 22)
    phenylalanine: 40,
    tyrosine: 35, // Phe+Tyr = 75 (Ref = 38)
    threonine: 40,
    tryptophan: 12,
    valine: 50
  },
  // Soy protein
  soy: {
    histidine: 26,
    isoleucine: 45,
    leucine: 78,
    lysine: 62,
    methionine: 13,
    cysteine: 12, // Met+Cys = 25 (Ref = 22)
    phenylalanine: 48,
    tyrosine: 32, // Phe+Tyr = 80 (Ref = 38)
    threonine: 38,
    tryptophan: 13,
    valine: 48
  },
  // Legumes (beans, lentils) - limiting in Met+Cys
  legume: {
    histidine: 25,
    isoleucine: 40,
    leucine: 70,
    lysine: 68,
    methionine: 10,
    cysteine: 8, // Met+Cys = 18 (Ref = 22) -> AAS = 18/22 = 81.8
    phenylalanine: 42,
    tyrosine: 28, // Phe+Tyr = 70 (Ref = 38)
    threonine: 36,
    tryptophan: 9,
    valine: 45
  },
  // Grains (oats, wheat, rice) - limiting in Lysine
  grain: {
    histidine: 20,
    isoleucine: 35,
    leucine: 72,
    lysine: 28, // Limiting Lysine -> AAS = 28/45 = 62.2
    methionine: 18,
    cysteine: 14, // Met+Cys = 32 (Ref = 22)
    phenylalanine: 45,
    tyrosine: 25, // Phe+Tyr = 70 (Ref = 38)
    threonine: 32,
    tryptophan: 11,
    valine: 48
  },
  // Nuts and Seeds - limiting in Lysine
  nutSeed: {
    histidine: 24,
    isoleucine: 32,
    leucine: 60,
    lysine: 36, // Limiting Lysine -> AAS = 36/45 = 80.0
    methionine: 13,
    cysteine: 11, // Met+Cys = 24 (Ref = 22)
    phenylalanine: 40,
    tyrosine: 28, // Phe+Tyr = 68 (Ref = 38)
    threonine: 30,
    tryptophan: 10,
    valine: 44
  },
  // Potatoes and tubers
  potato: {
    histidine: 20,
    isoleucine: 38,
    leucine: 62,
    lysine: 55,
    methionine: 13,
    cysteine: 9, // Met+Cys = 22 (Ref = 22) -> AAS = 100.0
    phenylalanine: 38,
    tyrosine: 27, // Phe+Tyr = 65 (Ref = 38)
    threonine: 38,
    tryptophan: 12,
    valine: 48
  },
  // Default mixed profile (vegetables, fruits, mixed dishes)
  mixed: {
    histidine: 22,
    isoleucine: 38,
    leucine: 68,
    lysine: 45,
    methionine: 12,
    cysteine: 9, // Met+Cys = 21 (Ref = 22) -> AAS = 21/22 = 95.4
    phenylalanine: 40,
    tyrosine: 26, // Phe+Tyr = 66 (Ref = 38)
    threonine: 35,
    tryptophan: 10,
    valine: 46
  }
};

// Map Livsmedelsverket "Gruppering" to AA Profiles
function getProfileType(category: string, name: string): keyof typeof AA_PROFILES {
  const cat = category.toLowerCase();
  const n = name.toLowerCase();
  
  if (cat.includes('kött') || cat.includes('fågel') || cat.includes('fisk') || cat.includes('skaldjur') || cat.includes('ägg') || cat.includes('mjölk') || cat.includes('ost') || cat.includes('mejeri') || cat.includes('glass') || cat.includes('smör')) {
    return 'animal';
  }
  if (n.includes('soja') || n.includes('tofu')) {
    return 'soy';
  }
  if (cat.includes('baljväxt') || cat.includes('ärter') || cat.includes('bönor') || cat.includes('linser')) {
    return 'legume';
  }
  if (cat.includes('mjöl') || cat.includes('gryn') || cat.includes('ris') || cat.includes('bröd') || cat.includes('pasta') || cat.includes('flingor') || cat.includes('spannmål') || cat.includes('havre') || cat.includes('vete') || cat.includes('korn') || cat.includes('råg')) {
    return 'grain';
  }
  if (cat.includes('nötter') || cat.includes('frön') || cat.includes('mandel') || cat.includes('jordnöt')) {
    return 'nutSeed';
  }
  if (cat.includes('potatis') || n.includes('potatis')) {
    return 'potato';
  }
  
  return 'mixed';
}

// Calculate Amino Acid Score (AAS)
function calculateAAS(proteinG: number, profile: typeof AA_PROFILES['animal']) {
  if (proteinG <= 0.1) return 0;
  
  // Calculate scores for each amino acid
  const scores = {
    histidine: (profile.histidine / REF_PATTERN.histidine) * 100,
    isoleucine: (profile.isoleucine / REF_PATTERN.isoleucine) * 100,
    leucine: (profile.leucine / REF_PATTERN.leucine) * 100,
    lysine: (profile.lysine / REF_PATTERN.lysine) * 100,
    metCys: ((profile.methionine + profile.cysteine) / REF_PATTERN.metCys) * 100,
    pheTyir: ((profile.phenylalanine + profile.tyrosine) / REF_PATTERN.pheTyir) * 100,
    threonine: (profile.threonine / REF_PATTERN.threonine) * 100,
    tryptophan: (profile.tryptophan / REF_PATTERN.tryptophan) * 100,
    valine: (profile.valine / REF_PATTERN.valine) * 100
  };
  
  // AAS is the minimum of all essential amino acid scores
  return Math.min(...Object.values(scores));
}

function main() {
  console.log('Loading Excel from:', EXCEL_PATH);
  const workbook = XLSX.readFile(EXCEL_PATH);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  // Headers are in Row 2
  const headers = rows[2] as string[];
  const foodRows = rows.slice(3); // Data starts from Row 3
  
  // Helper to get index of a column
  const getColIndex = (name: string) => headers.indexOf(name);
  
  const nameIdx = getColIndex('Livsmedelsnamn');
  const numIdx = getColIndex('Livsmedelsnummer');
  const catIdx = getColIndex('Gruppering');
  const kcalIdx = getColIndex('Energi (kcal)');
  const fatIdx = getColIndex('Fett, totalt (g)');
  const protIdx = getColIndex('Protein (g)');
  const carbIdx = getColIndex('Kolhydrater, tillgängliga (g)');
  
  console.log(`Found ${foodRows.length} food items to import.`);
  
  // Clear existing foods
  console.log('Clearing old foods database...');
  db.delete(foods).run();
  
  console.log('Inserting foods...');
  const foodInserts: any[] = [];
  
  for (const row of foodRows) {
    if (!row[nameIdx]) continue;
    
    const id = Number(row[numIdx]);
    const name = String(row[nameIdx]);
    const category = String(row[catIdx] || '');
    const calories = Number(row[kcalIdx] || 0);
    const fat = Number(row[fatIdx] || 0);
    const protein = Number(row[protIdx] || 0);
    const carbs = Number(row[carbIdx] || 0);
    
    const profileType = getProfileType(category, name);
    const profile = AA_PROFILES[profileType];
    const aas = calculateAAS(protein, profile);
    
    // Calculate amino acids in mg per 100g of food
    // (profile values are in mg per gram of protein)
    const histidine = protein * profile.histidine;
    const isoleucine = protein * profile.isoleucine;
    const leucine = protein * profile.leucine;
    const lysine = protein * profile.lysine;
    const methionine = protein * profile.methionine;
    const cysteine = protein * profile.cysteine;
    const phenylalanine = protein * profile.phenylalanine;
    const tyrosine = protein * profile.tyrosine;
    const threonine = protein * profile.threonine;
    const tryptophan = protein * profile.tryptophan;
    const valine = protein * profile.valine;
    
    foodInserts.push({
      id,
      name,
      category,
      protein,
      carbs,
      fat,
      calories,
      histidine,
      isoleucine,
      leucine,
      lysine,
      methionine,
      cysteine,
      phenylalanine,
      tyrosine,
      threonine,
      tryptophan,
      valine,
      aas
    });
  }
  
  // Seed manual protein supplement entries since they are not in the database
  // 1. Whey Protein Concentrate (Vassleprotein)
  foodInserts.push({
    id: 990001,
    name: 'Vassleproteinkoncentrat (Whey)',
    category: 'Kosttillskott',
    protein: 75.0,
    carbs: 6.0,
    fat: 6.0,
    calories: 380,
    histidine: 75.0 * 25,
    isoleucine: 75.0 * 48,
    leucine: 75.0 * 80,
    lysine: 75.0 * 70,
    methionine: 75.0 * 25,
    cysteine: 75.0 * 10,
    phenylalanine: 75.0 * 40,
    tyrosine: 75.0 * 35,
    threonine: 75.0 * 40,
    tryptophan: 75.0 * 12,
    valine: 75.0 * 50,
    aas: calculateAAS(75.0, AA_PROFILES.animal)
  });
  
  // 2. Casein Protein (Kasein)
  foodInserts.push({
    id: 990002,
    name: 'Kaseinprotein',
    category: 'Kosttillskott',
    protein: 80.0,
    carbs: 3.0,
    fat: 2.0,
    calories: 350,
    histidine: 80.0 * 25,
    isoleucine: 80.0 * 48,
    leucine: 80.0 * 80,
    lysine: 80.0 * 70,
    methionine: 80.0 * 25,
    cysteine: 80.0 * 10,
    phenylalanine: 80.0 * 40,
    tyrosine: 80.0 * 35,
    threonine: 80.0 * 40,
    tryptophan: 80.0 * 12,
    valine: 80.0 * 50,
    aas: calculateAAS(80.0, AA_PROFILES.animal)
  });
  
  // 3. Soy Protein Isolate (Sojaproteinisolat)
  foodInserts.push({
    id: 990003,
    name: 'Sojaproteinisolat',
    category: 'Kosttillskott',
    protein: 85.0,
    carbs: 1.0,
    fat: 1.0,
    calories: 350,
    histidine: 85.0 * AA_PROFILES.soy.histidine,
    isoleucine: 85.0 * AA_PROFILES.soy.isoleucine,
    leucine: 85.0 * AA_PROFILES.soy.leucine,
    lysine: 85.0 * AA_PROFILES.soy.lysine,
    methionine: 85.0 * AA_PROFILES.soy.methionine,
    cysteine: 85.0 * AA_PROFILES.soy.cysteine,
    phenylalanine: 85.0 * AA_PROFILES.soy.phenylalanine,
    tyrosine: 85.0 * AA_PROFILES.soy.tyrosine,
    threonine: 85.0 * AA_PROFILES.soy.threonine,
    tryptophan: 85.0 * AA_PROFILES.soy.tryptophan,
    valine: 85.0 * AA_PROFILES.soy.valine,
    aas: calculateAAS(85.0, AA_PROFILES.soy)
  });
  
  // Batch insert in chunks of 100 rows (SQLite has limit on number of parameters per query)
  const chunkSize = 100;
  for (let i = 0; i < foodInserts.length; i += chunkSize) {
    const chunk = foodInserts.slice(i, i + chunkSize);
    db.insert(foods).values(chunk).run();
  }
  
  console.log(`Success! Imported ${foodInserts.length} foods into database.`);
}

main();
