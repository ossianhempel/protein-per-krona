// Each ID identifies one flavour, pack size and retailer. Define a new ID for a new variant.
export const catalog = [
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
];
