import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEST_MODE = true; // Toggle this for test mode

const STANDARD_CATEGORIES = [
  "Rent/Mortgage", "Groceries", "Dining Out", "Utilities", "Internet", "Cell Phone", "Transportation", "Gas", "Car Payment", "Car Insurance", "Public Transit", "Health Insurance", "Medical Expenses", "Subscriptions", "Streaming Services", "Gym/Fitness", "Shopping", "Clothing", "Entertainment", "Travel", "Hotels", "Flights", "Uber/Lyft", "Coffee Shops", "Pets", "Gifts", "Donations", "Household Supplies", "Home Maintenance", "Childcare", "Education", "Student Loans", "Credit Card Payments", "Savings", "Investments", "Emergency Fund", "Hobbies", "Alcohol/Bars", "Beauty/Personal Care", "Tobacco/Vape", "Tech/Gadgets", "ATM Withdrawals", "Fees & Charges", "Miscellaneous"
];

export async function POST(req: NextRequest) {
  try {
    console.log('[DEBUG] Request received');
    const body = await req.json();
    console.log('[DEBUG] Request body:', body);
    const { transactions } = body;
    
    if (Array.isArray(transactions) && transactions.length > 0) {
      console.log('[CATEGORIZE API INCOMING SAMPLE]', transactions.slice(0, 3));
    }
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
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
    
    if (TEST_MODE) {
      console.log(`[CATEGORIZATION STATS] Total: ${transactions.length}, Already categorized: ${existingCategories.size}, Need AI: ${uncategorizedTransactions.length}`);
    }

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
        return NextResponse.json({ error: 'OpenAI API error', details: error }, { status: 500 });
      }

      const data = await response.json();

      // Optional: Estimate cost
      if (TEST_MODE && data.usage) {
        const { prompt_tokens, completion_tokens } = data.usage;
        const total = (prompt_tokens + completion_tokens) / 1000 * 0.005;
        costTrackers.push({
          input_tokens: prompt_tokens,
          output_tokens: completion_tokens,
          estimated_cost: `${total.toFixed(4)} USD`
        });
        console.log(costTrackers.at(-1));
      }

      let content = data.choices?.[0]?.message?.content ?? '';
      if (TEST_MODE) {
        console.log('Raw AI response:', content);
      }
      
      content = content.replace(/```json|```/gi, '').trim();
      const firstBracket = content.indexOf('[');
      const lastBracket = content.lastIndexOf(']');
      
      if (firstBracket === -1 || lastBracket === -1) {
        if (TEST_MODE) {
          console.error('Malformed AI response (no brackets):', content);
        }
        return NextResponse.json({ error: 'Malformed AI response', raw: content }, { status: 500 });
      }
      
      let parsed;
      try {
        parsed = JSON.parse(content.slice(firstBracket, lastBracket + 1));
      } catch (parseError) {
        if (TEST_MODE) {
          console.error('JSON parse error:', parseError, 'Content:', content.slice(firstBracket, lastBracket + 1));
        }
        return NextResponse.json({ error: 'Failed to parse AI response', details: parseError instanceof Error ? parseError.message : parseError, raw: content }, { status: 500 });
      }
      
      if (!Array.isArray(parsed)) {
        if (TEST_MODE) {
          console.error('AI response is not an array:', parsed);
        }
        return NextResponse.json({ error: 'AI response is not an array', raw: parsed }, { status: 500 });
      }
      
      const aiResults = parsed.map((t: any) => t.category);
      
      // Store new categories for database update
      batch.forEach((transaction, idx) => {
        const category = aiResults[idx] || 'Miscellaneous';
        if (transaction.id) {
          newCategories.set(transaction.id, category);
        }
      });
      
      categorized.push(...aiResults);

      // Log transactions categorized as 'Miscellaneous' for review
      batch.forEach((transaction, idx) => {
        if (aiResults[idx] === 'Miscellaneous') {
          console.log('[MISC TRANSACTION]', {
            name: transaction.name || transaction.merchantName || '',
            amount: transaction.amount
          });
        }
      });
    }

    // Step 5: Store new categories in database
    if (newCategories.size > 0) {
      try {
        if (TEST_MODE) {
          console.log('[DATABASE UPDATE] Attempting to store categories for:', Array.from(newCategories.entries()).slice(0, 3));
        }
        
        const dbIds = (await prisma.transaction.findMany({
          where: { id: { in: Array.from(newCategories.keys()) } },
          select: { id: true }
        })).map(t => t.id);

        if (TEST_MODE) {
          console.log('[DATABASE UPDATE] Found existing transaction IDs:', dbIds.slice(0, 3));
        }

        if (dbIds.length > 0) {
          const updatePromises = Array.from(newCategories.entries())
            .filter(([transactionId]) => dbIds.includes(transactionId))
            .map(([transactionId, category]) => {
              const sql = `
                UPDATE "Transaction" 
                SET "categoryAi" = '${category.replace(/'/g, "''")}'
                WHERE id = '${transactionId}'
              `;
              if (TEST_MODE) {
                console.log('[DATABASE UPDATE] Executing SQL:', sql);
              }
              return prisma.$executeRawUnsafe(sql);
            });

          await Promise.all(updatePromises);

          if (TEST_MODE) {
            console.log(`[DATABASE UPDATE] Stored ${updatePromises.length} new categories`);
          }
        } else {
          if (TEST_MODE) {
            console.log('[DATABASE UPDATE] No valid transaction IDs found for update');
          }
        }
      } catch (dbError) {
        console.error('[DATABASE ERROR] Failed to store categories:', dbError);
        // Continue with response even if database update fails
      }
    }

    // Step 6: Return complete category list (existing + new)
    const finalCategories = transactions.map(t => {
      if (newCategories.has(t.id)) {
        return newCategories.get(t.id);
      }
      if (existingCategories.has(t.id)) {
        return existingCategories.get(t.id);
      }
      return 'Miscellaneous';
    });

    return NextResponse.json({ 
      categories: finalCategories,
      fromCache: existingCategories.size,
      newlyCategorized: newCategories.size,
      totalProcessed: transactions.length
    });
  } catch (error) {
    if (TEST_MODE) {
      console.error('Server error in categorize-transactions:', error);
    }
    return NextResponse.json({ error: 'Server error', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
}
