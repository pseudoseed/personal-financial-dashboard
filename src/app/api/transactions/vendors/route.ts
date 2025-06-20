import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "monthly";
    const accountIds = searchParams.get("accountIds")?.split(",") || [];
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const categories = searchParams.get("categories")?.split(",") || [];
    const minAmount = searchParams.get("minAmount") ? parseFloat(searchParams.get("minAmount")!) : undefined;
    const maxAmount = searchParams.get("maxAmount") ? parseFloat(searchParams.get("maxAmount")!) : undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 25);

    // Build where clause for transactions
    const whereClause: any = {
      amount: { lt: 0 }, // Only expenses
    };
    if (accountIds.length > 0) {
      whereClause.accountId = { in: accountIds };
    }
    if (startDateStr || endDateStr) {
      whereClause.date = {};
      if (startDateStr) whereClause.date.gte = new Date(startDateStr);
      if (endDateStr) whereClause.date.lte = new Date(endDateStr);
    }
    if (categories.length > 0) {
      whereClause.category = { in: categories };
    }
    if (minAmount !== undefined || maxAmount !== undefined) {
      // Always keep lt: 0 (expenses only)
      if (minAmount !== undefined) whereClause.amount.lte = -Math.abs(minAmount); // negative
      if (maxAmount !== undefined) whereClause.amount.gte = -Math.abs(maxAmount); // negative
    }

    // Fetch all relevant transactions
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        name: true,
        merchantName: true,
        amount: true,
      },
    });

    // Normalize/merge vendor names
    function normalizeVendor(name: string | null | undefined) {
      if (!name) return "Other";
      let n = name.trim().toLowerCase();
      n = n.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      // Remove generic payment/transfer/thank you/auto payment phrases
      const unwanted = [
        "payment", "thank you", "automatic payment", "auto payment", "autopay", "transfer", "external transfer", "internal transfer", "deposit", "withdrawal", "credit card payment", "bill pay", "mobile deposit"
      ];
      for (const bad of unwanted) {
        if (n.includes(bad)) return null;
      }
      // Merge only known variants
      if (n.includes("costco")) return "Costco";
      if (n.includes("amazon")) return "Amazon";
      if (n.includes("starbucks")) return "Starbucks";
      if (n.includes("walmart")) return "Walmart";
      if (n.includes("target")) return "Target";
      if (n.includes("google")) return "Google";
      if (n.includes("apple")) return "Apple";
      if (n.includes("shell")) return "Shell";
      if (n.includes("chevron")) return "Chevron";
      if (n.includes("kroger")) return "Kroger";
      if (n.includes("safeway")) return "Safeway";
      if (n.includes("whole foods")) return "Whole Foods";
      if (n.includes("mcdonald")) return "McDonalds";
      if (n.includes("chipotle")) return "Chipotle";
      // Otherwise, return cleaned-up name in title case
      return n.replace(/\b\w/g, c => c.toUpperCase());
    }

    // Aggregate spend by vendor
    const vendorTotals: Record<string, number> = {};
    for (const tx of transactions) {
      const vendor = normalizeVendor(tx.merchantName || tx.name);
      if (!vendor) continue; // skip unwanted
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