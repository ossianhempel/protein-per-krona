// Each ID identifies one flavour, pack size and retailer. Define a new ID for a new variant.
export const catalog = [
  {
    id: 'atron-whey-vanilla', brand: 'Atron', name: 'Wheyprotein',
    flavour: 'Vaniljdrömmar', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 750, protein: 73.8, retailer: 'Atron', source: 'shopify',
    url: 'https://atronstore.com/products/wheyprotein-750g?variant=53300758544727',
  },
  {
    id: 'ironvision-whey-brownie', brand: 'IronVision', name: 'Whey',
    flavour: 'Brownie', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 750, protein: 69.5, retailer: 'IronVision', source: 'shopify',
    url: 'https://ironvisionstore.com/products/whey-cinnamon-cereal-copy?variant=52941573325142',
  },
  {
    id: 'star-whey80-vanilla', brand: 'Star Nutrition', name: 'Whey-80',
    flavour: 'Vanilj', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 1000, protein: 76.2, retailer: 'Gymgrossisten', source: 'gymgrossisten', sku: '587',
    url: 'https://www.gymgrossisten.com/whey-80-1-kg-vanilj/587.html',
  },
  {
    id: 'body-whey100-vanilla', brand: 'Body Science', name: 'Whey 100%',
    flavour: 'Vanilla', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 1000, protein: 77, retailer: 'MM Sports', source: 'mmsports', sku: 'B2411', variant: '5148',
    url: 'https://www.mmsports.se/kosttillskott/protein/vassleproteinwhey/body-science-whey-100.html?variantid=5148',
  },
  {
    id: 'core-whey-vanilla', brand: 'Core', name: 'Whey Protein',
    flavour: 'Vanilj Milkshake', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 1000, protein: 80, retailer: 'Svenskt Kosttillskott', source: 'core', sku: '68427',
    url: 'https://www.svensktkosttillskott.se/core-whey-protein?da=1-7852,14-8',
  },
  {
    id: 'tyngre-whey-vanilla', brand: 'Tyngre', name: 'Vassle',
    flavour: 'Gammaldags vanilj', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 900, protein: 75, retailer: 'Tyngre', source: 'tyngre', sku: 'B2187',
    url: 'https://tyngre.se/kosttillskott/proteinpulver/vassle/vassle-gammaldags-vanilj',
  },
  {
    id: 'tyngre-casein-vanilla', brand: 'Tyngre', name: 'Kasein',
    flavour: 'Vaniljdrömmar', type: 'Kasein', ingredient: 'Mjölkproteinkoncentrat',
    weight: 750, protein: 79, retailer: 'Tyngre', source: 'tyngre', sku: 'B2127',
    url: 'https://tyngre.se/kosttillskott/proteinpulver/kasein/kasein-vaniljdrommar',
  },
  {
    id: 'star-soy-vanilla', brand: 'Star Nutrition', name: 'Soy Protein Isolate',
    flavour: 'Vanilj', type: 'Soja', ingredient: 'Sojaproteinisolat', vegan: true,
    weight: 1000, protein: 82.1, retailer: 'Gymgrossisten', source: 'gymgrossisten', sku: '6321-034',
    url: 'https://www.gymgrossisten.com/soy-protein-isolate-1-kg-vanilla/6321-034.html',
  },
  {
    id: 'core-soy-chocolate', brand: 'Core', name: 'Soy Protein',
    flavour: 'Choklad', type: 'Soja', ingredient: 'Sojaproteinisolat', vegan: true,
    weight: 1000, protein: 86, retailer: 'Svenskt Kosttillskott', source: 'core', sku: '58833',
    url: 'https://www.svensktkosttillskott.se/core-soy-protein?da=1-4,14-5449',
  },
  {
    id: 'tyngre-pea-chocolate-toffee', brand: 'Tyngre', name: 'Veganskt Protein',
    flavour: 'Chokladkola', type: 'Ärta', ingredient: 'Ärtproteinisolat', vegan: true,
    weight: 750, protein: 73, retailer: 'Tyngre', source: 'tyngre', sku: 'B2250',
    url: 'https://tyngre.se/kosttillskott/vegan/chokladkola-veganskt-protein',
  },
  {
    id: 'bulk-pure-whey-vanilla', brand: 'Bulk', name: 'Pure Whey Protein',
    flavour: 'Vanilj', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 1000, protein: 65, retailer: 'Bulk', source: 'bulk', sku: 'BPB-WPC8-VANI-1000',
    url: 'https://www.bulk.com/se/products/pure-whey-protein-es/bpb-wpc8-0000?o=MTc5LTI1LDE3OC0yNg%3D%3D',
  },
  {
    id: 'optimum-gold-standard-vanilla', brand: 'Optimum Nutrition', name: 'Gold Standard 100% Whey',
    flavour: 'Vanilla Ice Cream', type: 'Vassle', ingredient: 'Vassleisolat, koncentrat och hydrolyserat isolat',
    weight: 780, protein: 81.6, retailer: 'Gymgrossisten', source: 'gymgrossisten', sku: '6947-1165241',
    url: 'https://www.gymgrossisten.com/100-whey-gold-std-780-g-vanilla-ice-cream/6947-1165241.html',
  },
  {
    id: 'gaam-whey-vanilla', brand: 'GAAM', name: 'Whey',
    flavour: 'Delicious Vanilla', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 900, protein: 74, retailer: 'Proteinbolaget', source: 'proteinbolaget', sku: 'PB-3351-1',
    url: 'https://proteinbolaget.se/products/gaam-whey-900-g?variant=53563808317778',
  },
  {
    id: 'myprotein-impact-whey-vanilla', brand: 'Myprotein', name: 'Impact Whey Protein',
    flavour: 'Vanilj', type: 'Vassle', ingredient: 'Vassleproteinkoncentrat',
    weight: 900, protein: 72, retailer: 'Myprotein', source: 'myprotein', sku: '17712277',
    url: 'https://www.myprotein.se/p/kosttillskott/myprotein-impact-whey-protein/10530943/?variation=17712277',
  },
];
