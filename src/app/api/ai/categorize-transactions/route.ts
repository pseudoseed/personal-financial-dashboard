import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { 
  enrichTransaction,
  applyRuleBasedCategorization,
  shouldUseRuleBasedCategorization,
  PartialTransaction
} from '../../../../lib/transactionEnrichment';
import { 
  findSimilarMerchants,
  getMerchantCategorizationPatterns,
  getLocationBasedPatterns
} from '../../../../lib/similarMerchantService';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEST_MODE = process.env.NODE_ENV === 'development';

// Budgeting-focused categories
const BUDGETING_CATEGORIES = {
  essential: [
    'Housing', 'Transportation', 'Groceries', 'Healthcare', 'Basic Utilities',
    'Gas Station', 'Car Payment', 'Car Insurance', 'Public Transit',
    'Electricity', 'Water', 'Internet', 'Cell Phone', 'Medical Expenses',
    'Health Insurance', 'Pharmacy', 'Rent/Mortgage', 'Home Maintenance'
  ],
  nonEssential: [
    'Entertainment', 'Luxury Food', 'Shopping', 'Hobbies', 'Personal Care',
    'Fast Food', 'Restaurants', 'Coffee Shops', 'Bars', 'Streaming Services',
    'Online Shopping', 'Clothing', 'Electronics', 'Beauty/Personal Care',
    'Gym/Fitness', 'Subscriptions', 'Gifts', 'Donations', 'Games'
  ],
  mixed: [
    'Gas Station Snacks', 'Work Dining', 'Entertainment Dining',
    'Essential Shopping', 'Luxury Shopping'
  ]
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactions, force } = body;

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: "Invalid request: transactions array required" },
        { status: 400 }
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    console.log(`[AI CATEGORIZATION] Processing ${transactions.length} transactions`);

    // Step 1: Get existing categories from database
    const transactionIds = transactions.map(t => t.id).filter(Boolean);
    const existingCategories = new Map();
    if (transactionIds.length > 0) {
      const dbTransactions = await prisma.$queryRawUnsafe(`
        SELECT id, "categoryAiGranular", "categoryAiGeneral" FROM "Transaction" 
        WHERE id IN (${transactionIds.map(id => `'${id}'`).join(',')})
      `);
      (dbTransactions as any[]).forEach((t: { id: string; categoryAiGranular: string | null; categoryAiGeneral: string | null }) => {
        if (t.categoryAiGranular && t.categoryAiGeneral) {
          existingCategories.set(t.id, { granular: t.categoryAiGranular, general: t.categoryAiGeneral });
        }
      });
    }

    // Step 2: Filter out transactions that already have categories, unless force is true
    let toCategorize: any[];
    if (force) {
      // Only send the most recent 5000 transactions (by date)
      toCategorize = [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5000);
    } else {
      toCategorize = transactions.filter(t => !existingCategories.has(t.id));
    }

    // If all transactions are already categorized, return existing categories
    if (toCategorize.length === 0) {
      const categories = transactions.map(t => existingCategories.get(t.id) || { granular: 'Miscellaneous', general: 'Miscellaneous' });
      return NextResponse.json({ categories, fromCache: true });
    }

    // Step 3: Enrich transactions with location and merchant context
    const enrichedTransactions = toCategorize.map(t => enrichTransaction(t as PartialTransaction));

    // Step 4: Multi-stage categorization
    const ruleBasedResults = new Map();
    const aiCategorizationQueue: any[] = [];

    for (const transaction of enrichedTransactions) {
      // Apply rule-based categorization first
      const ruleResult = applyRuleBasedCategorization(transaction);
      if (ruleResult) {
        ruleBasedResults.set(transaction.id, ruleResult);
        if (TEST_MODE) {
          console.log(`[RULE-BASED] ${transaction.name} → ${ruleResult.granular}`);
        }
      } else {
        // Queue for AI categorization
        aiCategorizationQueue.push(transaction);
      }
    }

    console.log(`[AI CATEGORIZATION] Rule-based: ${ruleBasedResults.size}, AI queue: ${aiCategorizationQueue.length}`);

    // Step 5: AI categorization for remaining transactions
    const aiResults = new Map();
    if (aiCategorizationQueue.length > 0) {
      const batchSize = 20; // Smaller batches for better AI performance
      
      for (let i = 0; i < aiCategorizationQueue.length; i += batchSize) {
        const batch = aiCategorizationQueue.slice(i, i + batchSize);
        const batchResults = await categorizeBatchWithAI(batch);
        
        batchResults.forEach((result, transactionId) => {
          aiResults.set(transactionId, result);
        });
        
        if (TEST_MODE) {
          console.log(`[AI BATCH] Processed ${batch.length} transactions (${i + batch.length}/${aiCategorizationQueue.length})`);
        }
      }
    }

    // Step 6: Combine results and update database
    const allResults = new Map([...ruleBasedResults, ...aiResults]);
    
    if (allResults.size > 0) {
      await updateDatabaseWithCategories(allResults);
    }

    return NextResponse.json({
      totalProcessed: transactions.length,
      fromCache: existingCategories.size,
      ruleBasedCategorized: ruleBasedResults.size,
      aiCategorized: aiResults.size,
      newlyCategorized: allResults.size,
      categories: Array.from(allResults.values()),
    });

  } catch (error) {
    console.error('Server error in categorize-transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Categorize a batch of transactions using AI with enhanced context
 */
async function categorizeBatchWithAI(transactions: any[]): Promise<Map<string, { granular: string; general: string }>> {
  const results = new Map();
  
  try {
    // Get merchant patterns for context
    const merchantPatterns = await getMerchantCategorizationPatterns();
    
    // Prepare transaction data with similar merchant context
    const transactionData = await Promise.all(
      transactions.map(async (transaction) => {
        const similarMerchants = await findSimilarMerchants(transaction, 3);
        return {
          id: transaction.id,
          context: transaction.enriched.aiContext,
          similarMerchants: similarMerchants.map(m => `${m.merchantName} (${m.location}) → ${m.category}`).join('\n'),
          amount: transaction.amount,
          merchantName: transaction.name
        };
      })
    );

    // Create enhanced AI prompt
    const prompt = createEnhancedAIPrompt(transactionData, merchantPatterns);

    if (TEST_MODE) {
      console.log('[AI PROMPT PREVIEW]', prompt.substring(0, 1000) + '...');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are a budgeting expert that categorizes financial transactions to help users identify essential vs non-essential spending and find waste in their budget.' 
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    // Parse the JSON response
    const parsed = parseAIResponse(content);
    
    // Map results back to transaction IDs
    parsed.forEach((item: any) => {
      const transaction = transactionData.find(t => t.merchantName === item.merchant);
      if (transaction) {
        results.set(transaction.id, {
          granular: item.granularCategory || 'Miscellaneous',
          general: item.generalCategory || 'Miscellaneous'
        });
      }
    });

  } catch (error) {
    console.error('Error in AI categorization batch:', error);
    // Fallback: assign miscellaneous categories
    transactions.forEach(transaction => {
      results.set(transaction.id, { granular: 'Miscellaneous', general: 'Miscellaneous' });
    });
  }

  return results;
}

/**
 * Create enhanced AI prompt with budgeting focus and rich context
 */
function createEnhancedAIPrompt(transactions: any[], merchantPatterns: string): string {
  const allCategories = [
    ...BUDGETING_CATEGORIES.essential,
    ...BUDGETING_CATEGORIES.nonEssential,
    ...BUDGETING_CATEGORIES.mixed
  ];

  return [
    'You are a budgeting expert. Categorize these transactions to help users identify:',
    '1. Essential spending (needs) vs Non-essential spending (wants)',
    '2. Areas of potential waste',
    '3. Opportunities for budget optimization',
    '',
    'AVAILABLE CATEGORIES:',
    allCategories.join(', '),
    '',
    'CATEGORIZATION GUIDELINES:',
    '- Focus on budgeting insights (essential vs non-essential)',
    '- Use location context for merchant disambiguation',
    '- Consider payment method and channel',
    '- Split gas station transactions (gas vs snacks)',
    '- Distinguish work dining from entertainment',
    '- Use similar merchant examples as guidance',
    '',
    'MERCHANT PATTERNS (for reference):',
    merchantPatterns,
    '',
    'SIMILAR MERCHANT EXAMPLES:',
    transactions.map(t => `Transaction: ${t.merchantName}\nContext: ${t.context}\nSimilar: ${t.similarMerchants || 'None'}`).join('\n\n'),
    '',
    'Return ONLY a JSON array like this:',
    '[',
    '  { "merchant": "Shell 1234", "granularCategory": "Gas Station", "generalCategory": "Transportation" },',
    '  { "merchant": "Starbucks", "granularCategory": "Coffee Shops", "generalCategory": "Food & Dining" }',
    ']',
    '',
    'Transactions to categorize:',
    JSON.stringify(transactions.map(t => ({ merchant: t.merchantName, amount: t.amount })), null, 2),
    '',
    'Do not explain your answers. Do not wrap in Markdown.'
  ].join('\n');
}

/**
 * Parse AI response and extract categories
 */
function parseAIResponse(content: string): any[] {
  try {
    // Find the first and last brackets to extract JSON
    const firstBracket = content.indexOf('[');
    const lastBracket = content.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) {
      console.error('Malformed AI response (no brackets):', content);
      return [];
    }
    const jsonContent = content.slice(firstBracket, lastBracket + 1);
    const parsed = JSON.parse(jsonContent);
    if (!Array.isArray(parsed)) {
      console.error('AI response is not an array:', parsed);
      return [];
    }
    return parsed;
  } catch (parseError) {
    console.error('JSON parse error:', parseError, 'Content:', content);
    return [];
  }
}

/**
 * Update database with new categories
 */
async function updateDatabaseWithCategories(
  categoryMap: Map<string, { granular: string; general: string }>
): Promise<void> {
  try {
    const updateCasesGranular: string[] = [];
    const updateCasesGeneral: string[] = [];
    
    for (const [transactionId, categories] of categoryMap) {
      updateCasesGranular.push(`WHEN '${transactionId}' THEN '${categories.granular.replace(/'/g, "''")}'`);
      updateCasesGeneral.push(`WHEN '${transactionId}' THEN '${categories.general.replace(/'/g, "''")}'`);
    }
    
    const transactionIds = Array.from(categoryMap.keys());
    if (transactionIds.length > 0) {
      const sql = `
        UPDATE "Transaction" 
        SET "categoryAiGranular" = CASE id ${updateCasesGranular.join(' ')} END,
            "categoryAiGeneral" = CASE id ${updateCasesGeneral.join(' ')} END
        WHERE id IN (${transactionIds.map(id => `'${id}'`).join(',')})
      `;
      await prisma.$executeRawUnsafe(sql);
      
      console.log(`[DATABASE] Updated ${transactionIds.length} transactions with new categories`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] Failed to store categories:', error);
    throw error;
  }
}
