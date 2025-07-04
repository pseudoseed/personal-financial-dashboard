import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(request: Request) {
  try {
    const { tokens } = await request.json();

    if (!tokens || typeof tokens !== 'string') {
      return NextResponse.json(
        { error: "Tokens input is required" },
        { status: 400 }
      );
    }

    // Parse and validate tokens
    const tokenList = tokens
      .split(',')
      .map(token => token.trim())
      .filter(token => token.length > 0);

    if (tokenList.length === 0) {
      return NextResponse.json(
        { error: "No valid tokens provided" },
        { status: 400 }
      );
    }

    // Validate token format (Plaid access tokens follow a specific pattern)
    const validTokens = [];
    const invalidTokens = [];
    
    for (const token of tokenList) {
      // Plaid access tokens typically follow the pattern: access-{environment}-{uuid}
      // Examples: access-production-4e402271-8191-4037-4e7e-0b3089446e1f
      //           access-sandbox-12345678-1234-1234-1234-123456789012
      const tokenPattern = /^access-(production|sandbox|development)-[a-f0-9-]{36}$/;
      
      if (tokenPattern.test(token)) {
        validTokens.push(token);
      } else {
        invalidTokens.push(token);
      }
    }

    if (validTokens.length === 0) {
      return NextResponse.json(
        { 
          error: "No valid Plaid access tokens found",
          details: {
            invalidTokens,
            message: "Plaid access tokens must follow the format: access-{environment}-{uuid}"
          }
        },
        { status: 400 }
      );
    }

    if (invalidTokens.length > 0) {
      console.log(`[BULK DISCONNECT] Invalid tokens filtered out:`, invalidTokens);
    }

    // Remove duplicates from valid tokens
    const uniqueTokens = [...new Set(validTokens)];

    console.log(`[BULK DISCONNECT] Starting job with ${uniqueTokens.length} unique tokens`);

    // Create job record
    const job = await prisma.bulkDisconnectJob.create({
      data: {
        inputTokens: tokens,
        totalTokens: uniqueTokens.length,
        status: 'processing',
      },
    });

    // Process tokens individually
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const accessToken of uniqueTokens) {
      try {
        console.log(`[BULK DISCONNECT] Processing token: ${accessToken.substring(0, 10)}...`);

        // Try to get item info from Plaid first
        let institutionId: string | null = null;
        let institutionName: string | null = null;

        try {
          const itemResponse = await plaidClient.itemGet({ access_token: accessToken });
          institutionId = itemResponse.data.item.institution_id;
          
          // Get institution name
          if (institutionId) {
            const institutionResponse = await plaidClient.institutionsGetById({
              institution_id: institutionId,
              country_codes: ['US' as any],
            });
            
            if (institutionResponse.data.institution) {
              institutionName = institutionResponse.data.institution.name;
            }
          }
        } catch (error) {
          console.log(`[BULK DISCONNECT] Could not get item info for token: ${accessToken.substring(0, 10)}...`);
        }

        // Attempt to disconnect via Plaid API
        await plaidClient.itemRemove({ access_token: accessToken });

        // If successful, create a deactivated PlaidItem record
        await prisma.plaidItem.create({
          data: {
            itemId: `bulk-disconnect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            accessToken: accessToken,
            institutionId: institutionId || 'unknown',
            institutionName: institutionName || 'Unknown Institution',
            status: 'disconnected',
            provider: 'plaid',
          },
        });

        // Record success
        await prisma.bulkDisconnectResult.create({
          data: {
            jobId: job.id,
            accessToken: accessToken,
            institutionId,
            institutionName,
            success: true,
          },
        });

        successCount++;
        results.push({
          accessToken: accessToken,
          institutionName: institutionName || 'Unknown',
          success: true,
        });

        console.log(`[BULK DISCONNECT] Successfully disconnected token: ${accessToken.substring(0, 10)}...`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[BULK DISCONNECT] Failed to disconnect token ${accessToken.substring(0, 10)}...:`, errorMessage);

        // Record failure
        await prisma.bulkDisconnectResult.create({
          data: {
            jobId: job.id,
            accessToken: accessToken,
            institutionId: null,
            institutionName: null,
            success: false,
            errorMessage,
          },
        });

        failureCount++;
        results.push({
          accessToken: accessToken,
          institutionName: 'Unknown',
          success: false,
          error: errorMessage,
        });
      }

      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Generate report
    const reportData = {
      jobId: job.id,
      createdAt: job.createdAt,
      totalTokens: uniqueTokens.length,
      successCount,
      failureCount,
      results,
    };

    const reportPath = `reports/bulk-disconnect/job-${job.id}-${Date.now()}.json`;
    const fullReportPath = join(process.cwd(), reportPath);

    // Ensure directory exists
    mkdirSync(join(process.cwd(), 'reports/bulk-disconnect'), { recursive: true });

    // Write report file
    writeFileSync(fullReportPath, JSON.stringify(reportData, null, 2));

    // Update job with final status
    await prisma.bulkDisconnectJob.update({
      where: { id: job.id },
      data: {
        successCount,
        failureCount,
        status: failureCount === 0 ? 'completed' : 'completed_with_errors',
        reportPath,
      },
    });

    console.log(`[BULK DISCONNECT] Job ${job.id} completed. Success: ${successCount}, Failures: ${failureCount}`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      totalTokens: uniqueTokens.length,
      successCount,
      failureCount,
      reportPath,
      message: `Processed ${uniqueTokens.length} tokens. ${successCount} successful, ${failureCount} failed.`,
    });

  } catch (error) {
    console.error("[BULK DISCONNECT] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process bulk disconnect request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get job history
    const jobs = await prisma.bulkDisconnectJob.findMany({
      include: {
        results: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 jobs
    });

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        createdAt: job.createdAt,
        totalTokens: job.totalTokens,
        successCount: job.successCount,
        failureCount: job.failureCount,
        status: job.status,
        reportPath: job.reportPath || null,
        hasReport: Boolean(job.reportPath),
      })),
    });
  } catch (error) {
    console.error("[BULK DISCONNECT] Error fetching job history:", error);
    return NextResponse.json(
      { error: "Failed to fetch job history" },
      { status: 500 }
    );
  }
} 