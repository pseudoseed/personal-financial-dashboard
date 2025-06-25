import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateDataIntegrity, getDataHealthSummary } from '@/lib/dataValidation';

export async function GET() {
  try {
    // Basic database connectivity check
    await prisma.$queryRaw`SELECT 1`;

    // Get data health summary
    const healthSummary = await getDataHealthSummary(prisma);

    // Validate data integrity
    const validationResult = await validateDataIntegrity(prisma);

    // Determine overall health status
    const hasOrphanedRecords = 
      validationResult.orphanedAccounts.length > 0 ||
      validationResult.orphanedBalances.length > 0 ||
      validationResult.orphanedTransactions.length > 0 ||
      validationResult.orphanedDownloadLogs.length > 0;

    const hasInconsistencies = validationResult.dataInconsistencies.some(
      inconsistency => inconsistency.type !== "Summary Statistics"
    );

    const status = hasOrphanedRecords || hasInconsistencies ? "warning" : "healthy";

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        health: healthSummary,
      },
      dataIntegrity: {
        orphanedRecords: {
          accounts: validationResult.orphanedAccounts.length,
          balances: validationResult.orphanedBalances.length,
          transactions: validationResult.orphanedTransactions.length,
          downloadLogs: validationResult.orphanedDownloadLogs.length,
        },
        inconsistencies: validationResult.dataInconsistencies.filter(
          inconsistency => inconsistency.type !== "Summary Statistics"
        ),
        summary: validationResult.dataInconsistencies.find(
          inconsistency => inconsistency.type === "Summary Statistics"
        ),
      },
      details: {
        orphanedAccounts: validationResult.orphanedAccounts,
        orphanedBalances: validationResult.orphanedBalances,
        orphanedTransactions: validationResult.orphanedTransactions,
        orphanedDownloadLogs: validationResult.orphanedDownloadLogs,
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
} 