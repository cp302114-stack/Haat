import { CITIES } from './config.js';

// art: which drawing the storefront uses for the product (see public/js/art.js)
// color: the product's own colour, the only saturated colour on a card
const P = (sku, name, brand, category, price, mrp, art, color, description, tags) => ({
  sku, name, brand, category, price, mrp, art, color, description, tags,
});

export const PRODUCTS = [
  // Electronics
  P('EL-1001', 'Air Bluetooth Earphones', 'Dhun', 'Electronics', 1499, 2299, 'earphones', '#1f6f78',
    'True wireless earphones with a pocket charging case, 24 hours of total playback and a low-latency mode for video.',
    ['earbuds', 'wireless', 'headphones', 'bluetooth', 'tws']),
  P('EL-1002', 'Bass Neckband Earphones', 'Dhun', 'Electronics', 999, 1499, 'neckband', '#c2542d',
    'Neckband Bluetooth earphones with magnetic buds, 30 hour battery and fast charge that gives 10 hours in 10 minutes.',
    ['neckband', 'wireless', 'bluetooth', 'headset', 'sports']),
  P('EL-1003', 'Mini Bluetooth Speaker', 'Tarang', 'Electronics', 1799, 2499, 'speaker', '#d9a22b',
    'Palm sized speaker with 12 hours of playtime, a splash proof body and a strap that clips to a bag.',
    ['speaker', 'bluetooth', 'portable', 'music', 'waterproof']),
  P('EL-1004', 'Boom 20W Portable Speaker', 'Tarang', 'Electronics', 3499, 4999, 'boombox', '#2b3a55',
    'Twenty watt speaker with dual passive radiators, 18 hours of playtime and a USB-C port that charges your phone.',
    ['speaker', 'bluetooth', 'party', 'bass', 'outdoor']),
  P('EL-1005', 'Fit Smartwatch', 'Kora', 'Electronics', 2999, 4499, 'watch', '#2f2f33',
    'Round AMOLED smartwatch with heart rate, sleep and step tracking, 100 sports modes and a 7 day battery.',
    ['smartwatch', 'fitness', 'tracker', 'watch', 'wearable']),
  P('EL-1006', 'Active Smart Band', 'Kora', 'Electronics', 1799, 2599, 'band', '#b4443c',
    'Slim fitness band with SpO2, heart rate and 14 day battery. Water resistant to 50 metres.',
    ['band', 'fitness', 'tracker', 'watch', 'wearable']),
  P('EL-1007', '10000 mAh Power Bank', 'Vayu', 'Electronics', 1299, 1799, 'powerbank', '#3f6d4e',
    'Compact 10000 mAh power bank with 22.5W fast charging, two outputs and a USB-C input.',
    ['powerbank', 'charger', 'battery', 'fast charge', 'travel']),
  P('EL-1008', '20000 mAh Fast Charge Power Bank', 'Vayu', 'Electronics', 2199, 2999, 'powerbank', '#34495e',
    'Twenty thousand mAh power bank with 45W output that can charge a phone and a tablet together.',
    ['powerbank', 'charger', 'battery', 'laptop', 'travel']),

  // Fashion
  P('FA-2001', 'Jaipur Weave Cotton Kurta', 'Rangrez', 'Fashion', 1299, 1799, 'kurta', '#c9692f',
    'Straight cut kurta in breathable handwoven cotton with a mandarin collar and side slits.',
    ['kurta', 'ethnic', 'cotton', 'mens', 'festive']),
  P('FA-2002', 'Block Print Short Kurta', 'Rangrez', 'Fashion', 999, 1399, 'kurta', '#2c5f7c',
    'Hand block printed short kurta in soft mulmul cotton. Pairs with jeans or chinos.',
    ['kurta', 'block print', 'ethnic', 'cotton', 'casual']),
  P('FA-2003', 'Linen Shirt in Sage', 'Nilgiri', 'Fashion', 1599, 2199, 'shirt', '#7d9a78',
    'Relaxed fit linen shirt with a button down collar. Gets softer with every wash.',
    ['shirt', 'linen', 'mens', 'summer', 'formal']),
  P('FA-2004', 'Everyday Crew Tee', 'Nilgiri', 'Fashion', 599, 899, 'tee', '#e0d6c3',
    'Heavy 180 GSM cotton crew neck tee that keeps its shape after washing.',
    ['tshirt', 't-shirt', 'tee', 'cotton', 'basics']),
  P('FA-2005', 'Canvas Sneakers', 'Kadam', 'Fashion', 1899, 2599, 'sneaker', '#d8d2c4',
    'Low top canvas sneakers with a cushioned insole and a vulcanised rubber sole.',
    ['shoes', 'sneakers', 'casual', 'canvas', 'footwear']),
  P('FA-2006', 'Road Lite Running Shoes', 'Kadam', 'Fashion', 3299, 4499, 'sneaker', '#e2582f',
    'Lightweight running shoes with a breathable knit upper and a responsive foam midsole.',
    ['shoes', 'running', 'sports', 'footwear', 'trainers']),
  P('FA-2007', 'Daypack 22L', 'Sahyadri', 'Fashion', 1499, 1999, 'bag', '#394b3a',
    'Water resistant 22 litre backpack with a padded 15 inch laptop sleeve and a hidden back pocket.',
    ['backpack', 'bag', 'laptop', 'college', 'office']),
  P('FA-2008', 'Weekender Duffel', 'Sahyadri', 'Fashion', 2499, 3299, 'duffel', '#a0562f',
    'Forty litre duffel with a shoe compartment, a trolley strap and a detachable shoulder strap.',
    ['duffel', 'bag', 'travel', 'gym', 'weekend']),

  // Home and Kitchen
  P('HK-3001', 'Steel Electric Kettle 1.5L', 'Chulha', 'Home and Kitchen', 1199, 1699, 'kettle', '#9aa3a8',
    'Stainless steel kettle with auto shut off, boil dry protection and a cool touch handle.',
    ['kettle', 'electric', 'kitchen', 'tea', 'steel']),
  P('HK-3002', 'Insulated Steel Bottle 750 ml', 'Chulha', 'Home and Kitchen', 799, 1099, 'bottle', '#2d6a6a',
    'Double wall vacuum bottle that keeps drinks cold for 24 hours and hot for 12.',
    ['bottle', 'flask', 'steel', 'insulated', 'water']),
  P('HK-3003', 'Copper Water Bottle 1L', 'Chulha', 'Home and Kitchen', 899, 1299, 'bottle', '#b8693a',
    'Pure copper bottle with a leak proof screw cap, made the traditional way.',
    ['bottle', 'copper', 'water', 'ayurveda', 'health']),
  P('HK-3004', 'Rechargeable Reading Lamp', 'Diya', 'Home and Kitchen', 1399, 1899, 'lamp', '#d9a63b',
    'Cordless desk lamp with three colour temperatures, a touch dimmer and 20 hours on a charge.',
    ['lamp', 'light', 'desk', 'study', 'rechargeable']),
  P('HK-3005', 'Ceramic Chai Mugs, Set of 2', 'Diya', 'Home and Kitchen', 549, 799, 'mug', '#3b5c8a',
    'Two hand glazed stoneware mugs, 280 ml each, dishwasher and microwave safe.',
    ['mug', 'cup', 'chai', 'ceramic', 'tea']),
  P('HK-3006', 'Glass Storage Jars, Set of 3', 'Chulha', 'Home and Kitchen', 699, 999, 'jar', '#7aa5a6',
    'Airtight borosilicate jars with bamboo lids for dal, rice and spices.',
    ['jar', 'storage', 'kitchen', 'glass', 'containers']),
  P('HK-3007', 'Cast Iron Dosa Tawa 28cm', 'Chulha', 'Home and Kitchen', 1099, 1499, 'tawa', '#3a3836',
    'Pre seasoned cast iron tawa with a long handle that holds heat evenly for crisp dosas.',
    ['tawa', 'dosa', 'cast iron', 'cookware', 'kitchen']),
  P('HK-3008', 'Stainless Steel Tiffin, 3 Tier', 'Chulha', 'Home and Kitchen', 749, 999, 'tiffin', '#a9b0b5',
    'Three tier leak resistant tiffin with a carry handle that stacks neatly in a bag.',
    ['tiffin', 'lunch box', 'steel', 'office', 'school']),

  // Beauty and Care
  P('BC-4001', 'Vitamin C Serum 30 ml', 'Ritu', 'Beauty and Care', 649, 899, 'serum', '#e08a2e',
    'Ten percent vitamin C with niacinamide in a light water based serum for daily use.',
    ['serum', 'face', 'skincare', 'vitamin c', 'glow']),
  P('BC-4002', 'Aloe Moisturiser 100 g', 'Ritu', 'Beauty and Care', 349, 499, 'jar', '#79a76b',
    'Non sticky gel cream with aloe and hyaluronic acid for oily and combination skin.',
    ['moisturiser', 'moisturizer', 'aloe', 'cream', 'skincare']),
  P('BC-4003', 'Neem and Tulsi Face Wash', 'Ritu', 'Beauty and Care', 249, 349, 'tube', '#5b8f5a',
    'Soap free gel face wash that clears oil without drying. 100 ml.',
    ['face wash', 'neem', 'tulsi', 'cleanser', 'acne']),
  P('BC-4004', 'Sunscreen SPF 50 PA++++', 'Ritu', 'Beauty and Care', 449, 599, 'tube', '#e3b13a',
    'Lightweight, no white cast sunscreen for Indian skin tones. 50 g.',
    ['sunscreen', 'spf', 'sun', 'skincare', 'summer']),
  P('BC-4005', 'Bhringraj Hair Oil 200 ml', 'Ritu', 'Beauty and Care', 399, 549, 'serum', '#4b6b3a',
    'Cold pressed coconut oil infused with bhringraj and amla. No mineral oil.',
    ['hair oil', 'bhringraj', 'amla', 'coconut', 'haircare']),
  P('BC-4006', 'Beard Trimmer, Cordless', 'Kora', 'Beauty and Care', 1199, 1799, 'trimmer', '#2f3a40',
    'Cordless trimmer with 20 length settings, a steel blade and 60 minutes of runtime.',
    ['trimmer', 'beard', 'grooming', 'shaver', 'mens']),

  // Sports and Fitness
  P('SF-5001', 'Yoga Mat 6 mm', 'Dum', 'Sports and Fitness', 899, 1299, 'mat', '#6e5a8a',
    'Anti skid TPE mat with alignment lines and a carry strap, 183 by 61 cm.',
    ['yoga', 'mat', 'exercise', 'fitness', 'gym']),
  P('SF-5002', 'Hex Dumbbells 5 kg, Pair', 'Dum', 'Sports and Fitness', 1799, 2499, 'dumbbell', '#3c3c40',
    'Rubber coated hex dumbbells that do not roll. Sold as a pair of 5 kg each.',
    ['dumbbell', 'weights', 'gym', 'strength', 'home workout']),
  P('SF-5003', 'Speed Skipping Rope', 'Dum', 'Sports and Fitness', 299, 449, 'rope', '#d1493b',
    'Adjustable steel cable rope with ball bearings and foam handles.',
    ['skipping', 'rope', 'cardio', 'fitness', 'jump rope']),
  P('SF-5004', 'Resistance Bands, Set of 5', 'Dum', 'Sports and Fitness', 499, 799, 'rope', '#e0a12e',
    'Five latex loop bands from light to extra heavy, with a mesh pouch.',
    ['bands', 'resistance', 'stretch', 'workout', 'physio']),
  P('SF-5005', 'Sports Sipper 1 L', 'Dum', 'Sports and Fitness', 399, 599, 'bottle', '#2f7fa8',
    'BPA free sipper with a flip spout, a time marker and a carry loop.',
    ['bottle', 'sipper', 'gym', 'water', 'sports']),
  P('SF-5006', 'Cricket Bat, Kashmir Willow', 'Kadam', 'Sports and Fitness', 1899, 2699, 'bat', '#c79a5b',
    'Full size Kashmir willow bat with a cane handle, ready to play.',
    ['cricket', 'bat', 'sports', 'willow', 'outdoor']),

  // Books and Stationery
  P('BS-6001', 'Hardbound Notebook A5, Dotted', 'Panna', 'Books and Stationery', 349, 499, 'notebook', '#8c3b2e',
    'Hardbound A5 notebook with 192 pages of 100 GSM dotted paper and an elastic closure.',
    ['notebook', 'journal', 'diary', 'dotted', 'stationery']),
  P('BS-6002', 'Ruled Diary 2027', 'Panna', 'Books and Stationery', 299, 399, 'notebook', '#2c4a6b',
    'Day per page diary for 2027 with a ribbon marker and a pocket for notes.',
    ['diary', 'planner', 'notebook', '2027', 'office']),
  P('BS-6003', 'Gel Pen Set of 10', 'Panna', 'Books and Stationery', 199, 299, 'pen', '#2d4f9e',
    'Ten smooth gel pens in assorted inks with a 0.5 mm tip.',
    ['pen', 'gel pen', 'writing', 'stationery', 'school']),
  P('BS-6004', 'Pocket Guide to Indian Spices', 'Panna', 'Books and Stationery', 449, 599, 'book', '#b8742f',
    'A pocket sized illustrated guide to forty common spices, how to store them and when to add them.',
    ['book', 'cooking', 'spices', 'guide', 'recipes']),
  P('BS-6005', 'Sketchbook A4, 140 GSM', 'Panna', 'Books and Stationery', 399, 549, 'notebook', '#d7cdb8',
    'Acid free A4 sketchbook with 60 sheets of heavyweight cartridge paper.',
    ['sketchbook', 'drawing', 'art', 'paper', 'stationery']),
  P('BS-6006', 'Fountain Pen with Converter', 'Panna', 'Books and Stationery', 799, 1099, 'pen', '#1f3d36',
    'Steel nib fountain pen in a matte barrel. Comes with a converter and two cartridges.',
    ['pen', 'fountain pen', 'writing', 'calligraphy', 'gift']),
];

// Small deterministic generator so every start gives the same shelves.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Returns [{ sku, city, qty }] for every product in every city.
export function buildInventory() {
  const rows = [];
  PRODUCTS.forEach((p, i) => {
    CITIES.forEach((city, c) => {
      const r = rng(i * 131 + c * 17 + 7)();
      let qty;
      if (r < 0.08) qty = 0;
      else if (r < 0.2) qty = 1 + Math.floor(r * 25) % 4;
      else qty = 8 + Math.floor(r * 100) % 40;
      rows.push({ sku: p.sku, city, qty });
    });
  });
  return rows;
}

// The product used by the "last unit" demo.
export const RACE_SKU = 'EL-1005';
