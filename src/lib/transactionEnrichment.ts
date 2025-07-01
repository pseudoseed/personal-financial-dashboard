import { Transaction } from '@prisma/client';

// Partial transaction type for API responses
export interface PartialTransaction {
  id: string;
  accountId: string;
  date: Date;
  name: string;
  amount: number;
  category?: string | null;
  merchantName?: string | null;
  locationAddress?: string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  locationPostalCode?: string | null;
  locationRegion?: string | null;
  paymentChannel?: string | null;
  paymentMethod?: string | null;
  paymentProcessor?: string | null;
  personalFinanceCategory?: string | null;
  categoryAiGranular?: string | null;
  categoryAiGeneral?: string | null;
}

// Merchant name cleaning and normalization
export interface CleanedMerchant {
  original: string;
  cleaned: string;
  normalized: string;
}

// Location context for AI categorization
export interface LocationContext {
  address: string;
  city: string;
  region: string;
  country: string;
  coordinates: string;
  formatted: string;
}

// Merchant features derived from transaction data
export interface MerchantFeatures {
  geohash: string;
  merchantType: string;
  locationContext: string;
  paymentContext: string;
  amountContext: string;
}

// Similar merchant for AI context
export interface SimilarMerchant {
  merchantName: string;
  location: string;
  category: string;
  confidence: number;
}

// Enriched transaction data
export interface EnrichedTransaction extends PartialTransaction {
  enriched: {
    cleanedMerchant: CleanedMerchant;
    locationContext: LocationContext;
    merchantFeatures: MerchantFeatures;
    aiContext: string;
  };
}

// Merchant synonym table for normalization
const MERCHANT_SYNONYMS: Record<string, string> = {
  'STBCKS': 'STARBUCKS',
  'S-BUCKS': 'STARBUCKS',
  'STARBUCKS COFFEE': 'STARBUCKS',
  'MCDONALDS': 'MCDONALDS',
  'MCD': 'MCDONALDS',
  'WALMART': 'WALMART',
  'WAL-MART': 'WALMART',
  'TARGET': 'TARGET',
  'TARGET STORE': 'TARGET',
  'SHELL': 'SHELL',
  'SHELL OIL': 'SHELL',
  'EXXON': 'EXXON',
  'EXXONMOBIL': 'EXXON',
  'SAFEWAY': 'SAFEWAY',
  'KROGER': 'KROGER',
  'KROGER CO': 'KROGER',
  'AMAZON': 'AMAZON',
  'AMAZON.COM': 'AMAZON',
  'NETFLIX': 'NETFLIX',
  'SPOTIFY': 'SPOTIFY',
  'HULU': 'HULU',
  'DISNEY': 'DISNEY',
  'DISNEY+': 'DISNEY',
  'HBO': 'HBO',
  'HBO MAX': 'HBO',
  'YOUTUBE': 'YOUTUBE',
  'YOUTUBE PREMIUM': 'YOUTUBE',
  'APPLE': 'APPLE',
  'APPLE.COM': 'APPLE',
  'GOOGLE': 'GOOGLE',
  'GOOGLE PLAY': 'GOOGLE',
  'MICROSOFT': 'MICROSOFT',
  'ADOBE': 'ADOBE',
  'DROPBOX': 'DROPBOX',
  'ZOOM': 'ZOOM',
  'SLACK': 'SLACK',
  'GITHUB': 'GITHUB',
  'FIGMA': 'FIGMA',
  'NOTION': 'NOTION',
  'CANVA': 'CANVA',
  'COSTCO': 'COSTCO',
  'SAMS CLUB': 'SAMS CLUB',
  'SAMS': 'SAMS CLUB',
  'PLANET FITNESS': 'PLANET FITNESS',
  'LA FITNESS': 'LA FITNESS',
  'GOLD GYM': 'GOLD GYM',
  'GOLDS GYM': 'GOLD GYM',
};

