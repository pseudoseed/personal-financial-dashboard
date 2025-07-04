import { PrismaClient } from '@prisma/client';
import { backupAllPlaidItems } from './accessTokenBackup';

let backupCompleted = false;
let schedulerStarted = false;

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
    
    // Start the scheduler for future backups
    startScheduler();
    
  } catch (error) {
    console.error('[STARTUP BACKUP] ❌ Error during startup backup:', error);
    // Don't throw - we don't want to block app startup
    backupCompleted = true; // Mark as completed to prevent retries
    
    // Still start the scheduler even if initial backup failed
    startScheduler();
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

/**
 * Schedule backup job to run at 2 AM daily
 */
function scheduleBackupJob() {
  console.log('[SCHEDULER] Setting up backup scheduler...');
  
  // Calculate time until next 2 AM
  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(2, 0, 0, 0);
  
  // If it's past 2 AM today, schedule for tomorrow
  if (now.getHours() >= 2) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  const timeUntilNextRun = nextRun.getTime() - now.getTime();
  
  console.log(`[SCHEDULER] Next backup scheduled for: ${nextRun.toISOString()}`);
  console.log(`[SCHEDULER] Time until next run: ${Math.round(timeUntilNextRun / 1000 / 60)} minutes`);
  
  // Schedule the first run
  setTimeout(() => {
    runBackupJob();
    // Then schedule to run every 24 hours
    setInterval(runBackupJob, 24 * 60 * 60 * 1000);
  }, timeUntilNextRun);
}

/**
 * Run the backup job
 */
async function runBackupJob() {
  console.log('[SCHEDULER] Running scheduled backup job...');
  
  try {
    const prisma = new PrismaClient();
    const result = await backupAllPlaidItems(prisma);
    await prisma.$disconnect();
    console.log('[SCHEDULER] Scheduled backup completed:', result.message);
  } catch (error) {
    console.error('[SCHEDULER] Scheduled backup failed:', error);
  }
}

/**
 * Start the scheduler
 */
function startScheduler() {
  if (schedulerStarted) {
    return; // Prevent multiple schedulers
  }
  
  if (process.env.NODE_ENV === 'production') {
    schedulerStarted = true;
    scheduleBackupJob();
  } else {
    console.log('[SCHEDULER] Skipping scheduler in development mode');
  }
} 