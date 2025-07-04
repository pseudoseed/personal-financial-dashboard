import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";

export async function POST(request: Request) {
  try {
    const { jobId, resultId } = await request.json();

    if (!jobId || !resultId) {
      return NextResponse.json(
        { error: "Job ID and result ID are required" },
        { status: 400 }
      );
    }

    // Get the failed result
    const result = await (prisma as any).bulkDisconnectResult.findUnique({
      where: { id: resultId },
      include: { job: true },
    });

    if (!result) {
      return NextResponse.json(
        { error: "Result not found" },
        { status: 404 }
      );
    }

    if (result.success) {
      return NextResponse.json(
        { error: "This result was already successful" },
        { status: 400 }
      );
    }

    console.log(`[BULK DISCONNECT RETRY] Retrying token: ${result.accessToken.substring(0, 10)}...`);

    try {
      // Try to get item info from Plaid first
      let institutionId: string | null = null;
      let institutionName: string | null = null;

      try {
        const itemResponse = await plaidClient.itemGet({ access_token: result.accessToken });
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
        console.log(`[BULK DISCONNECT RETRY] Could not get item info for token: ${result.accessToken.substring(0, 10)}...`);
      }

      // Attempt to disconnect via Plaid API
      await plaidClient.itemRemove({ access_token: result.accessToken });

      // If successful, create a deactivated PlaidItem record
      await prisma.plaidItem.create({
        data: {
          itemId: `bulk-disconnect-retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          accessToken: result.accessToken,
          institutionId: institutionId || 'unknown',
          institutionName: institutionName || 'Unknown Institution',
          status: 'disconnected',
          provider: 'plaid',
        },
      });

      // Update result to success
      await (prisma as any).bulkDisconnectResult.update({
        where: { id: resultId },
        data: {
          success: true,
          errorMessage: null,
          institutionId,
          institutionName,
          retryCount: result.retryCount + 1,
        },
      });

      // Update job counts
      await (prisma as any).bulkDisconnectJob.update({
        where: { id: jobId },
        data: {
          successCount: { increment: 1 },
          failureCount: { decrement: 1 },
        },
      });

      console.log(`[BULK DISCONNECT RETRY] Successfully retried token: ${result.accessToken.substring(0, 10)}...`);

      return NextResponse.json({
        success: true,
        message: "Token successfully disconnected on retry",
        institutionName: institutionName || 'Unknown',
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[BULK DISCONNECT RETRY] Failed to retry token ${result.accessToken.substring(0, 10)}...:`, errorMessage);

      // Update result with new error and increment retry count
      await (prisma as any).bulkDisconnectResult.update({
        where: { id: resultId },
        data: {
          errorMessage,
          retryCount: result.retryCount + 1,
        },
      });

      return NextResponse.json({
        success: false,
        error: "Failed to disconnect token on retry",
        details: errorMessage,
      });
    }

  } catch (error) {
    console.error("[BULK DISCONNECT RETRY] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process retry request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 