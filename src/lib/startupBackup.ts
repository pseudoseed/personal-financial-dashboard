import { PrismaClient } from '@prisma/client';
import { backupAllPlaidItems } from './accessTokenBackup';

let backupCompleted = false;

/**
 * Initialize startup backup service
 * This runs once per app session to backup all Plaid access tokens
 */
export async function initializeStartupBackup(): Promise<void> {
  // Prevent multiple backups in the same session
  if (backupCompleted) {
    return;
  }

  try {
    console.log('[STARTUP BACKUP] Initializing automatic token backup...');
    
    const prisma = new PrismaClient();
    
    // Run the backup
    const result = await backupAllPlaidItems(prisma);
    
    if (result.success) {
      console.log(`[STARTUP BACKUP] ✅ Success: ${result.message}`);
      console.log(`[STARTUP BACKUP] 📊 Added ${result.entriesAdded} new entries, ${result.totalEntries} total entries`);
      console.log(`[STARTUP BACKUP] 📁 Backup file: ${result.backupFile}`);
    } else {
      console.error(`[STARTUP BACKUP] ❌ Failed: ${result.message}`);
    }
    
    await prisma.$disconnect();
    
    // Mark backup as completed for this session
    backupCompleted = true;
    
  } catch (error) {
    console.error('[STARTUP BACKUP] ❌ Error during startup backup:', error);
    // Don't throw - we don't want to block app startup
    backupCompleted = true; // Mark as completed to prevent retries
  }
}

/**
 * Check if startup backup has been completed
 */
export function isStartupBackupCompleted(): boolean {
  return backupCompleted;
}

/**
 * Reset backup completion status (useful for testing)
 */
export function resetStartupBackupStatus(): void {
  backupCompleted = false;
} 