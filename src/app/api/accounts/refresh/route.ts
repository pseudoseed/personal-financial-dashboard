import { NextResponse } from "next/server";
import { smartRefreshAccounts, canUserManualRefresh, getManualRefreshCount } from "@/lib/refreshService";
import { getCurrentUserId } from "@/lib/userManagement";

export async function POST(request: Request) {
  try {
    // Check if this is a manual refresh request
    const body = await request.json().catch(() => ({}));
    const isManualRefresh = body.manual === true;
    const userId = body.userId || await getCurrentUserId();
    const includeTransactions = body.includeTransactions === true;
    
    if (isManualRefresh) {
      // Check rate limiting for manual refreshes
      if (!(await canUserManualRefresh(userId))) {
        const refreshInfo = await getManualRefreshCount(userId);
        const resetTime = new Date(refreshInfo.resetTime).toLocaleString();
        
        return NextResponse.json(
          { 
            error: "Rate limit exceeded", 
            message: `You've reached the daily limit of ${refreshInfo.limit} manual refreshes. Limit resets at ${resetTime}`,
            limit: refreshInfo.limit,
            count: refreshInfo.count,
            resetTime: refreshInfo.resetTime
          },
          { status: 429 }
        );
      }
    }
    
    console.log(`Starting ${isManualRefresh ? 'manual' : 'automatic'} refresh process...`);
    if (includeTransactions) {
      console.log("Transaction sync included in refresh");
    }
    
    // Perform smart refresh
    const results = await smartRefreshAccounts(userId, isManualRefresh, includeTransactions);
    
    // Get refresh count info for manual refreshes
    const refreshInfo = isManualRefresh ? await getManualRefreshCount(userId) : null;
    
    // Determine response status based on results
    const hasErrors = results.errors.length > 0;
    const hasRefreshed = results.refreshed.length > 0;
    
    // If there are errors but no successful refreshes, return 400
    // If there are some errors but also some successes, return 207 (Multi-Status)
    // If everything succeeded, return 200
    let statusCode = 200;
    if (hasErrors && !hasRefreshed) {
      statusCode = 400;
    } else if (hasErrors && hasRefreshed) {
      statusCode = 207; // Multi-Status - partial success
    }
    
    return NextResponse.json({
      success: !hasErrors || hasRefreshed, // Success if no errors OR if some accounts refreshed
      manual: isManualRefresh,
      includeTransactions,
      accountsRefreshed: results.refreshed.length,
      accountsSkipped: results.skipped.length,
      errors: results.errors.length,
      transactionSync: results.transactionSync,
      results,
      ...(refreshInfo && {
        refreshLimit: {
          count: refreshInfo.count,
          limit: refreshInfo.limit,
          resetTime: refreshInfo.resetTime,
        }
      })
    }, { status: statusCode });
  } catch (error) {
    console.error("Error in smart refresh:", error);
    return NextResponse.json(
      { error: "Failed to refresh accounts" },
      { status: 500 }
    );
  }
}
