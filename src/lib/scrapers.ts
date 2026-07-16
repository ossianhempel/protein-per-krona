// Product matching and weight parsing logic for grocery scrapers

export interface ScrapedProductInput {
  sourceId: string;
  name: string;
  price: number;
  rawWeight: string; // e.g. "500g", "1kg", "6-pack"
  store: 'Willys' | 'Coop';
  url: string;
  imageUrl: string;
}

// Map a scraped product to the closest Livsmedelsverket food ID
export function mapProductToFoodId(name: string): number | null {
  const n = name.toLowerCase();
  
  // Whey Protein Supplements
  if (n.includes('vassle') || n.includes('whey') || (n.includes('protein') && n.includes('pulver') && (n.includes('core') || n.includes('star') || n.includes('gold') || n.includes('isolate')))) {
    return 990001;
  }
  // Casein Supplements
  if (n.includes('kasein') || n.includes('casein')) {
    return 990002;
  }
  // Soy protein Supplements
  if (n.includes('sojaprotein') || n.includes('soy protein')) {
    return 990003;
  }
  
  // Eggs
  if (n.includes('ägg')) {
    if (n.includes('äggvita') || n.includes('vita')) {
      return 1437; // Äggvita rå
    }
    return 1435; // Ägg rått
  }
  
  // Cottage Cheese / Keso
  if (n.includes('keso') || n.includes('cottage cheese')) {
    return 70; // Färskost cottage cheese naturell fett 4%
  }
  
  // Kvarg (Smaksatt vs Naturell)
  if (n.includes('kvarg')) {
    if (n.includes('smak') || n.includes('vanilj') || n.includes('jordgubb') || n.includes('bär') || n.includes('hallon') || n.includes('blåbär') || n.includes('choklad') || n.includes('kola') || n.includes('persika') || n.includes('passion')) {
      return 6090; // Kvarg smaksatt sötningsm.
    }
    return 3243; // Kvarg naturell fett 0,2%
  }
  
  // Chicken Breast (filé)
  if (n.includes('kyckling') && (n.includes('filé') || n.includes('file') || n.includes('bröst'))) {
    return 1164; // Kyckling kött rå u. skinn
  }
  
  // Tuna (canned in water)
  if (n.includes('tonfisk')) {
    return 1278; // Tonfisk i vatten konserv. avrunnen
  }
  
  // Mince meat
  if (n.includes('färs')) {
    if (n.includes('bland')) {
      return 7002; // Blandfärs rå
    }
    if (n.includes('fläsk')) {
      return 7003; // Fläskfärs rå
    }
    if (n.includes('nöt') || n.includes('gulasch')) {
      if (n.includes('10%') || n.includes('12%') || n.includes('mager')) {
        return 7000; // Nötfärs 10%
      }
      return 7001; // Nötfärs 15%
    }
  }
  
  // Red Lentils / Lentils
  if (n.includes('lins') || n.includes('linser')) {
    return 884; // Linser torkade
  }
  
  // Black beans / Soybeans
  if (n.includes('bönor')) {
    if (n.includes('soja')) {
      return 887; // Sojabönor torkade
    }
  }
  
  return null;
}

// Parse package size / weight into grams
export function parseWeightInGrams(raw: string | number, name: string): number {
  if (typeof raw === 'number') {
    return raw;
  }
  
  const str = raw.toLowerCase().trim();
  const n = name.toLowerCase();
  
  // Check for egg packs
  if (n.includes('ägg') && (str.includes('st') || str.includes('pack') || str.includes('p-'))) {
    const stMatch = str.match(/(\d+)\s*(st|pack|p)/);
    if (stMatch) {
      const count = parseInt(stMatch[1], 10);
      return count * 60; // Estimate 60g per egg
    }
  }
  
  // Standard grams parsing
  if (str.endsWith('g')) {
    // Check if it's kg
    if (str.endsWith('kg')) {
      const numStr = str.replace('kg', '').trim();
      const val = parseFloat(numStr.replace(',', '.'));
      if (!isNaN(val)) return val * 1000;
    }
    
    const numStr = str.replace('g', '').trim();
    const val = parseFloat(numStr.replace(',', '.'));
    if (!isNaN(val)) return val;
  }
  
  // Case for just numbers or other shapes (like "1 kg")
  if (str.includes('kg')) {
    const parts = str.split('kg')[0].trim();
    const val = parseFloat(parts.replace(',', '.'));
    if (!isNaN(val)) return val * 1000;
  }
  
  // Default fallbacks based on product keywords if parsing fails
  if (n.includes('kvarg')) {
    if (n.includes('1000g') || n.includes('1kg') || n.includes('1 000')) return 1000;
    if (n.includes('500g') || n.includes('500 g')) return 500;
    if (n.includes('150g') || n.includes('150 g')) return 150;
    if (n.includes('250g') || n.includes('250 g')) return 250;
    return 500; // Default kvarg size
  }
  
  if (n.includes('keso') || n.includes('cottage cheese')) {
    if (n.includes('500g') || n.includes('500 g')) return 500;
    if (n.includes('250g') || n.includes('250 g')) return 250;
    return 500;
  }
  
  if (n.includes('tonfisk')) {
    if (n.includes('3-pack') || n.includes('3x')) return 3 * 150;
    return 150; // Standard canned tuna weight drained
  }
  
  return 500; // Fallback default weight
}
