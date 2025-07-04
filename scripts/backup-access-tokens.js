const { PrismaClient } = require('@prisma/client');
const { backupAllPlaidItems, getBackupStats, listBackupFiles, cleanupOldBackups } = require('../src/lib/accessTokenBackup.js');

const prisma = new PrismaClient();

async function backupAccessTokens() {
  console.log('🔐 Access Token Backup System');
  console.log('=============================');
  
  try {
    // Get current backup stats
    console.log('\n📊 Current Backup Status:');
    const stats = getBackupStats();
    console.log(`Backup file: ${stats.backupFile}`);
    console.log(`Exists: ${stats.exists}`);
    console.log(`Entry count: ${stats.entryCount}`);
    if (stats.lastModified) {
      console.log(`Last modified: ${stats.lastModified.toISOString()}`);
    }

    // List existing backup files
    console.log('\n📁 Existing Backup Files:');
    const backupFiles = listBackupFiles();
    if (backupFiles.length === 0) {
      console.log('No backup files found');
    } else {
      backupFiles.forEach(file => {
        console.log(`  ${file.filename} (${file.date}) - ${file.entryCount} entries, ${file.size} bytes`);
      });
    }

    // Perform backup
    console.log('\n🔄 Starting backup process...');
    const result = await backupAllPlaidItems(prisma);
    
    console.log('\n✅ Backup Results:');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`Entries added: ${result.entriesAdded}`);
    console.log(`Total entries: ${result.totalEntries}`);
    console.log(`Backup file: ${result.backupFile}`);

    // Clean up old backups
    console.log('\n🧹 Cleaning up old backups...');
    const cleanupResult = cleanupOldBackups();
    console.log(`Cleanup: ${cleanupResult.message}`);

    // Final stats
    console.log('\n📈 Final Backup Status:');
    const finalStats = getBackupStats();
    console.log(`Backup file: ${finalStats.backupFile}`);
    console.log(`Exists: ${finalStats.exists}`);
    console.log(`Entry count: ${finalStats.entryCount}`);
    if (finalStats.lastModified) {
      console.log(`Last modified: ${finalStats.lastModified.toISOString()}`);
    }

    console.log('\n🎉 Backup process completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during backup process:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backup
backupAccessTokens(); 