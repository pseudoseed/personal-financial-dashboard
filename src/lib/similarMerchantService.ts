import { prisma } from './db';
import { generateGeohash, cleanMerchantName } from './transactionEnrichment';
import { SimilarMerchant } from './transactionEnrichment';

/**
 * Find similar merchants for AI categorization context
 */
export async function findSimilarMerchants(
  transaction: any,
  limit: number = 3
): Promise<SimilarMerchant[]> {
  try {
    const cleaned = cleanMerchantName(transaction.merchantName || transaction.name);
    const geohash = generateGeohash(transaction.locationLat, transaction.locationLon);
    
    // Find merchants with similar names and locations
    const similarMerchants = await prisma.$queryRawUnsafe(`
      SELECT 
        name,
        "merchantName",
        "locationCity",
        "locationRegion",
        "categoryAiGranular",
        "categoryAiGeneral",
        "locationLat",
        "locationLon"
      FROM "Transaction" 
      WHERE (
        "categoryAiGranular" IS NOT NULL 
        OR "categoryAiGeneral" IS NOT NULL
      )
      AND (
        name LIKE '%${cleaned.normalized.replace(/'/g, "''")}%'
        OR "merchantName" LIKE '%${cleaned.normalized.replace(/'/g, "''")}%'
        OR name LIKE '%${cleaned.cleaned.replace(/'/g, "''")}%'
        OR "merchantName" LIKE '%${cleaned.cleaned.replace(/'/g, "''")}%'
      )
      AND id != '${transaction.id}'
      ORDER BY date DESC
      LIMIT ${limit * 2}
    `) as any[];
    
    // Calculate similarity scores and return top matches
    const scoredMerchants = similarMerchants.map(merchant => {
      const score = calculateSimilarityScore(transaction, merchant, cleaned, geohash);
      return {
        merchantName: merchant.merchantName || merchant.name,
        location: [merchant.locationCity, merchant.locationRegion].filter(Boolean).join(', '),
        category: merchant.categoryAiGranular || merchant.categoryAiGeneral || 'Unknown',
        confidence: score
      };
    });
    
    // Sort by confidence and return top results
    return scoredMerchants
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error finding similar merchants:', error);
    return [];
  }
}

/**
 * Calculate similarity score between two merchants
 */
function calculateSimilarityScore(
  transaction: any,
  merchant: any,
  cleaned: any,
  geohash: string
): number {
  let score = 0;
  
  // Name similarity (highest weight)
  const merchantName = (merchant.merchantName || merchant.name || '').toUpperCase();
  const normalizedName = cleaned.normalized;
  
  if (merchantName.includes(normalizedName) || normalizedName.includes(merchantName)) {
    score += 0.6;
  } else if (merchantName.includes(cleaned.cleaned) || cleaned.cleaned.includes(merchantName)) {
    score += 0.4;
  }
  
  // Location similarity
  const merchantGeohash = generateGeohash(merchant.locationLat, merchant.locationLon);
  if (merchantGeohash === geohash) {
    score += 0.3;
  } else if (merchantGeohash.substring(0, 4) === geohash.substring(0, 4)) {
    score += 0.1;
  }
  
  // City/region similarity
  if (merchant.locationCity === transaction.locationCity) {
    score += 0.2;
  }
  if (merchant.locationRegion === transaction.locationRegion) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Get merchant categorization patterns for AI context
 */
export async function getMerchantCategorizationPatterns(): Promise<string> {
  try {
    // Get common merchant patterns with their categories
    const patterns = await prisma.$queryRawUnsafe(`
      SELECT 
        name,
        "merchantName",
        "categoryAiGranular",
        "categoryAiGeneral",
        COUNT(*) as frequency
      FROM "Transaction" 
      WHERE "categoryAiGranular" IS NOT NULL 
        OR "categoryAiGeneral" IS NOT NULL
      GROUP BY name, "merchantName", "categoryAiGranular", "categoryAiGeneral"
      HAVING COUNT(*) >= 2
      ORDER BY frequency DESC
      LIMIT 20
    `) as any[];
    
    if (patterns.length === 0) {
      return 'No merchant patterns available.';
    }
    
    return patterns.map(pattern => {
      const merchant = pattern.merchantName || pattern.name;
      const category = pattern.categoryAiGranular || pattern.categoryAiGeneral;
      return `${merchant} → ${category} (${pattern.frequency} times)`;
    }).join('\n');
    
  } catch (error) {
    console.error('Error getting merchant patterns:', error);
    return 'Error loading merchant patterns.';
  }
}

/**
 * Get location-based merchant patterns
 */
export async function getLocationBasedPatterns(
  city?: string,
  region?: string
): Promise<string> {
  try {
    let whereClause = '';
    if (city || region) {
      const conditions = [];
      if (city) conditions.push(`"locationCity" = '${city.replace(/'/g, "''")}'`);
      if (region) conditions.push(`"locationRegion" = '${region.replace(/'/g, "''")}'`);
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }
    
    const patterns = await prisma.$queryRawUnsafe(`
      SELECT 
        name,
        "merchantName",
        "categoryAiGranular",
        "categoryAiGeneral",
        "locationCity",
        "locationRegion",
        COUNT(*) as frequency
      FROM "Transaction" 
      ${whereClause}
      AND ("categoryAiGranular" IS NOT NULL OR "categoryAiGeneral" IS NOT NULL)
      GROUP BY name, "merchantName", "categoryAiGranular", "categoryAiGeneral", "locationCity", "locationRegion"
      HAVING COUNT(*) >= 2
      ORDER BY frequency DESC
      LIMIT 10
    `) as any[];
    
    if (patterns.length === 0) {
      return 'No location-based patterns available.';
    }
    
    return patterns.map(pattern => {
      const merchant = pattern.merchantName || pattern.name;
      const category = pattern.categoryAiGranular || pattern.categoryAiGeneral;
      const location = [pattern.locationCity, pattern.locationRegion].filter(Boolean).join(', ');
      return `${merchant} (${location}) → ${category} (${pattern.frequency} times)`;
    }).join('\n');
    
  } catch (error) {
    console.error('Error getting location-based patterns:', error);
    return 'Error loading location-based patterns.';
  }
}

/**
 * Build merchant similarity cache for faster lookups
 */
export async function buildMerchantSimilarityCache(): Promise<void> {
  try {
    // Removed verbose debug logging
    
    // Get all categorized merchants
    const categorizedMerchants = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT
        name,
        "merchantName",
        "categoryAiGranular",
        "categoryAiGeneral",
        "locationCity",
        "locationRegion",
        "locationLat",
        "locationLon"
      FROM "Transaction" 
      WHERE "categoryAiGranular" IS NOT NULL 
        OR "categoryAiGeneral" IS NOT NULL
    `) as any[];
    
    // Removed verbose debug logging
    
    // This could be extended to store in a separate cache table
    // For now, we'll use the existing data structure
    
  } catch (error) {
    console.error('Error building merchant similarity cache:', error);
  }
} 