// Common patterns to remove from merchant names
const CLEANUP_PATTERNS = [
  /\d{4}-\d{2}-\d{2}/g, // Dates like 2025-06-15
  /\d{2}\/\d{2}\/\d{4}/g, // Dates like 06/15/2025
  /\d{5,}/g, // Long numbers (likely IDs)
  /\b[A-Z]{2}\s+\d{4,}\b/g, // Country codes with numbers
  /\b\d{3,4}\s+[A-Z]{2}\b/g, // Numbers with country codes
  /\s+CO\s*$/i, // "CO" suffix
  /\s+USA\s*$/i, // "USA" suffix
  /\s+LLC\s*$/i, // "LLC" suffix
  /\s+INC\s*$/i, // "INC" suffix
  /\s+CORP\s*$/i, // "CORP" suffix
  /\s+LTD\s*$/i, // "LTD" suffix
];

/**
 * Clean and normalize merchant names for better AI categorization
 */
export function cleanMerchantName(merchantName: string): CleanedMerchant {
  if (!merchantName) {
    return { original: '', cleaned: '', normalized: '' };
  }

  const original = merchantName.trim();
  
  // Remove cleanup patterns
  let cleaned = original;
  CLEANUP_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Remove extra whitespace and normalize
  cleaned = cleaned.replace(/\s+/g, ' ').trim().toUpperCase();
  
  // Apply synonym normalization
  let normalized = cleaned;
  Object.entries(MERCHANT_SYNONYMS).forEach(([synonym, standard]) => {
    if (cleaned.includes(synonym)) {
      normalized = cleaned.replace(synonym, standard);
    }
  });
  
  return { original, cleaned, normalized };
}

/**
 * Format location context for AI categorization
 */
export function formatLocationContext(transaction: PartialTransaction): LocationContext {
  const address = transaction.locationAddress || '';
  const city = transaction.locationCity || '';
  const region = transaction.locationRegion || '';
  const country = transaction.locationCountry || '';
  
  const coordinates = transaction.locationLat && transaction.locationLon 
    ? `${transaction.locationLat}, ${transaction.locationLon}`
    : '';
  
  const locationParts = [address, city, region, country].filter(Boolean);
  const formatted = locationParts.length > 0 
    ? locationParts.join(', ')
    : 'Unknown Location';
  
  return {
    address,
    city,
    region,
    country,
    coordinates,
    formatted
  };
}

/**
 * Generate geohash for location-based merchant grouping
 */
export function generateGeohash(lat: number | null, lon: number | null): string {
  if (!lat || !lon) return 'unknown';
  
  // Simple geohash implementation (precision level 6)
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let geohash = '';
  let bit = 0;
  let ch = 0;
  let isEven = true;
  let mid: number;
  let min: number;
  let max: number;
  
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;
  
  while (geohash.length < 6) {
    if (isEven) {
      mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch |= (1 << (4 - bit));
        lonMin = mid;
      } else {
        lonMax = mid;
      }
    } else {
      mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }
    
    isEven = !isEven;
    
    if (bit < 4) {
      bit++;
    } else {
      geohash += base32.charAt(ch);
      bit = 0;
      ch = 0;
    }
  }
  
  return geohash;
}

/**
 * Infer merchant type from location and name patterns
 */
export function inferMerchantType(transaction: PartialTransaction): string {
  const name = (transaction.name || '').toLowerCase();
  const merchantName = (transaction.merchantName || '').toLowerCase();
  const location = formatLocationContext(transaction).formatted.toLowerCase();
  
  // Gas stations
  if (name.includes('shell') || name.includes('exxon') || name.includes('mobil') ||
      merchantName.includes('shell') || merchantName.includes('exxon') || merchantName.includes('mobil') ||
      location.includes('gas') || location.includes('fuel')) {
    return 'gas_station';
  }
  
  // Grocery stores
  if (name.includes('safeway') || name.includes('kroger') || name.includes('whole foods') ||
      merchantName.includes('safeway') || merchantName.includes('kroger') || merchantName.includes('whole foods') ||
      location.includes('grocery') || location.includes('supermarket')) {
    return 'grocery_store';
  }
  
  // Restaurants
  if (name.includes('restaurant') || name.includes('cafe') || name.includes('diner') ||
      merchantName.includes('restaurant') || merchantName.includes('cafe') || merchantName.includes('diner')) {
    return 'restaurant';
  }
  
  // Coffee shops
  if (name.includes('starbucks') || name.includes('coffee') || name.includes('espresso') ||
      merchantName.includes('starbucks') || merchantName.includes('coffee') || merchantName.includes('espresso')) {
    return 'coffee_shop';
  }
  
  // Online retailers
  if (name.includes('amazon') || name.includes('ebay') || name.includes('etsy') ||
      merchantName.includes('amazon') || merchantName.includes('ebay') || merchantName.includes('etsy')) {
    return 'online_retailer';
  }
  
  // Streaming services
  if (name.includes('netflix') || name.includes('spotify') || name.includes('hulu') ||
      merchantName.includes('netflix') || merchantName.includes('spotify') || merchantName.includes('hulu')) {
    return 'streaming_service';
  }
  
  return 'unknown';
}

