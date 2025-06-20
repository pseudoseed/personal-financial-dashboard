import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCategorization() {
  try {
    console.log('🧪 Testing AI Transaction Categorization with Database Persistence');
    
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
      console.log('❌ No transactions found in database');
      return;
    }

    console.log(`📊 Found ${transactions.length} transactions to test`);
    
    // Show current state
    console.log('\n📋 Current transaction categories:');
    transactions.forEach(t => {
      console.log(`  - ${t.name} (${t.amount}): ${t.categoryAi || 'Uncategorized'}`);
    });

    // Test the categorization API
    console.log('\n🤖 Testing AI categorization API...');
    const response = await fetch('http://localhost:3000/api/ai/categorize-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions })
    });

    if (!response.ok) {
      console.log(`❌ API request failed: ${response.status} ${response.statusText}`);
      return;
    }

    const result = await response.json();
    console.log('\n✅ API Response:');
    console.log(`  - Total processed: ${result.totalProcessed}`);
    console.log(`  - From cache: ${result.fromCache}`);
    console.log(`  - Newly categorized: ${result.newlyCategorized}`);
    console.log(`  - Categories: ${result.categories?.join(', ')}`);

    // Check if categories were stored in database
    console.log('\n💾 Checking database for stored categories...');
    const updatedTransactions = await prisma.transaction.findMany({
      where: { id: { in: transactions.map(t => t.id) } },
      select: { id: true, name: true, categoryAi: true }
    });

    console.log('\n📋 Updated transaction categories:');
    updatedTransactions.forEach(t => {
      console.log(`  - ${t.name}: ${t.categoryAi || 'Still uncategorized'}`);
    });

    // Test second call to verify caching
    console.log('\n🔄 Testing second call to verify caching...');
    const response2 = await fetch('http://localhost:3000/api/ai/categorize-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions })
    });

    const result2 = await response2.json();
    console.log('\n✅ Second API Response:');
    console.log(`  - Total processed: ${result2.totalProcessed}`);
    console.log(`  - From cache: ${result2.fromCache}`);
    console.log(`  - Newly categorized: ${result2.newlyCategorized}`);
    
    if (result2.fromCache === result2.totalProcessed) {
      console.log('🎉 SUCCESS: All transactions served from cache!');
    } else {
      console.log('⚠️  Some transactions still needed AI categorization');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCategorization(); 