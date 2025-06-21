import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEST_MODE = true; // Toggle this for test mode

const STANDARD_CATEGORIES = [
  "Rent/Mortgage", "Groceries", "Dining Out", "Utilities", "Internet", "Cell Phone", "Transportation", "Gas", "Car Payment", "Car Insurance", "Public Transit", "Health Insurance", "Medical Expenses", "Subscriptions", "Streaming Services", "Gym/Fitness", "Shopping", "Clothing", "Entertainment", "Travel", "Hotels", "Flights", "Uber/Lyft", "Coffee Shops", "Pets", "Gifts", "Donations", "Household Supplies", "Home Maintenance", "Childcare", "Education", "Student Loans", "Credit Card Payments", "Savings", "Investments", "Emergency Fund", "Hobbies", "Alcohol/Bars", "Beauty/Personal Care", "Tobacco/Vape", "Tech/Gadgets", "ATM Withdrawals", "Fees & Charges", "Miscellaneous"
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactions } = body;

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
        SELECT id, "categoryAi" FROM "Transaction" 
        WHERE id IN (${transactionIds.map(id => `'${id}'`).join(',')})
      `);
      
      (dbTransactions as any[]).forEach((t: { id: string; categoryAi: string | null }) => {
        if (t.categoryAi) {
          existingCategories.set(t.id, t.categoryAi);
        }
      });
    }

    // Step 2: Filter out transactions that already have categories
    const uncategorizedTransactions = transactions.filter(t => !existingCategories.has(t.id));

    // If all transactions are already categorized, return existing categories
    if (uncategorizedTransactions.length === 0) {
      const categories = transactions.map(t => existingCategories.get(t.id) || 'Miscellaneous');
      return NextResponse.json({ categories, fromCache: true });
    }

    // Step 3: Smart filtering - only exclude obvious non-spending transactions
    const filteredOut: any[] = [];
    const spendingTransactions = uncategorizedTransactions.filter((t) => {
      const name = (t.name || t.merchantName || '').toLowerCase();
      const amount = t.amount;
      
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
      
      // If it's a subscription service, include it regardless of amount
      if (isSubscriptionService) {
        return true;
      }
      
      // Only process expenses (negative amounts) for non-subscription services
      if (amount >= 0) {
        filteredOut.push({ reason: 'income or zero amount', t });
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

      // Enhanced AI prompt that leverages AI's knowledge
      const prompt = [
        'You are an expert financial transaction categorizer. Your job is to categorize spending transactions into appropriate budgeting categories.',
        '',
        'Use ONLY one of these categories:',
        STANDARD_CATEGORIES.join(', '),
        '',
        'IMPORTANT GUIDELINES:',
        '- Use your knowledge of companies, brands, and services to make intelligent categorizations',
        '- Streaming services (Netflix, Spotify, TIDAL, Hulu, Disney+, HBO Max, etc.) → "Streaming Services"',
        '- Food delivery (Uber Eats, DoorDash, Grubhub, etc.) → "Dining Out"',
        '- Ride sharing (Uber, Lyft, etc.) → "Uber/Lyft"',
        '- Online shopping (Amazon, eBay, etc.) → "Shopping"',
        '- Grocery stores (Walmart, Target, Kroger, etc.) → "Groceries"',
        '- Gas stations (Shell, Exxon, etc.) → "Gas"',
        '- Coffee shops (Starbucks, Dunkin, etc.) → "Coffee Shops"',
        '- Only use "Miscellaneous" if you cannot reasonably determine the category',
        '',
        'Return ONLY a JSON array like this:',
        '[{ "name": "Amazon", "category": "Shopping" }, ...]',
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

      if (!content) {
        throw new Error('Empty response from OpenAI API');
      }

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
        if (item.name && item.category) {
          const category = item.category.trim();
          if (STANDARD_CATEGORIES.includes(category)) {
            newCategories.set(item.name, category);
            categorized.push(category);
          } else {
            // If AI returned a non-standard category, map it to Miscellaneous
            newCategories.set(item.name, 'Miscellaneous');
            categorized.push('Miscellaneous');
          }
        }
      });
    }

    // Step 5: Update database with new categories
    if (newCategories.size > 0) {
      try {
        // Get transaction IDs that match the categorized names
        const categorizedNames = Array.from(newCategories.keys());
        const dbTransactions = await prisma.$queryRawUnsafe(`
          SELECT id, name, "merchantName" FROM "Transaction" 
          WHERE name IN (${categorizedNames.map(name => `'${name.replace(/'/g, "''")}'`).join(',')})
          OR "merchantName" IN (${categorizedNames.map(name => `'${name.replace(/'/g, "''")}'`).join(',')})
        `);

        const dbIds = (dbTransactions as any[]).map(t => t.id);
        
        if (dbIds.length > 0) {
          // Build SQL update statement
          const updateCases = dbIds.map(id => `WHEN '${id}' THEN '${newCategories.get((dbTransactions as any[]).find(t => t.id === id)?.name || (dbTransactions as any[]).find(t => t.id === id)?.merchantName) || 'Miscellaneous'}'`).join(' ');
          const sql = `
            UPDATE "Transaction" 
            SET "categoryAi" = CASE id ${updateCases} END
            WHERE id IN (${dbIds.map(id => `'${id}'`).join(',')})
          `;
          
          await prisma.$executeRawUnsafe(sql);
        }
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