/**
 * Derive merchant features from transaction data
 */
export function deriveMerchantFeatures(transaction: PartialTransaction): MerchantFeatures {
  const geohash = generateGeohash(transaction.locationLat || null, transaction.locationLon || null);
  const merchantType = inferMerchantType(transaction);
  const locationContext = formatLocationContext(transaction).formatted;
  
  const paymentContext = [
    transaction.paymentChannel || 'unknown',
    transaction.paymentMethod || 'unknown',
    transaction.paymentProcessor || 'unknown'
  ].filter(Boolean).join(' | ');
  
  const amountContext = transaction.amount < 0 ? 'expense' : 'income';
  
  return {
    geohash,
    merchantType,
    locationContext,
    paymentContext,
    amountContext
  };
}

/**
 * Create AI context string for transaction categorization
 */
export function createAIContext(transaction: PartialTransaction): string {
  const cleaned = cleanMerchantName(transaction.merchantName || transaction.name);
  const location = formatLocationContext(transaction);
  const features = deriveMerchantFeatures(transaction);
  
  return [
    `Merchant: "${cleaned.normalized}"`,
    `Location: ${location.formatted}`,
    `Coordinates: ${location.coordinates || 'Unknown'}`,
    `Amount: $${Math.abs(transaction.amount)}`,
    `Payment: ${features.paymentContext}`,
    `Type: ${features.merchantType}`,
    `Geohash: ${features.geohash}`
  ].join('\n');
}

/**
 * Determine if transaction should be categorized by rules vs AI
 */
export function shouldUseRuleBasedCategorization(transaction: PartialTransaction): boolean {
  const features = deriveMerchantFeatures(transaction);
  
  // Gas stations with small amounts are likely snacks
  if (features.merchantType === 'gas_station' && Math.abs(transaction.amount) < 50) {
    return true;
  }
  
  // Grocery stores are usually straightforward
  if (features.merchantType === 'grocery_store') {
    return true;
  }
  
  // Streaming services are obvious
  if (features.merchantType === 'streaming_service') {
    return true;
  }
  
  return false;
}

/**
 * Apply rule-based categorization for obvious cases
 */
export function applyRuleBasedCategorization(transaction: PartialTransaction): { granular: string; general: string } | null {
  const features = deriveMerchantFeatures(transaction);
  const amount = Math.abs(transaction.amount);
  
  // Gas station logic
  if (features.merchantType === 'gas_station') {
    if (amount < 50) {
      return { granular: 'Gas Station Snacks', general: 'Food & Dining' };
    } else {
      return { granular: 'Gas Station', general: 'Transportation' };
    }
  }
  
  // Grocery stores
  if (features.merchantType === 'grocery_store') {
    return { granular: 'Groceries', general: 'Food & Dining' };
  }
  
  // Streaming services
  if (features.merchantType === 'streaming_service') {
    return { granular: 'Streaming Services', general: 'Entertainment' };
  }
  
  // Coffee shops
  if (features.merchantType === 'coffee_shop') {
    return { granular: 'Coffee Shops', general: 'Food & Dining' };
  }
  
  return null;
}

/**
 * Enrich a transaction with additional context data
 */
export function enrichTransaction(transaction: PartialTransaction): EnrichedTransaction {
  const cleaned = cleanMerchantName(transaction.merchantName || transaction.name);
  const location = formatLocationContext(transaction);
  const features = deriveMerchantFeatures(transaction);
  const aiContext = createAIContext(transaction);

  return {
    ...transaction,
    enriched: {
      cleanedMerchant: cleaned,
      locationContext: location,
      merchantFeatures: features,
      aiContext: aiContext,
    }
  };
} 