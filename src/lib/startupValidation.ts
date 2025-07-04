import { prisma } from './db';
import { initializeStartupBackup, isStartupBackupCompleted } from './startupBackup';

/**
 * Ensures the default user exists, creating it if necessary
 */
export async function ensureDefaultUser(): Promise<boolean> {
  try {
    const defaultUser = await prisma.user.findUnique({
      where: { id: 'default' },
      select: { id: true },
    });

    if (defaultUser) {
      return true;
    }

    await prisma.user.create({
      data: {
        id: 'default',
        email: 'default@example.com',
        name: 'Default User',
      },
    });

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Performs a quick health check for the application
 */
export async function performHealthCheck(): Promise<{
  healthy: boolean;
  details: {
    databaseConnected: boolean;
    defaultUserExists: boolean;
    accountCount: number;
    transactionCount: number;
  };
}> {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
    // Check default user
    const defaultUser = await prisma.user.findUnique({
      where: { id: 'default' },
      select: { id: true },
    });

    // Get basic stats
    const accountCount = await prisma.account.count();
    const transactionCount = await prisma.transaction.count();

    // Initialize startup backup if not completed
    if (!isStartupBackupCompleted()) {
      try {
        console.log('[HEALTH CHECK] Initializing startup backup...');
        await initializeStartupBackup();
        console.log('[HEALTH CHECK] Startup backup completed');
      } catch (error) {
        console.error('[HEALTH CHECK] Startup backup failed:', error);
        // Don't fail health check if backup fails
      }
    }

    return {
      healthy: true,
      details: {
        databaseConnected: true,
        defaultUserExists: !!defaultUser,
        accountCount,
        transactionCount,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      details: {
        databaseConnected: false,
        defaultUserExists: false,
        accountCount: 0,
        transactionCount: 0,
      },
    };
  }
} 