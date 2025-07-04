const { PrismaClient } = require('@prisma/client');
const { initializeStartupBackup, isStartupBackupCompleted, resetStartupBackupStatus } = require('../src/lib/startupBackup');

const prisma = new PrismaClient();

async function testStartupBackup() {
  try {
    console.log('🧪 Testing Startup Backup System...\n');

    // Test 1: Check initial status
    console.log('1. Initial backup status:', isStartupBackupCompleted());

    // Test 2: Run backup
    console.log('\n2. Running startup backup...');
    await initializeStartupBackup();

    // Test 3: Check status after backup
    console.log('\n3. Backup status after completion:', isStartupBackupCompleted());

    // Test 4: Try to run backup again (should be skipped)
    console.log('\n4. Attempting to run backup again...');
    await initializeStartupBackup();

    // Test 5: Reset and run again
    console.log('\n5. Resetting backup status...');
    resetStartupBackupStatus();
    console.log('   Backup status after reset:', isStartupBackupCompleted());

    console.log('\n6. Running backup after reset...');
    await initializeStartupBackup();

    // Test 6: Check final status
    console.log('\n7. Final backup status:', isStartupBackupCompleted());

    // Test 7: Get backup stats
    console.log('\n8. Checking backup files...');
    const { listBackupFiles } = require('../src/lib/accessTokenBackup');
    const backupFiles = listBackupFiles();
    console.log('   Backup files found:', backupFiles.length);
    backupFiles.forEach(file => {
      console.log(`   - ${file.filename}: ${file.entryCount} entries, ${file.size} bytes`);
    });

    console.log('\n✅ Startup backup test completed successfully!');

  } catch (error) {
    console.error('❌ Startup backup test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStartupBackup(); 