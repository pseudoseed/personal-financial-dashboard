import { NextResponse } from 'next/server';
import { performHealthCheck } from '@/lib/startupValidation';

export async function GET() {
  try {
    const healthCheck = await performHealthCheck();

    if (healthCheck.healthy) {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: healthCheck.details.databaseConnected,
          userExists: healthCheck.details.defaultUserExists,
          accounts: healthCheck.details.accountCount,
          transactions: healthCheck.details.transactionCount
        },
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };

      return NextResponse.json(healthStatus);
    } else {
      const healthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        database: {
          connected: healthCheck.details.databaseConnected,
          userExists: healthCheck.details.defaultUserExists,
          accounts: healthCheck.details.accountCount,
          transactions: healthCheck.details.transactionCount
        },
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };

      return NextResponse.json(healthStatus, { status: 503 });
    }
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