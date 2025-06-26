import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEST_MODE = true; // Toggle this for test mode

const GENERAL_CATEGORIES = [
  "Housing", "Utilities", "Food & Dining", "Groceries", "Transportation", "Shopping", "Health & Fitness", "Entertainment", "Travel", "Personal Care", "Education", "Insurance", "Financial", "Gifts & Donations", "Kids", "Pets", "Miscellaneous"
];

const GRANULAR_CATEGORIES = [
  "Rent/Mortgage", "Home Maintenance", "Electricity", "Water/Sewer", "Gas Utility", "Internet", "Cell Phone", "Streaming Services", "Groceries", "Fast Food", "Restaurants", "Coffee Shops", "Alcohol/Bars", "Gas Station", "Public Transit", "Ride Sharing (Uber/Lyft)", "Car Payment", "Car Insurance", "Parking", "Flights", "Hotels", "Vacation Rental", "Online Shopping", "Clothing", "Electronics", "Beauty/Personal Care", "Gym/Fitness", "Medical Expenses", "Health Insurance", "Pharmacy", "Subscriptions", "Childcare", "Tuition", "Student Loans", "Books & Supplies", "Credit Card Payment", "Loan Payment", "Savings", "Investments", "ATM Withdrawal", "Fees & Charges", "Gifts", "Donations", "Pets", "Hobbies", "Games", "Miscellaneous"
];

