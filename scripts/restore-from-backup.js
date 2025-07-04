const { PrismaClient } = require('@prisma/client');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { listBackupFiles } = require('../src/lib/accessTokenBackup.ts');

const prisma = new PrismaClient();

/**
 * Parse CSV backup file
 */
function parseBackupFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('Backup file is empty or invalid');
  }

  const headers = lines[0].split(',');
  const entries = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(',').map(val => val.replace(/"/g, ''));
    
    if (values.length >= headers.length) {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = values[index];
      });
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Restore access tokens from backup
 */
async function restoreFromBackup(backupFile, dryRun = true) {
  console.log(`🔧 Restoring from backup: ${backupFile}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log('='.repeat(60));

  try {
    // Parse backup file
    const entries = parseBackupFile(backupFile);
    console.log(`📊 Found ${entries.length} access token entries in backup`);

    // Get current PlaidItems from database
    const currentPlaidItems = await prisma.plaidItem.findMany();
    console.log(`📊 Found ${currentPlaidItems.length} PlaidItems in database`);

    const currentTokens = new Set(currentPlaidItems.map(item => item.accessToken));
    const backupTokens = new Set(entries.map(entry => entry.access_token));

    // Find missing tokens (in backup but not in database)
    const missingTokens = entries.filter(entry => !currentTokens.has(entry.access_token));
    console.log(`🔍 Found ${missingTokens.length} access tokens in backup that are missing from database`);

    if (missingTokens.length === 0) {
      console.log('✅ All access tokens from backup are already in the database');
      return;
    }

    // Show what would be restored
    console.log('\n📋 Missing access tokens:');
    missingTokens.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.institution_name || entry.institution_id}`);
      console.log(`     Access token: ${entry.access_token.substring(0, 20)}...`);
      console.log(`     Status: ${entry.status}`);
      console.log(`     Created: ${entry.created_at}`);
      console.log('');
    });

    if (dryRun) {
      console.log('🔍 DRY RUN: No changes were made');
      console.log(`💡 To apply changes, run with --live flag`);
      return;
    }

    // Apply changes
    console.log('\n🔄 Applying changes to database...');
    let restored = 0;
    let errors = 0;

    for (const entry of missingTokens) {
      try {
        // Check if PlaidItem with this ID already exists
        const existingItem = await prisma.plaidItem.findUnique({
          where: { id: entry.plaid_item_id }
        });

        if (existingItem) {
          console.log(`⚠️  PlaidItem ${entry.plaid_item_id} already exists, skipping`);
          continue;
        }

        // Create new PlaidItem
        await prisma.plaidItem.create({
          data: {
            id: entry.plaid_item_id,
            itemId: entry.item_id,
            accessToken: entry.access_token,
            institutionId: entry.institution_id,
            institutionName: entry.institution_name || null,
            status: entry.status,
            provider: entry.provider,
            createdAt: new Date(entry.created_at),
            updatedAt: new Date(entry.updated_at),
          }
        });

        console.log(`✅ Restored access token for ${entry.institution_name || entry.institution_id}`);
        restored++;
      } catch (error) {
        console.error(`❌ Error restoring ${entry.institution_name || entry.institution_id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 Restoration Summary:');
    console.log(`Successfully restored: ${restored}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${missingTokens.length}`);

  } catch (error) {
    console.error('❌ Error during restoration:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const backupFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1];

  console.log('🔐 Access Token Recovery System');
  console.log('===============================');

  try {
    if (backupFile) {
      // Restore from specific file
      await restoreFromBackup(backupFile, dryRun);
    } else {
      // List available backup files
      console.log('\n📁 Available backup files:');
      const backupFiles = listBackupFiles();
      
      if (backupFiles.length === 0) {
        console.log('No backup files found');
        return;
      }

      backupFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.filename} (${file.date}) - ${file.entryCount} entries`);
      });

      console.log('\n💡 Usage:');
      console.log('  node scripts/restore-from-backup.js --file=backups/access-tokens-2024-01-15.csv');
      console.log('  node scripts/restore-from-backup.js --file=backups/access-tokens-2024-01-15.csv --live');
      console.log('\n  --live: Apply changes (default is dry run)');
      console.log('  --file: Specify backup file to restore from');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main(); 