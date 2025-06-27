import { NextResponse } from "next/server";
import { 
  smartSyncTransactions, 
  canUserManualTransactionSync, 
  getManualTransactionSyncCount 
} from "@/lib/transactionSyncService";
import { getCurrentUserId } from "@/lib/userManagement";

export async function POST(request: Request) {
  try {
    // Check if this is a manual sync request
    const body = await request.json().catch(() => ({}));
    const isManualSync = body.manual === true;
    const userId = body.userId || await getCurrentUserId();
    const forceSync = body.force === true;
    const accountIds = body.accountIds;
    
    if (isManualSync) {
      // Check rate limiting for manual syncs
      if (!canUserManualTransactionSync(userId)) {
        const syncInfo = getManualTransactionSyncCount(userId);
        const resetTime = new Date(syncInfo.resetTime).toLocaleString();
        
        return NextResponse.json(
          { 
            error: "Rate limit exceeded", 
            message: `You've reached the daily limit of ${syncInfo.limit} manual transaction syncs. Limit resets at ${resetTime}`,
            limit: syncInfo.limit,
            count: syncInfo.count,
            resetTime: syncInfo.resetTime
          },
          { status: 429 }
        );
      }
    }
    
    console.log(`Starting ${isManualSync ? 'manual' : 'automatic'} transaction sync process...`);
    
    // Perform smart transaction sync
    const results = await smartSyncTransactions(userId, forceSync, accountIds);
    
    // Get sync count info for manual syncs
    const syncInfo = isManualSync ? getManualTransactionSyncCount(userId) : null;
    
    return NextResponse.json({
      success: true,
      manual: isManualSync,
      force: forceSync,
      accountsSynced: results.synced.length,
      accountsSkipped: results.skipped.length,
      errors: results.errors.length,
      totalTransactions: results.totalTransactions,
      results,
      ...(syncInfo && {
        syncLimit: {
          count: syncInfo.count,
          limit: syncInfo.limit,
          resetTime: syncInfo.resetTime,
        }
      })
    });
  } catch (error) {
    console.error("Error in smart transaction sync:", error);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 }
    );
  }
} 