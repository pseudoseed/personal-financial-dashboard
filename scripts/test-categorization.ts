import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCategorization() {
  try {
    // Get some transactions to test with
    const transactions = await prisma.transaction.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        amount: true,
        categoryAi: true,
        date: true
      },
      orderBy: { date: 'desc' }
    });

    if (transactions.length === 0) {
      console.log('No transactions found in database');
      return;
    }

    // Test the categorization API
    const response = await fetch('http://localhost:3000/api/ai/categorize-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions })
    });

    if (!response.ok) {
      console.log(`API request failed: ${response.status} ${response.statusText}`);
      return;
    }

    const result = await response.json();

    // Check if categories were stored in database
    const updatedTransactions = await prisma.transaction.findMany({
      where: { id: { in: transactions.map(t => t.id) } },
      select: { id: true, name: true, categoryAi: true }
    });

    // Test second call to verify caching
    const response2 = await fetch('http://localhost:3000/api/ai/categorize-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions })
    });

    const result2 = await response2.json();
    
    if (result2.fromCache === result2.totalProcessed) {
      console.log('SUCCESS: All transactions served from cache!');
    } else {
      console.log('Some transactions still needed AI categorization');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCategorization(); 