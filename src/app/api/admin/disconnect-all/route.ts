import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { CountryCode } from "plaid";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { trackPlaidApiCall, getCurrentUserId, getAppInstanceId } from "@/lib/plaidTracking";

export async function GET() {
  try {
    // Get all active PlaidItems (excluding manual accounts)
    const activeInstitutions = await prisma.plaidItem.findMany({
      where: {
        status: "active",
        accessToken: {
          not: "manual"
        }
      },
      include: {
        accounts: {
          where: {
            archived: false
          }
        }
      },
      orderBy: {
        institutionName: 'asc'
      }
    });

    // Transform the data for the frontend
    const institutions = activeInstitutions.map(item => ({
      institutionId: item.institutionId,
      institutionName: item.institutionName || 'Unknown Institution',
      accessToken: item.accessToken,
      accountCount: item.accounts.length,
      itemId: item.id
    }));

    return NextResponse.json({
      institutions,
      totalInstitutions: institutions.length,
      totalAccounts: institutions.reduce((sum, inst) => sum + inst.accountCount, 0)
    });
  } catch (error) {
    console.error("[DISCONNECT ALL] Error fetching active institutions:", error);
    return NextResponse.json(
      { error: "Failed to fetch active institutions" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    console.log("[DISCONNECT ALL] Starting disconnect all operation");

    // Get all active PlaidItems (excluding manual accounts)
    const activeInstitutions = await prisma.plaidItem.findMany({
      where: {
        status: "active",
        accessToken: {
          not: "manual"
        }
      },
      include: {
        accounts: {
          where: {
            archived: false
          }
        }
      }
    });

    if (activeInstitutions.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No active institutions found to disconnect"
      }, { status: 400 });
    }

    // Extract access tokens
    const accessTokens = activeInstitutions.map(item => item.accessToken);
    const uniqueTokens = [...new Set(accessTokens)];

    console.log(`[DISCONNECT ALL] Found ${uniqueTokens.length} unique access tokens to disconnect`);

    // Create job record
    const job = await prisma.bulkDisconnectJob.create({
      data: {
        inputTokens: uniqueTokens.join(', '),
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
        console.log(`[DISCONNECT ALL] Processing token: ${accessToken.substring(0, 10)}...`);

        // Try to get item info from Plaid first
        let institutionId: string | null = null;
        let institutionName: string | null = null;

        try {
          const itemResponse = await trackPlaidApiCall(
            () => plaidClient.itemGet({ access_token: accessToken }),
            {
              endpoint: '/item/get',
              userId: await getCurrentUserId(),
              appInstanceId: getAppInstanceId(),
              requestData: { accessToken: '***' } // Don't log the actual token
            }
          );
          institutionId = itemResponse.data.item.institution_id || null;
          
          // Get institution name
          if (institutionId) {
            const institutionResponse = await trackPlaidApiCall(
              () => plaidClient.institutionsGetById({
                institution_id: institutionId,
                country_codes: [CountryCode.Us],
              }),
              {
                endpoint: '/institutions/get_by_id',
                institutionId: institutionId,
                userId: await getCurrentUserId(),
                appInstanceId: getAppInstanceId(),
                requestData: { institutionId, countryCodes: [CountryCode.Us] }
              }
            );
            
            if (institutionResponse.data.institution) {
              institutionName = institutionResponse.data.institution.name || null;
            }
          }
        } catch (error) {
          console.log(`[DISCONNECT ALL] Could not get item info for token: ${accessToken.substring(0, 10)}...`);
        }

        // Attempt to disconnect via Plaid API
        await trackPlaidApiCall(
          () => plaidClient.itemRemove({ access_token: accessToken }),
          {
            endpoint: '/item/remove',
            institutionId,
            userId: await getCurrentUserId(),
            appInstanceId: getAppInstanceId(),
            requestData: { accessToken: '***' } // Don't log the actual token
          }
        );

        // Update the PlaidItem status to disconnected
        await prisma.plaidItem.updateMany({
          where: {
            accessToken: accessToken,
            status: 'active'
          },
          data: {
            status: 'disconnected'
          }
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

        console.log(`[DISCONNECT ALL] Successfully disconnected token: ${accessToken.substring(0, 10)}...`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DISCONNECT ALL] Failed to disconnect token ${accessToken.substring(0, 10)}...:`, errorMessage);

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
      operation: 'disconnect_all',
      summary: {
        totalInstitutions: activeInstitutions.length,
        totalAccounts: activeInstitutions.reduce((sum, item) => sum + item.accounts.length, 0),
        uniqueTokens: uniqueTokens.length
      }
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

    console.log(`[DISCONNECT ALL] Job ${job.id} completed. Success: ${successCount}, Failures: ${failureCount}`);

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        createdAt: job.createdAt,
        totalTokens: uniqueTokens.length,
        successCount,
        failureCount,
        status: failureCount === 0 ? 'completed' : 'completed_with_errors',
        reportPath,
        hasReport: true
      },
      summary: {
        totalInstitutions: activeInstitutions.length,
        totalAccounts: activeInstitutions.reduce((sum, item) => sum + item.accounts.length, 0),
        uniqueTokens: uniqueTokens.length
      },
      message: `Processed ${uniqueTokens.length} tokens. ${successCount} successful, ${failureCount} failed.`
    });

  } catch (error) {
    console.error("[DISCONNECT ALL] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process disconnect all request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 