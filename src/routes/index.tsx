import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState, useMemo } from 'react';
import { db } from '../db';
import { foods, scrapedProducts, priceHistory } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { Search, ShoppingBag, TrendingUp, Info, AlertTriangle, ChevronRight, X } from 'lucide-react';

// WHO/FAO 2007 Reference Pattern for Adults (mg per g of protein)
const REF_PATTERN = {
  histidine: 15,
  isoleucine: 30,
  leucine: 59,
  lysine: 45,
  metCys: 22,
  pheTyr: 38,
  threonine: 23,
  tryptophan: 6,
  valine: 39
};

export interface RankedFood {
  id: number;
  name: string;
  category: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  aas: number;
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
  bestProduct: {
    id: string;
    name: string;
    store: string;
    price: number;
    pricePerUnit: number | null;
    packageWeightG: number;
    url: string;
    imageUrl: string | null;
    proteinPerKrona: number;
    pricePer100gProtein: number;
    updatedAt: string;
  };
}

// Server function to fetch the foods ranked by protein per SEK
export const getRanking = createServerFn('GET', async (): Promise<RankedFood[]> => {
  const allFoods = db.select().from(foods).all();
  const allScraped = db.select().from(scrapedProducts).all();
  
  // Group scraped products by matched food ID and find the one that yields the highest protein per SEK
  const foodToBestProductMap = new Map<number, typeof allScraped[0]>();
  
  for (const scraped of allScraped) {
    if (!scraped.matchedFoodId) continue;
    
    // Find the matching food item to calculate protein density
    const food = allFoods.find(f => f.id === scraped.matchedFoodId);
    if (!food || food.protein <= 0.1) continue;
    
    // Calculate protein per SEK
    // protein in product = (weight in grams / 100) * protein per 100g of food
    const proteinInProduct = (scraped.packageWeightG / 100) * food.protein;
    const proteinPerKrona = proteinInProduct / scraped.price;
    
    const existing = foodToBestProductMap.get(scraped.matchedFoodId);
    if (!existing) {
      foodToBestProductMap.set(scraped.matchedFoodId, scraped);
    } else {
      const existingFood = allFoods.find(f => f.id === existing.matchedFoodId)!;
      const existingProteinInProd = (existing.packageWeightG / 100) * existingFood.protein;
      const existingProteinPerKrona = existingProteinInProd / existing.price;
      
      if (proteinPerKrona > existingProteinPerKrona) {
        foodToBestProductMap.set(scraped.matchedFoodId, scraped);
      }
    }
  }
  
  // Map foods to their best options and rank
  const ranked: RankedFood[] = [];
  
  for (const food of allFoods) {
    const bestProduct = foodToBestProductMap.get(food.id);
    if (!bestProduct) continue; // Exclude foods with no scraped buying options
    
    const proteinInProduct = (bestProduct.packageWeightG / 100) * food.protein;
    const proteinPerKrona = proteinInProduct / bestProduct.price;
    const pricePer100gProtein = bestProduct.price / (proteinInProduct / 100);
    
    ranked.push({
      id: food.id,
      name: food.name,
      category: food.category || '',
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      calories: food.calories,
      aas: food.aas || 0,
      histidine: food.histidine || 0,
      isoleucine: food.isoleucine || 0,
      leucine: food.leucine || 0,
      lysine: food.lysine || 0,
      methionine: food.methionine || 0,
      cysteine: food.cysteine || 0,
      phenylalanine: food.phenylalanine || 0,
      tyrosine: food.tyrosine || 0,
      threonine: food.threonine || 0,
      tryptophan: food.tryptophan || 0,
      valine: food.valine || 0,
      bestProduct: {
        id: bestProduct.id,
        name: bestProduct.name,
        store: bestProduct.store,
        price: bestProduct.price,
        pricePerUnit: bestProduct.pricePerUnit,
        packageWeightG: bestProduct.packageWeightG,
        url: bestProduct.url,
        imageUrl: bestProduct.imageUrl,
        proteinPerKrona: Number(proteinPerKrona.toFixed(2)),
        pricePer100gProtein: Number(pricePer100gProtein.toFixed(2)),
        updatedAt: bestProduct.updatedAt
      }
    });
  }
  
  // Sort by protein per SEK descending
  return ranked.sort((a, b) => b.bestProduct.proteinPerKrona - a.bestProduct.proteinPerKrona);
});

