import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { name, type, subtype, balance, metadata, url } =
      await request.json();

    // Create a manual PlaidItem to associate with this account
    const plaidItem = await prisma.plaidItem.create({
      data: {
        itemId: `manual_${Date.now()}`, // Generate a unique ID
        accessToken: "manual", // Placeholder since we don't need a real token
        institutionId: "manual",
        institutionName: "Manual Account",
      },
    });

    // Create the account
    const account = await prisma.account.create({
      data: {
        plaidId: `manual_${Date.now()}`, // Generate a unique ID
        name,
        type,
        subtype: subtype || null,
        metadata: metadata || null,
        url: url || null,
        itemId: plaidItem.id,
        userId: "default", // Add the required userId field
      },
    });

    // Create initial balance
    await prisma.accountBalance.create({
      data: {
        accountId: account.id,
        current: parseFloat(balance),
        available: parseFloat(balance),
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        ...account,
        balance: {
          current: parseFloat(balance),
          available: parseFloat(balance),
        },
      },
    });
  } catch (error) {
    console.error("Error creating manual account:", error);
    return NextResponse.json(
      { error: "Failed to create manual account" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    console.log("Received manual account update request:", body);

    const { accountId, balance } = body;
    if (!accountId || balance === undefined) {
      console.error("Missing required fields:", { accountId, balance });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the account to verify it exists and is a manual account
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        plaidItem: true,
      },
    });

    if (!account) {
      console.error("Account not found:", accountId);
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.plaidItem.accessToken !== "manual") {
      console.error("Not a manual account:", {
        accountId,
        accessToken: account.plaidItem.accessToken,
      });
      return NextResponse.json(
        { error: "Only manual accounts can be updated directly" },
        { status: 400 }
      );
    }

    // Create new balance record
    const newBalance = await prisma.accountBalance.create({
      data: {
        accountId,
        current: balance,
        available: balance,
        limit: null,
      },
    });

    console.log("Created new balance record:", newBalance);

    return NextResponse.json({
      success: true,
      balance: newBalance,
    });
  } catch (error) {
    console.error("Error updating manual account balance:", error);
    return NextResponse.json(
      { error: "Failed to update account balance" },
      { status: 500 }
    );
  }
}
