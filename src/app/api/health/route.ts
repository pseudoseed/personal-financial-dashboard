import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Check database connectivity
    const dbCheck = await prisma.$queryRaw`SELECT 1 as health_check`;
    
    // Check if default user exists
    const userCheck = await prisma.user.findUnique({
      where: { id: 'default' },
      select: { id: true }
    });

    // Get basic stats
    const accountCount = await prisma.account.count();
    const transactionCount = await prisma.transaction.count();

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        userExists: !!userCheck,
        accounts: accountCount,
        transactions: transactionCount
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return NextResponse.json(healthStatus);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const healthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      database: {
        connected: false,
        userExists: false,
        accounts: 0,
        transactions: 0
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return NextResponse.json(healthStatus, { status: 503 });
  }
} 