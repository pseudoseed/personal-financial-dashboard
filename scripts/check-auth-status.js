#!/usr/bin/env node

/**
 * Script to check authentication status of all Plaid items
 * This helps diagnose why tokens might be failing after just a few days
 */

const { PrismaClient } = require('@prisma/client');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const prisma = new PrismaClient();

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

async function checkAuthStatus() {
  console.log('🔍 Checking Plaid authentication status...\n');
  
  try {
    // Get all Plaid items (excluding manual ones)
    const items = await prisma.plaidItem.findMany({
      where: {
        accessToken: {
          not: "manual",
        },
        provider: "plaid",
      },
      include: {
        accounts: true,
      },
    });
    
    console.log(`📊 Found ${items.length} Plaid items to check\n`);
    
    const results = [];
    
    for (const item of items) {
      console.log(`🏦 Checking ${item.institutionName || item.institutionId}...`);
      
      try {
        // Use itemGet to check status (this is a free API call)
        const response = await plaidClient.itemGet({
          access_token: item.accessToken,
        });
        
        const plaidItem = response.data.item;
        
        if (plaidItem.error) {
          console.log(`  ❌ ERROR: ${plaidItem.error.error_code} - ${plaidItem.error.error_message}`);
          results.push({
            institution: item.institutionName || item.institutionId,
            status: 'error',
            errorCode: plaidItem.error.error_code,
            errorMessage: plaidItem.error.error_message,
            accounts: item.accounts.length,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        } else {
          console.log(`  ✅ VALID - ${item.accounts.length} accounts`);
          results.push({
            institution: item.institutionName || item.institutionId,
            status: 'valid',
            accounts: item.accounts.length,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }
      } catch (error) {
        console.log(`  ❌ EXCEPTION: ${error.message}`);
        results.push({
          institution: item.institutionName || item.institutionId,
          status: 'exception',
          errorMessage: error.message,
          accounts: item.accounts.length,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }
    }
    
    // Summary
    console.log('\n📋 AUTHENTICATION STATUS SUMMARY:');
    console.log('==================================');
    
    const validItems = results.filter(r => r.status === 'valid');
    const errorItems = results.filter(r => r.status === 'error');
    const exceptionItems = results.filter(r => r.status === 'exception');
    
    console.log(`✅ Valid items: ${validItems.length}`);
    console.log(`❌ Error items: ${errorItems.length}`);
    console.log(`💥 Exception items: ${exceptionItems.length}`);
    
    if (errorItems.length > 0) {
      console.log('\n🚨 ITEMS WITH ERRORS:');
      console.log('====================');
      errorItems.forEach(item => {
        console.log(`\n${item.institution}:`);
        console.log(`  Error: ${item.errorCode} - ${item.errorMessage}`);
        console.log(`  Accounts: ${item.accounts}`);
        console.log(`  Created: ${new Date(item.createdAt).toLocaleDateString()}`);
        console.log(`  Updated: ${new Date(item.updatedAt).toLocaleDateString()}`);
        
        // Provide specific guidance
        switch (item.errorCode) {
          case "ITEM_LOGIN_REQUIRED":
            console.log(`  💡 Action: Re-authenticate with ${item.institution}`);
            break;
          case "INVALID_ACCESS_TOKEN":
            console.log(`  💡 Action: Reconnect ${item.institution} (token expired)`);
            break;
          case "INVALID_CREDENTIALS":
            console.log(`  💡 Action: Update credentials for ${item.institution}`);
            break;
          case "INSTITUTION_DOWN":
            console.log(`  💡 Action: Wait - ${item.institution} is temporarily unavailable`);
            break;
          case "ITEM_LOCKED":
            console.log(`  💡 Action: Contact ${item.institution} - account may be locked`);
            break;
          case "ITEM_PENDING_EXPIRATION":
            console.log(`  💡 Action: Reconnect ${item.institution} soon (expiring)`);
            break;
          case "ITEM_EXPIRED":
            console.log(`  💡 Action: Reconnect ${item.institution} (expired)`);
            break;
          default:
            console.log(`  💡 Action: Reconnect ${item.institution}`);
        }
      });
    }
    
    if (exceptionItems.length > 0) {
      console.log('\n💥 ITEMS WITH EXCEPTIONS:');
      console.log('========================');
      exceptionItems.forEach(item => {
        console.log(`\n${item.institution}:`);
        console.log(`  Exception: ${item.errorMessage}`);
        console.log(`  Accounts: ${item.accounts}`);
        console.log(`  Created: ${new Date(item.createdAt).toLocaleDateString()}`);
        console.log(`  Updated: ${new Date(item.updatedAt).toLocaleDateString()}`);
      });
    }
    
    // Check for patterns
    console.log('\n🔍 PATTERN ANALYSIS:');
    console.log('===================');
    
    const now = new Date();
    const recentErrors = errorItems.filter(item => {
      const updated = new Date(item.updatedAt);
      const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate <= 7; // Last 7 days
    });
    
    if (recentErrors.length > 0) {
      console.log(`⚠️  ${recentErrors.length} items had errors in the last 7 days`);
      console.log('This might indicate:');
      console.log('  - Recent institution security changes');
      console.log('  - Plaid API updates');
      console.log('  - Institution-specific issues');
    }
    
    console.log('\n✨ Auth status check complete!');
    
  } catch (error) {
    console.error('❌ Error checking auth status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkAuthStatus().catch(console.error); 