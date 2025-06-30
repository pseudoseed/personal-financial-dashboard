#!/usr/bin/env node

/**
 * Script to identify institutions with failing accounts
 * This helps determine which institutions need to be reconnected
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function identifyFailingInstitutions() {
  console.log('🔍 Identifying institutions with failing accounts...\n');
  
  try {
    // Get all accounts with their plaid items
    const accounts = await prisma.account.findMany({
      where: { hidden: false },
      include: {
        plaidItem: true,
      },
    });
    
    // Group accounts by institution
    const byInstitution = {};
    accounts.forEach(account => {
      const institution = account.plaidItem?.institutionName || account.plaidItem?.institutionId || 'Unknown';
      if (!byInstitution[institution]) {
        byInstitution[institution] = [];
      }
      byInstitution[institution].push(account);
    });
    
    console.log('📋 ACCOUNTS BY INSTITUTION:');
    console.log('==========================');
    
    Object.entries(byInstitution).forEach(([institution, institutionAccounts]) => {
      console.log(`\n🏦 ${institution}:`);
      console.log(`  Total accounts: ${institutionAccounts.length}`);
      
      institutionAccounts.forEach(account => {
        const isManual = account.plaidItem?.accessToken === 'manual';
        const status = isManual ? '📝 MANUAL' : '🔗 PLAID';
        console.log(`    ${status} ${account.name} (${account.type}) - ${account.id}`);
      });
    });
    
    // Identify potential issues
    console.log('\n🔍 POTENTIAL ISSUES:');
    console.log('===================');
    
    const plaidInstitutions = Object.entries(byInstitution).filter(([institution, accounts]) => 
      accounts.some(acc => acc.plaidItem?.accessToken !== 'manual')
    );
    
    console.log(`\n🔗 Plaid-connected institutions: ${plaidInstitutions.length}`);
    plaidInstitutions.forEach(([institution, accounts]) => {
      const plaidAccounts = accounts.filter(acc => acc.plaidItem?.accessToken !== 'manual');
      console.log(`  - ${institution}: ${plaidAccounts.length} accounts`);
    });
    
    const manualInstitutions = Object.entries(byInstitution).filter(([institution, accounts]) => 
      accounts.every(acc => acc.plaidItem?.accessToken === 'manual')
    );
    
    console.log(`\n📝 Manual-only institutions: ${manualInstitutions.length}`);
    manualInstitutions.forEach(([institution, accounts]) => {
      console.log(`  - ${institution}: ${accounts.length} accounts`);
    });
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('==================');
    console.log('1. If you see 400 errors for Plaid accounts, those institutions need reconnection');
    console.log('2. Manual accounts are working fine and don\'t need reconnection');
    console.log('3. To reconnect: Go to Accounts page → Disconnect institution → Reconnect');
    
    console.log('\n✨ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error analyzing institutions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
identifyFailingInstitutions().catch(console.error); 