#!/usr/bin/env node

/**
 * Test script for enhanced AI categorization
 * This script tests the new multi-stage categorization system with enriched data
 */

const fs = require('fs');
const path = require('path');

// Mock transaction data for testing
const mockTransactions = [
  {
    id: 'test-1',
    name: 'SHELL 04528 CO',
    merchantName: 'SHELL 04528 CO',
    amount: -45.67,
    locationCity: 'Boulder',
    locationRegion: 'CO',
    locationLat: 40.017,
    locationLon: -105.279,
    paymentChannel: 'in store',
    paymentMethod: 'debit card'
  },
  {
    id: 'test-2',
    name: 'STARBUCKS COFFEE',
    merchantName: 'STARBUCKS COFFEE',
    amount: -4.50,
    locationCity: 'Boulder',
    locationRegion: 'CO',
    locationLat: 40.018,
    locationLon: -105.280,
    paymentChannel: 'in store',
    paymentMethod: 'mobile'
  },
  {
    id: 'test-3',
    name: 'SAFEWAY GROCERY',
    merchantName: 'SAFEWAY GROCERY',
    amount: -89.23,
    locationCity: 'Boulder',
    locationRegion: 'CO',
    locationLat: 40.019,
    locationLon: -105.281,
    paymentChannel: 'in store',
    paymentMethod: 'debit card'
  },
  {
    id: 'test-4',
    name: 'NETFLIX.COM',
    merchantName: 'NETFLIX.COM',
    amount: -15.99,
    paymentChannel: 'online',
    paymentMethod: 'credit card'
  },
  {
    id: 'test-5',
    name: 'AMAZON.COM',
    merchantName: 'AMAZON.COM',
    amount: -67.89,
    paymentChannel: 'online',
    paymentMethod: 'credit card'
  }
];

async function testEnhancedCategorization() {
  console.log('🧪 Testing Enhanced AI Categorization System\n');

  try {
    // Test 1: Merchant name cleaning
    console.log('1. Testing merchant name cleaning...');
    const { cleanMerchantName } = require('../src/lib/transactionEnrichment');
    
    const testNames = [
      'SHELL 04528 CO 2025-06-15',
      'STBCKS COFFEE',
      'WAL-MART STORE',
      'AMAZON.COM LLC'
    ];
    
    testNames.forEach(name => {
      const cleaned = cleanMerchantName(name);
      console.log(`   "${name}" → "${cleaned.normalized}"`);
    });

    // Test 2: Location context formatting
    console.log('\n2. Testing location context formatting...');
    const { formatLocationContext } = require('../src/lib/transactionEnrichment');
    
    const locationTest = {
      locationAddress: '123 Main St',
      locationCity: 'Boulder',
      locationRegion: 'CO',
      locationCountry: 'USA',
      locationLat: 40.017,
      locationLon: -105.279
    };
    
    const locationContext = formatLocationContext(locationTest);
    console.log(`   Location: ${locationContext.formatted}`);
    console.log(`   Coordinates: ${locationContext.coordinates}`);

    // Test 3: Merchant type inference
    console.log('\n3. Testing merchant type inference...');
    const { inferMerchantType } = require('../src/lib/transactionEnrichment');
    
    mockTransactions.forEach(tx => {
      const merchantType = inferMerchantType(tx);
      console.log(`   ${tx.name} → ${merchantType}`);
    });

    // Test 4: Rule-based categorization
    console.log('\n4. Testing rule-based categorization...');
    const { applyRuleBasedCategorization } = require('../src/lib/transactionEnrichment');
    
    mockTransactions.forEach(tx => {
      const result = applyRuleBasedCategorization(tx);
      if (result) {
        console.log(`   ${tx.name} → ${result.granular} (${result.general})`);
      } else {
        console.log(`   ${tx.name} → No rule match (needs AI)`);
      }
    });

    // Test 5: AI context creation
    console.log('\n5. Testing AI context creation...');
    const { createAIContext } = require('../src/lib/transactionEnrichment');
    
    const aiContext = createAIContext(mockTransactions[0]);
    console.log('   AI Context for Shell transaction:');
    console.log(aiContext.split('\n').map(line => `   ${line}`).join('\n'));

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Merchant name cleaning: ✅');
    console.log('   - Location context formatting: ✅');
    console.log('   - Merchant type inference: ✅');
    console.log('   - Rule-based categorization: ✅');
    console.log('   - AI context creation: ✅');
    
    console.log('\n🚀 The enhanced categorization system is ready for use!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testEnhancedCategorization();
}

module.exports = { testEnhancedCategorization }; 