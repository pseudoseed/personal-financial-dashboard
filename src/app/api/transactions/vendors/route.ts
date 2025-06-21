import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, subDays, startOfQuarter, 
  endOfQuarter, subQuarters, startOfYear, endOfYear 
} from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "this_month";
    const accountIds = searchParams.get("accountIds")?.split(",") || [];
    const limit = Math.min(parseInt(searchParams.get("limit") || "11", 10), 30);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    let startDate, endDate;
    const now = new Date();

    // If explicit date range is provided, use it; otherwise use period-based calculation
    if (startDateStr || endDateStr) {
      if (startDateStr) startDate = new Date(startDateStr);
      if (endDateStr) endDate = new Date(endDateStr);
    } else {
      // Fall back to period-based date calculation
      switch (period) {
        case 'this_week':
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          break;
        case 'last_30_days':
          startDate = subDays(now, 30);
          endDate = now;
          break;
        case 'this_quarter':
          startDate = startOfQuarter(now);
          endDate = endOfQuarter(now);
          break;
        case 'last_quarter':
          const lastQuarterStart = startOfQuarter(subQuarters(now, 1));
          startDate = lastQuarterStart;
          endDate = endOfQuarter(lastQuarterStart);
          break;
        case 'this_year':
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
        case 'this_month':
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
      }
    }

    // Build where clause for transactions
    const whereClause: any = {};
    
    // Add date filtering
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }
    
    // Filter by account type - only include depository and credit accounts
    if (accountIds.length > 0) {
      whereClause.accountId = { in: accountIds };
    } else {
      // If no specific accounts selected, get all depository and credit accounts
      const relevantAccounts = await prisma.account.findMany({
        where: {
          type: { in: ['depository', 'credit'] }
        },
        select: { id: true }
      });
      whereClause.accountId = { in: relevantAccounts.map(a => a.id) };
    }
    
    const categories = searchParams.get("categories")?.split(",") || [];
    if (categories.length > 0) {
      whereClause.category = { in: categories };
    }
    const minAmount = searchParams.get("minAmount") ? parseFloat(searchParams.get("minAmount")!) : undefined;
    const maxAmount = searchParams.get("maxAmount") ? parseFloat(searchParams.get("maxAmount")!) : undefined;

    // Debug log the whereClause
    console.log('VENDORS_ENDPOINT_WHERE', JSON.stringify(whereClause, null, 2));

    // Fetch all relevant transactions with account information
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        name: true,
        merchantName: true,
        amount: true,
        accountId: true,
        date: true,
        account: {
          select: {
            type: true
          }
        }
      },
    });

    // Debug log a sample of transactions
    console.log('VENDORS_ENDPOINT_SAMPLE_TX', transactions.slice(0, 10));
    console.log('VENDORS_ENDPOINT_COUNT', transactions.length);
    if (transactions.length > 0) {
      const amounts = transactions.map(t => t.amount);
      console.log('VENDORS_ENDPOINT_MIN_AMOUNT', Math.min(...amounts));
      console.log('VENDORS_ENDPOINT_MAX_AMOUNT', Math.max(...amounts));
    }

    // Filter transactions based on account type and amount
    const filteredTx = transactions.filter(tx => {
      // Check account type and amount
      const isCorrectAccountType = (tx.account.type === 'credit' && tx.amount > 0) || 
                                  (tx.account.type === 'depository' && tx.amount < 0);
      
      // Check transaction name for unwanted patterns
      const name = (tx.merchantName || tx.name || '').toLowerCase();
      const unwantedPatterns = [
        'zelle', 'atm', 'deposit', 'transfer', 'payment', 'direct deposit', 
        'automatic payment', 'auto payment', 'autopay', 'external transfer', 
        'internal transfer', 'mobile deposit', 'thank you', 'bill pay'
      ];
      const isUnwanted = unwantedPatterns.some(pattern => name.includes(pattern));
      
      // Debug logging
      if (!isCorrectAccountType || isUnwanted) {
        console.log('[VENDORS_FILTER] Filtered out transaction:', {
          name: tx.merchantName || tx.name,
          amount: tx.amount,
          accountType: tx.account.type,
          reason: !isCorrectAccountType ? 'wrong_account_type_or_amount' : 'unwanted_pattern',
          pattern: isUnwanted ? unwantedPatterns.find(p => name.includes(p)) : null
        });
      }
      
      return isCorrectAccountType && !isUnwanted;
    });

    console.log('[VENDORS_FILTER] Filtered transactions:', {
      total: transactions.length,
      filtered: filteredTx.length,
      removed: transactions.length - filteredTx.length
    });

    // If debug param is set, return raw transactions
    if (searchParams.get('debug') === 'true') {
      return NextResponse.json({ 
        transactions: filteredTx,
        filterStats: {
          total: transactions.length,
          filtered: filteredTx.length,
          removed: transactions.length - filteredTx.length
        }
      });
    }

    // Group by raw merchantName (or name if merchantName is missing)
    const vendorTotals: Record<string, number> = {};
    for (const tx of filteredTx) {
      const vendor = tx.merchantName || tx.name || 'Other';
      // Use absolute value for consistent spending amounts
      vendorTotals[vendor] = (vendorTotals[vendor] || 0) + Math.abs(tx.amount);
    }
    const vendorEntries = Object.entries(vendorTotals).sort((a, b) => b[1] - a[1]);
    const topVendors = vendorEntries.slice(0, limit);
    const otherTotal = vendorEntries.slice(limit).reduce((sum, [, v]) => sum + v, 0);
    const result = topVendors.map(([vendor, total]) => ({ vendor, total }));
    if (otherTotal > 0) {
      result.push({ vendor: "Other", total: otherTotal });
    }

    return NextResponse.json({ vendors: result });
  } catch (error) {
    console.error("Error in /api/transactions/vendors:", error);
    return NextResponse.json({ error: "Failed to fetch vendor data" }, { status: 500 });
  }
} 