// Helper: Map Plaid category array to our taxonomy (granular/general)
function mapPlaidCategoryToTaxonomy(plaidCategoryArr: string[]): { granular: string; general: string } {
  // Example mapping logic (expand as needed)
  if (!plaidCategoryArr || plaidCategoryArr.length === 0) return { granular: 'Miscellaneous', general: 'Miscellaneous' };
  const joined = plaidCategoryArr.join(' > ').toLowerCase();
  if (joined.includes('fast food')) return { granular: 'Fast Food', general: 'Food & Dining' };
  if (joined.includes('restaurants')) return { granular: 'Restaurants', general: 'Food & Dining' };
  if (joined.includes('coffee')) return { granular: 'Coffee Shops', general: 'Food & Dining' };
  if (joined.includes('groceries')) return { granular: 'Groceries', general: 'Groceries' };
  if (joined.includes('gas')) return { granular: 'Gas Station', general: 'Transportation' };
  if (joined.includes('shopping')) return { granular: 'Online Shopping', general: 'Shopping' };
  if (joined.includes('travel')) return { granular: 'Flights', general: 'Travel' };
  // ...add more mappings as needed...
  return { granular: plaidCategoryArr[plaidCategoryArr.length-1] || 'Miscellaneous', general: plaidCategoryArr[0] || 'Miscellaneous' };
}

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

    // Step 3: Smart filtering - only exclude obvious non-spending transactions
    // To do this correctly, we need account type for each transaction
    // If not present, fetch from DB
    let transactionsWithType = toCategorize;
    if (!toCategorize[0]?.accountType) {
      const ids = toCategorize.map(t => `'${t.accountId}'`).join(',');
      const accountTypes = await prisma.$queryRawUnsafe(`
        SELECT id, type FROM "Account" WHERE id IN (${ids})
      `) as any[];
      const typeMap = new Map(accountTypes.map((a: any) => [a.id, a.type]));
      transactionsWithType = toCategorize.map(t => ({ ...t, accountType: typeMap.get(t.accountId) }));
    }
    const filteredOut: any[] = [];
    const spendingTransactions = transactionsWithType.filter((t) => {
      const name = (t.name || t.merchantName || '').toLowerCase();
      const amount = t.amount;
      const accountType = t.accountType || '';
      // Basic validation
      if (typeof amount !== 'number' || isNaN(amount)) {
        filteredOut.push({ reason: 'invalid amount', t });
        return false;
      }
      // Handle subscription services that might have positive amounts
      const subscriptionServices = [
        'tidal', 'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'prime video', 
        'youtube premium', 'apple music', 'amazon prime', 'peacock', 'paramount',
        'crunchyroll', 'funimation', 'shudder', 'mubi', 'criterion'
      ];
      const isSubscriptionService = subscriptionServices.some(service => 
        name.includes(service)
      );
      if (isSubscriptionService) {
        return true;
      }
      // Spend logic: credit = purchases are positive, depository = purchases are negative
      let isSpend = false;
      if (accountType.toLowerCase() === 'credit') {
        isSpend = amount > 0;
      } else if (accountType.toLowerCase() === 'depository') {
        isSpend = amount < 0;
      } else {
        // fallback: treat negative as spend
        isSpend = amount < 0;
      }
      if (!isSpend) {
        filteredOut.push({ reason: 'not spend', t });
        return false;
      }
      // Exclude obvious transfers and payments (but let AI handle ambiguous cases)
      const obviousTransfers = [
        'zelle payment from',
        'venmo payment from', 
        'paypal payment from',
        'deposit',
        'atm deposit',
        'atm credit',
        'atm refund',
        'credit card payment',
        'creditcardpayment',
        'loan payment',
        'loan repayment',
        'payment thank you',
        'redemption credit',
        'constant con-osv',
        'online transfer from',
        'apple cash bank xfer',
        'cash app.*cash out',
        'refund',
        'reversal',
        'credit'
      ];
      if (obviousTransfers.some(pattern => new RegExp(pattern).test(name))) {
        filteredOut.push({ reason: 'obvious transfer/payment', t });
        return false;
      }
      return true;
    });
    
    if (TEST_MODE) {
      console.log('[FILTERED OUT TRANSACTIONS]', filteredOut.map(f => ({ reason: f.reason, name: f.t.name || f.t.merchantName, amount: f.t.amount })));
      console.log('[TRANSACTIONS SENT TO AI]', spendingTransactions.map(t => ({ name: t.name || t.merchantName, amount: t.amount })));
    }

    // Step 4: AI categorization with improved prompt
    const categorized: string[] = [];
    const costTrackers: any[] = [];
    const batchSize = 50; // Smaller batches for better AI performance
    const newCategories = new Map();
    
    for (let i = 0; i < spendingTransactions.length; i += batchSize) {
      const batch = spendingTransactions.slice(i, i + batchSize);

      // Enhanced AI prompt for dual-level categorization
      const prompt = [
        'You are an expert financial transaction categorizer. Your job is to assign BOTH a granular and a general category to each transaction, using the provided lists.',
        '',
        'GENERAL CATEGORIES:',
        GENERAL_CATEGORIES.join(', '),
        '',
        'GRANULAR CATEGORIES:',
        GRANULAR_CATEGORIES.join(', '),
        '',
        'IMPORTANT GUIDELINES:',
        '- Use your knowledge of companies, brands, and services to make intelligent categorizations.',
        '- For each transaction, return BOTH a granular and a general category.',
        '- Only use "Miscellaneous" if, based on general public knowledge of the merchant name, you cannot reasonably determine a more specific category from the provided list.',
        '- If a transaction could fit multiple categories, choose the most specific and relevant one.',
        '- Example mappings:',
        '  - Starbucks → Granular: Coffee Shops, General: Food & Dining',
        '  - Amazon → Granular: Online Shopping, General: Shopping',
        '  - Shell → Granular: Gas Station, General: Transportation',
        '',
        'Return ONLY a JSON array like this:',
        '[',
        '  { "name": "Amazon", "granularCategory": "Online Shopping", "generalCategory": "Shopping" },',
        '  ...',
        ']',
        '',
        'Transactions to categorize:',
        JSON.stringify(batch.map(t => ({ name: t.name || t.merchantName, amount: t.amount })), null, 2),
        '',
        'Do not explain your answers. Do not wrap in Markdown.'
      ].join('\n');

      if (TEST_MODE) {
        console.log({ batch: Math.floor(i / batchSize) + 1, promptPreview: prompt.slice(0, 1000) });
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
            { role: 'system', content: 'You are a helpful assistant that categorizes financial transactions using your knowledge of companies and services.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 2048,
          temperature: 0.1, // Lower temperature for more consistent results
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();

      // Parse the JSON response
      let parsed;
      try {
        // Find the first and last brackets to extract JSON
        const firstBracket = content.indexOf('[');
        const lastBracket = content.lastIndexOf(']');
        if (firstBracket === -1 || lastBracket === -1) {
          console.error('Malformed AI response (no brackets):', content);
          continue;
        }
        const jsonContent = content.slice(firstBracket, lastBracket + 1);
        parsed = JSON.parse(jsonContent);
        if (!Array.isArray(parsed)) {
          console.error('AI response is not an array:', parsed);
          continue;
        }
      } catch (parseError) {
        const firstBracket = content.indexOf('[');
        const lastBracket = content.lastIndexOf(']');
        console.error('JSON parse error:', parseError, 'Content:', content.slice(firstBracket, lastBracket + 1));
        continue;
      }

      // Process the categorized transactions
      parsed.forEach((item: any) => {
        if (item.name && item.granularCategory && item.generalCategory) {
          const granularCategory = item.granularCategory.trim();
          const generalCategory = item.generalCategory.trim();
          if (GRANULAR_CATEGORIES.includes(granularCategory) && GENERAL_CATEGORIES.includes(generalCategory)) {
            newCategories.set(item.name, { granular: granularCategory, general: generalCategory });
            categorized.push(granularCategory);
          } else {
            // If AI returned a non-standard category, map it to Miscellaneous
            newCategories.set(item.name, { granular: 'Miscellaneous', general: 'Miscellaneous' });
            categorized.push('Miscellaneous');
          }
        }
      });
    }

    // Step 5: Update database with new categories
    if (newCategories.size > 0) {
      try {
        // Get transaction IDs and Plaid categories for the categorized names
        const categorizedNames = Array.from(newCategories.keys());
        const dbTransactions: any[] = await prisma.$queryRawUnsafe(`
          SELECT id, name, "merchantName", category, "plaidId" FROM "Transaction" 
          WHERE name IN (${categorizedNames.map(name => `'${name.replace(/'/g, "''")}'`).join(',')})
          OR "merchantName" IN (${categorizedNames.map(name => `'${name.replace(/'/g, "''")}'`).join(',')})
        `);

        // Prepare update cases for dual-level categories
        const updateCasesGranular: string[] = [];
        const updateCasesGeneral: string[] = [];
        for (const t of dbTransactions) {
          const aiCat = newCategories.get(t.name) || newCategories.get(t.merchantName);
          let granular = aiCat?.granular || 'Miscellaneous';
          let general = aiCat?.general || 'Miscellaneous';
          // Fallback: If AI returned Miscellaneous, try Plaid
          if (granular === 'Miscellaneous' && t.category) {
            const plaidMapped = mapPlaidCategoryToTaxonomy([t.category]);
            if (plaidMapped.granular !== 'Miscellaneous') {
              granular = plaidMapped.granular;
              general = plaidMapped.general;
            }
          }
          updateCasesGranular.push(`WHEN '${t.id}' THEN '${granular.replace(/'/g, "''")}'`);
          updateCasesGeneral.push(`WHEN '${t.id}' THEN '${general.replace(/'/g, "''")}'`);
        }
        const dbIds: string[] = dbTransactions.map((t: any) => t.id);
        if (dbIds.length > 0) {
          const sql = `
            UPDATE "Transaction" 
            SET "categoryAiGranular" = CASE id ${updateCasesGranular.join(' ')} END,
                "categoryAiGeneral" = CASE id ${updateCasesGeneral.join(' ')} END
            WHERE id IN (${dbIds.map((id: string) => `'${id}'`).join(',')})
          `;
          await prisma.$executeRawUnsafe(sql);
        }
        // Log unique categories saved in this batch
        const uniqueGranular = new Set(Array.from(newCategories.values()).map(v => v.granular));
        const uniqueGeneral = new Set(Array.from(newCategories.values()).map(v => v.general));
        console.log('[AI CATEGORIZATION] Saved categories (granular):', Array.from(uniqueGranular));
        console.log('[AI CATEGORIZATION] Saved categories (general):', Array.from(uniqueGeneral));
      } catch (dbError) {
        console.error('[DATABASE ERROR] Failed to store categories:', dbError);
      }
    }

    return NextResponse.json({
      totalProcessed: transactions.length,
      fromCache: existingCategories.size,
      newlyCategorized: newCategories.size,
      categories: [...new Set([...Array.from(existingCategories.values()), ...categorized])],
    });
  } catch (error) {
    console.error('Server error in categorize-transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