// Server function to fetch price history for a scraped product
export const getProductPriceHistory = createServerFn('GET', async (productId: string) => {
  return db
    .select({
      price: priceHistory.price,
      updatedAt: priceHistory.updatedAt
    })
    .from(priceHistory)
    .where(eq(priceHistory.scrapedProductId, productId))
    .orderBy(priceHistory.updatedAt)
    .all();
});

export const Route = createFileRoute('/')({
  loader: async () => {
    return getRanking();
  },
  component: App
});

function App() {
  const rankedFoods = Route.useLoaderData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Alla');
  const [selectedStores, setSelectedStores] = useState<string[]>(['willys', 'coop']);
  const [sortBy, setSortBy] = useState<'perKrona' | 'protein' | 'aas'>('perKrona');
  const [selectedFood, setSelectedFood] = useState<RankedFood | null>(null);
  const [priceHistoryData, setPriceHistoryData] = useState<{ price: number; updatedAt: string }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Categories mapping to group filters
  const categories = ['Alla', 'Mejeri & Ägg', 'Kött & Fågel', 'Fisk & Skaldjur', 'Baljväxter & Veganskt', 'Kosttillskott'];

  const categoryMap: Record<string, string[]> = {
    'Mejeri & Ägg': ['Mejeri', 'Pålägg', 'Ägg'],
    'Kött & Fågel': ['Kött', 'Kyckling, fågel'],
    'Fisk & Skaldjur': ['Fisk, skaldjur'],
    'Baljväxter & Veganskt': ['Grönsaker, baljväxter, svamp', 'Mjöl, gryn, ris', 'Pasta, ris, gryn'],
    'Kosttillskott': ['Kosttillskott']
  };

  const handleSelectFood = async (food: RankedFood) => {
    setSelectedFood(food);
    setLoadingHistory(true);
    setPriceHistoryData([]);
    try {
      const history = await getProductPriceHistory(food.bestProduct.id);
      setPriceHistoryData(history);
    } catch (e) {
      console.error('Failed to load price history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter and sort food items
  const filteredFoods = useMemo(() => {
    return rankedFoods
      .filter(item => {
        // Search query filter
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.bestProduct.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Category filter
        let matchesCategory = true;
        if (activeCategory !== 'Alla') {
          const subCats = categoryMap[activeCategory] || [];
          matchesCategory = subCats.includes(item.category);
        }
        
        // Store filter
        const matchesStore = selectedStores.includes(item.bestProduct.store);
        
        return matchesSearch && matchesCategory && matchesStore;
      })
      .sort((a, b) => {
        if (sortBy === 'protein') {
          return b.protein - a.protein;
        }
        if (sortBy === 'aas') {
          return b.aas - a.aas;
        }
        return b.bestProduct.proteinPerKrona - a.bestProduct.proteinPerKrona;
      });
  }, [rankedFoods, searchQuery, activeCategory, selectedStores, sortBy]);

  // Last update timestamp representation
  const lastUpdatedText = useMemo(() => {
    if (rankedFoods.length === 0) return '';
    const dates = rankedFoods.map(f => new Date(f.bestProduct.updatedAt).getTime());
    const maxDate = new Date(Math.max(...dates));
    return maxDate.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [rankedFoods]);

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      {/* Header and Hero */}
      <section className="mb-10 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold text-[var(--palm)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Uppdateras dagligen
            </span>
            <h1 className="display-title text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl lg:text-6xl">
              Protein per krona
            </h1>
            <p className="mt-3 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
              Optimera din plånbok och din muskeluppbyggnad. Vi jämför svenska livsmedel och matbutiker för att hitta de billigaste proteinkällorna av högsta kvalitet.
            </p>
          </div>
          {lastUpdatedText && (
            <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center sm:text-right">
              <span className="text-xs text-[var(--sea-ink-soft)] uppercase tracking-wider block">Senast synkad</span>
              <span className="text-sm font-semibold text-[var(--sea-ink)]">{lastUpdatedText}</span>
            </div>
          )}
        </div>
      </section>

      {/* Control panel (Filters, Search, Sort) */}
      <section className="island-shell mb-8 rounded-3xl p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-[var(--sea-ink-soft)]" />
            <input
              type="text"
              placeholder="Sök livsmedel eller produktnamn..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-[var(--bg-base)] py-3 pl-12 pr-4 text-sm text-[var(--sea-ink)] placeholder-[var(--sea-ink-soft)] outline-none focus:border-[var(--lagoon)] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-3.5 text-xs text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
              >
                Rensa
              </button>
            )}
          </div>
          
          {/* Supermarkets Filter */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Butiker</span>
            <div className="flex gap-2">
              {['willys', 'coop'].map(store => {
                const checked = selectedStores.includes(store);
                return (
                  <button
                    key={store}
                    onClick={() => {
                      if (checked) {
                        setSelectedStores(selectedStores.filter(s => s !== store));
                      } else {
                        setSelectedStores([...selectedStores, store]);
                      }
                    }}
                    className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                      checked
                        ? 'border-[var(--lagoon)] bg-[var(--lagoon)]/10 text-[var(--lagoon-deep)]'
                        : 'border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]'
                    }`}
                  >
                    {store}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">Sortera efter</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon)] transition"
            >
              <option value="perKrona">Mest protein per SEK (g/kr)</option>
              <option value="protein">Proteinhalt (%)</option>
              <option value="aas">Proteinkvalitet (AAS)</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
          {categories.map(cat => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[var(--sea-ink)] text-white'
                    : 'bg-[var(--chip-bg)] border border-[var(--line)] text-[var(--sea-ink-soft)] hover:bg-[var(--link-bg-hover)]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Ranking Grid */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredFoods.length > 0 ? (
          filteredFoods.map((item, index) => {
            const isTop3 = index < 3 && sortBy === 'perKrona' && searchQuery === '' && activeCategory === 'Alla';
            
            return (
              <article
                key={item.id}
                onClick={() => handleSelectFood(item)}
                className={`island-shell group flex flex-col justify-between overflow-hidden rounded-3xl p-6 cursor-pointer hover:translate-y-[-2px] transition duration-200 ${
                  isTop3 ? 'border-amber-400/40 relative shadow-[0_20px_40px_rgba(245,158,11,0.05)]' : ''
                }`}
              >
                {/* Top Badge for rank */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 && isTop3 ? 'bg-amber-400 text-amber-950' :
                      index === 1 && isTop3 ? 'bg-slate-300 text-slate-900' :
                      index === 2 && isTop3 ? 'bg-amber-600 text-white' :
                      'bg-[var(--line)] text-[var(--sea-ink-soft)]'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-[var(--sea-ink-soft)] font-semibold">
                      {item.category}
                    </span>
                  </div>
                  
                  {/* AAS score badge */}
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    item.aas >= 100
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : item.aas >= 80
                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        : 'bg-red-500/10 text-red-600 border border-red-500/20'
                  }`}>
                    AAS {Math.round(item.aas)}%
                  </span>
                </div>

                {/* Food title */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-[var(--sea-ink)] group-hover:text-[var(--lagoon-deep)] transition duration-200">
                    {item.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--sea-ink-soft)]">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Bästa deal på: <strong className="font-semibold">{item.bestProduct.store}</strong></span>
                  </div>
                </div>

                {/* Score Panel */}
                <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl bg-[var(--bg-base)]/50 border border-[var(--line)] p-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--sea-ink-soft)] tracking-wide block">Protein / SEK</span>
                    <span className="text-2xl font-black text-[var(--sea-ink)]">{item.bestProduct.proteinPerKrona} <span className="text-sm font-normal text-[var(--sea-ink-soft)]">g/kr</span></span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--sea-ink-soft)] tracking-wide block">Kr / 100g Protein</span>
                    <span className="text-2xl font-black text-[var(--sea-ink)]">{item.bestProduct.pricePer100gProtein} <span className="text-sm font-normal text-[var(--sea-ink-soft)]">kr</span></span>
                  </div>
                </div>

                {/* Product spec summary & macro progress */}
                <div>
                  <p className="line-clamp-1 mb-3 text-xs italic text-[var(--sea-ink-soft)]">
                    "{item.bestProduct.name}"
                  </p>
                  
                  {/* Macros line bar */}
                  <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[var(--sea-ink)]">Protein: {item.protein}%</span>
                      <span className="text-[var(--sea-ink-soft)]">kcal: {Math.round(item.calories)}</span>
                    </div>
                    {/* Visual bar split */}
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                      <div className="bg-[var(--palm)]" style={{ width: `${(item.protein / 100) * 100}%` }} title="Protein" />
                      <div className="bg-amber-400" style={{ width: `${(item.carbs / 100) * 100}%` }} title="Carbs" />
                      <div className="bg-rose-400" style={{ width: `${(item.fat / 100) * 100}%` }} title="Fat" />
                    </div>
                  </div>
                  
                  {/* Click to open details */}
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[var(--lagoon-deep)] pt-2 border-t border-dashed border-[var(--line)]">
                    <span>Detaljerad analys</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="col-span-full island-shell rounded-3xl p-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-bold text-[var(--sea-ink)] mb-2">Inga träffar hittades</h3>
            <p className="text-[var(--sea-ink-soft)] text-sm">
              Prova att ändra din sökning eller justera filterpiller/butiksinställningar.
            </p>
          </div>
        )}
      </section>

      {/* Details Modal */}
      {selectedFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="island-shell relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-[2rem] overflow-hidden shadow-2xl animate-scale-up">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-[var(--line)] p-6 sm:p-8 bg-[var(--surface-strong)]">
              <div>
                <span className="text-xs uppercase tracking-wider text-[var(--sea-ink-soft)] font-semibold">
                  {selectedFood.category}
                </span>
                <h2 className="text-2xl font-bold text-[var(--sea-ink)] sm:text-3xl mt-1">
                  {selectedFood.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedFood(null)}
                className="rounded-full border border-[var(--line)] bg-[var(--chip-bg)] p-2 text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-[var(--foam)]">
              {/* Product deal panel */}
              <div className="grid gap-6 sm:grid-cols-5 items-center rounded-3xl bg-[var(--surface-strong)] border border-[var(--line)] p-6">
                <div className="sm:col-span-1 flex items-center justify-center bg-[var(--bg-base)]/50 rounded-2xl aspect-square border border-[var(--line)] p-2">
                  {selectedFood.bestProduct.imageUrl ? (
                    <img
                      src={selectedFood.bestProduct.imageUrl}
                      alt={selectedFood.bestProduct.name}
                      className="max-h-full max-w-full object-contain rounded-lg"
                    />
                  ) : (
                    <ShoppingBag className="h-10 w-10 text-[var(--sea-ink-soft)]" />
                  )}
                </div>
                <div className="sm:col-span-4 space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--palm)] tracking-wide bg-[var(--palm)]/10 px-2 py-0.5 rounded">
                      Bästa köpalternativ just nu
                    </span>
                    <h4 className="font-bold text-[var(--sea-ink)] text-base mt-2">
                      {selectedFood.bestProduct.name}
                    </h4>
                    <p className="text-xs text-[var(--sea-ink-soft)] mt-1">
                      Finns på <strong className="font-semibold capitalize">{selectedFood.bestProduct.store}</strong> för <strong>{selectedFood.bestProduct.price} kr</strong> ({selectedFood.bestProduct.packageWeightG}g).
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={selectedFood.bestProduct.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sea-ink)] px-4 py-2 text-xs font-bold text-white no-underline hover:bg-[var(--sea-ink-soft)] transition"
                    >
                      Köp online på {selectedFood.bestProduct.store}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Nutrition and values grid */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Macros details */}
                <div className="space-y-4 rounded-3xl bg-[var(--surface-strong)] border border-[var(--line)] p-6">
                  <h4 className="font-bold text-[var(--sea-ink)] text-sm border-b border-[var(--line)] pb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--palm)]" />
                    Näringsvärde per 100g
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[var(--bg-base)]/50 p-3 border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--sea-ink-soft)] block">Protein</span>
                      <span className="text-lg font-extrabold text-[var(--palm)]">{selectedFood.protein} g</span>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-base)]/50 p-3 border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--sea-ink-soft)] block">Kalorier</span>
                      <span className="text-lg font-extrabold text-[var(--sea-ink)]">{Math.round(selectedFood.calories)} kcal</span>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-base)]/50 p-3 border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--sea-ink-soft)] block">Kolhydrater</span>
                      <span className="text-lg font-extrabold text-amber-600">{selectedFood.carbs} g</span>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-base)]/50 p-3 border border-[var(--line)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--sea-ink-soft)] block">Fett</span>
                      <span className="text-lg font-extrabold text-rose-500">{selectedFood.fat} g</span>
                    </div>
                  </div>
                </div>

                {/* Score analysis details */}
                <div className="space-y-4 rounded-3xl bg-[var(--surface-strong)] border border-[var(--line)] p-6">
                  <h4 className="font-bold text-[var(--sea-ink)] text-sm border-b border-[var(--line)] pb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--lagoon)]" />
                    Kostnadsanalys
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-[var(--line)] pb-2 text-xs">
                      <span className="text-[var(--sea-ink-soft)]">Protein per SEK:</span>
                      <span className="font-bold text-[var(--sea-ink)]">{selectedFood.bestProduct.proteinPerKrona} g/kr</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--line)] pb-2 text-xs">
                      <span className="text-[var(--sea-ink-soft)]">Kostnad per 100g rent protein:</span>
                      <span className="font-bold text-[var(--sea-ink)]">{selectedFood.bestProduct.pricePer100gProtein} SEK</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--line)] pb-2 text-xs">
                      <span className="text-[var(--sea-ink-soft)]">Pris per kg av varan:</span>
                      <span className="font-bold text-[var(--sea-ink)]">
                        {selectedFood.bestProduct.pricePerUnit
                          ? `${selectedFood.bestProduct.pricePerUnit} kr/kg`
                          : `${((selectedFood.bestProduct.price / selectedFood.bestProduct.packageWeightG) * 1000).toFixed(2)} kr/kg`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--sea-ink-soft)]">Proteinkvalitet (AAS):</span>
                      <span className={`font-bold ${
                        selectedFood.aas >= 100 ? 'text-emerald-600' : 'text-amber-600'
                      }`}>{Math.round(selectedFood.aas)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price history visualizer */}
              <div className="rounded-3xl bg-[var(--surface-strong)] border border-[var(--line)] p-6">
                <h4 className="font-bold text-[var(--sea-ink)] text-sm border-b border-[var(--line)] pb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--lagoon-deep)]" />
                  Prishistorik för denna produkt (SEK)
                </h4>
                
                <div className="mt-4">
                  {loadingHistory ? (
                    <div className="h-40 flex items-center justify-center text-xs text-[var(--sea-ink-soft)]">
                      Laddar historiska priser...
                    </div>
                  ) : priceHistoryData.length > 1 ? (
                    /* Simple SVG line chart sparkline */
                    <div className="space-y-2">
                      <div className="h-40 w-full relative">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {(() => {
                            const prices = priceHistoryData.map(h => h.price);
                            const min = Math.min(...prices) * 0.95; // 5% padding
                            const max = Math.max(...prices) * 1.05; // 5% padding
                            const range = max - min;
                            
                            const points = priceHistoryData.map((h, i) => {
                              const x = (i / (priceHistoryData.length - 1)) * 100;
                              const y = 100 - ((h.price - min) / (range || 1)) * 100;
                              return `${x},${y}`;
                            }).join(' ');
                            
                            return (
                              <>
                                <path
                                  d={`M 0,100 L ${points} L 100,100 Z`}
                                  fill="url(#gradient)"
                                  opacity="0.1"
                                />
                                <polyline
                                  fill="none"
                                  stroke="var(--lagoon-deep)"
                                  strokeWidth="2.5"
                                  points={points}
                                />
                                <defs>
                                  <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="var(--lagoon)" />
                                    <stop offset="100%" stopColor="transparent" />
                                  </linearGradient>
                                </defs>
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                      <div className="flex justify-between text-[10px] text-[var(--sea-ink-soft)] uppercase font-semibold">
                        <span>{new Date(priceHistoryData[0].updatedAt).toLocaleDateString('sv-SE')}</span>
                        <span>Senaste: {priceHistoryData[priceHistoryData.length - 1].price} kr</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-xs text-[var(--sea-ink-soft)] border border-dashed border-[var(--line)] rounded-2xl">
                      Priset har varit stabilt på {selectedFood.bestProduct.price} kr sedan insamlingen startade.
                    </div>
                  )}
                </div>
              </div>

              {/* Amino Acid Score & Quality Visualizer */}
              <div className="rounded-3xl bg-[var(--surface-strong)] border border-[var(--line)] p-6">
                <h4 className="font-bold text-[var(--sea-ink)] text-sm border-b border-[var(--line)] pb-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-[var(--palm)]" />
                    Proteinkvalitet & Aminosyraprofil (mg per g protein)
                  </span>
                  <span className="text-xs text-[var(--sea-ink-soft)] font-normal">
                    Referensmönster: WHO/FAO 2007 (Adult)
                  </span>
                </h4>
                
                {selectedFood.protein <= 0.1 ? (
                  <p className="text-xs text-rose-500 pt-4">Inget protein i denna källa.</p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {(() => {
                      // Calculate concentration (mg of AA per g protein in food)
                      const getConc = (valMg100g: number) => {
                        return valMg100g / (selectedFood.protein || 1);
                      };
                      
                      const aminoAcids = [
                        { name: 'Histidin', key: 'histidine', value: getConc(selectedFood.histidine), ref: REF_PATTERN.histidine },
                        { name: 'Isoleucin (BCAA)', key: 'isoleucine', value: getConc(selectedFood.isoleucine), ref: REF_PATTERN.isoleucine },
                        { name: 'Leucin (BCAA)', key: 'leucine', value: getConc(selectedFood.leucine), ref: REF_PATTERN.leucine },
                        { name: 'Lysin', key: 'lysine', value: getConc(selectedFood.lysine), ref: REF_PATTERN.lysine },
                        { name: 'Met + Cys (Svavelhaltiga)', key: 'metCys', value: getConc(selectedFood.methionine + selectedFood.cysteine), ref: REF_PATTERN.metCys },
                        { name: 'Phe + Tyr (Aromatiska)', key: 'pheTyr', value: getConc(selectedFood.phenylalanine + selectedFood.tyrosine), ref: REF_PATTERN.pheTyr },
                        { name: 'Treonin', key: 'threonine', value: getConc(selectedFood.threonine), ref: REF_PATTERN.threonine },
                        { name: 'Tryptofan', key: 'tryptophan', value: getConc(selectedFood.tryptophan), ref: REF_PATTERN.tryptophan },
                        { name: 'Valin (BCAA)', key: 'valine', value: getConc(selectedFood.valine), ref: REF_PATTERN.valine }
                      ];
                      
                      return (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {aminoAcids.map(aa => {
                            const ratio = aa.value / aa.ref;
                            const score = Math.round(ratio * 100);
                            const isLimiting = score < 100;
                            
                            return (
                              <div key={aa.key} className="space-y-1.5 rounded-xl border border-[var(--line)] bg-[var(--bg-base)]/30 p-3">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span className="text-[var(--sea-ink)]">{aa.name}</span>
                                  <span className={isLimiting ? 'text-rose-500 font-bold' : 'text-emerald-600 font-bold'}>
                                    {score}% {isLimiting && '⚠️'}
                                  </span>
                                </div>
                                
                                {/* Progress bar */}
                                <div className="h-2 w-full bg-[var(--line)] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isLimiting ? 'bg-rose-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(score, 120)}%` }}
                                  />
                                </div>
                                
                                <div className="flex justify-between text-[10px] text-[var(--sea-ink-soft)] font-medium">
                                  <span>{Math.round(aa.value)} mg/g</span>
                                  <span>Krav: {aa.ref} mg/g</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="border-t border-[var(--line)] p-6 bg-[var(--surface-strong)] flex justify-end">
              <button
                onClick={() => setSelectedFood(null)}
                className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-6 py-2.5 text-xs font-bold text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)] transition"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
