import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AccountDetails } from "@/components/AccountDetails";
import Link from "next/link";

interface PageProps {
  params: Promise<{
    accountId: string;
  }>;
}

export default async function AccountPage({ params }: PageProps) {
  const { accountId } = await params;
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      plaidItem: true,
      transactions: {
        orderBy: { date: "desc" },
        take: 1000, // Show more transactions in the UI
      },
      downloadLogs: {
        orderBy: { createdAt: "desc" },
        take: 5, // Show last 5 download attempts
      },
    },
  });

  if (!account) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/dashboard/accounts"
        className="text-surface-600 hover:text-surface-800 dark:text-gray-400 dark:hover:text-gray-200 mb-8 inline-block transition-colors"
      >
        ← Back to Accounts
      </Link>

      <AccountDetails account={account} />
    </div>
  );
}
