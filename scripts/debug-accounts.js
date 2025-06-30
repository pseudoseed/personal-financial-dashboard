#!/usr/bin/env node

/**
 * Debug script to identify problematic accounts in the database
 * This script validates account data integrity without making any API calls
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugAccounts() {
  console.log('🔍 Debugging accounts in database...\n');
  
  try {
    // Get all accounts with their plaid items
    const accounts = await prisma.account.findMany({
      where: { hidden: false },
      include: {
        plaidItem: true,
        balances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });
    
    console.log(`📊 Found ${accounts.length} accounts in database\n`);
    
    // Validate each account
    const validationResults = accounts.map(account => {
      const errors = [];
      
      // Check required fields
      if (!account.id) errors.push('Missing account ID');
      if (!account.plaidId) errors.push('Missing plaidId');
      if (!account.name) errors.push('Missing name');
      if (!account.type) errors.push('Missing type');
      
      // Check plaidItem
      if (!account.plaidItem) {
        errors.push('Missing plaidItem');
      } else {
        if (!account.plaidItem.id) errors.push('Missing plaidItem.id');
        if (!account.plaidItem.accessToken) errors.push('Missing accessToken');
        if (!account.plaidItem.institutionId) errors.push('Missing institutionId');
      }
      
      return {
        accountId: account.id,
        plaidId: account.plaidId,
        name: account.name,
        type: account.type,
        institution: account.plaidItem?.institutionName || account.plaidItem?.institutionId || 'Unknown',
        provider: account.plaidItem?.provider || 'Unknown',
        accessToken: account.plaidItem?.accessToken ? 'Present' : 'Missing',
        hasBalance: account.balances.length > 0,
        lastBalance: account.balances[0]?.current || 'No balance',
        errors,
        isValid: errors.length === 0
      };
    });
    
    const validAccounts = validationResults.filter(r => r.isValid);
    const invalidAccounts = validationResults.filter(r => !r.isValid);
    
    console.log(`✅ Valid accounts: ${validAccounts.length}`);
    console.log(`❌ Invalid accounts: ${invalidAccounts.length}\n`);
    
    if (invalidAccounts.length > 0) {
      console.log('🚨 INVALID ACCOUNTS:');
      console.log('==================');
      invalidAccounts.forEach(account => {
        console.log(`\nAccount: ${account.name} (${account.accountId})`);
        console.log(`  Plaid ID: ${account.plaidId}`);
        console.log(`  Type: ${account.type}`);
        console.log(`  Institution: ${account.institution}`);
        console.log(`  Provider: ${account.provider}`);
        console.log(`  Access Token: ${account.accessToken}`);
        console.log(`  Has Balance: ${account.hasBalance}`);
        console.log(`  Last Balance: ${account.lastBalance}`);
        console.log(`  Errors:`);
        account.errors.forEach(error => {
          console.log(`    - ${error}`);
        });
      });
    }
    
    // Group by institution
    const byInstitution = {};
    accounts.forEach(account => {
      const institution = account.plaidItem?.institutionName || account.plaidItem?.institutionId || 'Unknown';
      if (!byInstitution[institution]) {
        byInstitution[institution] = [];
      }
      byInstitution[institution].push(account);
    });
    
    console.log('\n📋 ACCOUNTS BY INSTITUTION:');
    console.log('==========================');
    Object.entries(byInstitution).forEach(([institution, institutionAccounts]) => {
      const validCount = institutionAccounts.filter(acc => 
        validationResults.find(v => v.accountId === acc.id)?.isValid
      ).length;
      const invalidCount = institutionAccounts.length - validCount;
      
      console.log(`\n${institution}:`);
      console.log(`  Total: ${institutionAccounts.length}`);
      console.log(`  Valid: ${validCount}`);
      console.log(`  Invalid: ${invalidCount}`);
      
      institutionAccounts.forEach(account => {
        const validation = validationResults.find(v => v.accountId === account.id);
        const status = validation?.isValid ? '✅' : '❌';
        console.log(`    ${status} ${account.name} (${account.type})`);
      });
    });
    
    // Check for potential issues
    console.log('\n🔍 POTENTIAL ISSUES:');
    console.log('===================');
    
    const accountsWithoutPlaidId = accounts.filter(acc => !acc.plaidId);
    if (accountsWithoutPlaidId.length > 0) {
      console.log(`\n❌ ${accountsWithoutPlaidId.length} accounts without plaidId:`);
      accountsWithoutPlaidId.forEach(acc => {
        console.log(`  - ${acc.name} (${acc.id})`);
      });
    }
    
    const accountsWithoutAccessToken = accounts.filter(acc => !acc.plaidItem?.accessToken);
    if (accountsWithoutAccessToken.length > 0) {
      console.log(`\n❌ ${accountsWithoutAccessToken.length} accounts without accessToken:`);
      accountsWithoutAccessToken.forEach(acc => {
        console.log(`  - ${acc.name} (${acc.id})`);
      });
    }
    
    const accountsWithoutBalance = accounts.filter(acc => acc.balances.length === 0);
    if (accountsWithoutBalance.length > 0) {
      console.log(`\n⚠️  ${accountsWithoutBalance.length} accounts without balance history:`);
      accountsWithoutBalance.forEach(acc => {
        console.log(`  - ${acc.name} (${acc.id})`);
      });
    }
    
    console.log('\n✨ Debug complete!');
    
  } catch (error) {
    console.error('❌ Error debugging accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug function
debugAccounts().catch(console.error); 