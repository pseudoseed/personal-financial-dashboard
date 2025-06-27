import { prisma } from './db';

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

    console.log('[STARTUP] Creating default user...');
    await prisma.user.create({
      data: {
        id: 'default',
        email: 'default@example.com',
        name: 'Default User',
      },
    });

    console.log('[STARTUP] Default user created successfully');
    return true;
  } catch (error) {
    console.error('[STARTUP] Failed to ensure default user:', error);
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
    console.error('[HEALTH] Health check failed:', error);
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