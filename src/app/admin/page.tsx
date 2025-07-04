import Link from "next/link";

const adminPages = [
  {
    href: "/admin/billing-audit",
    label: "Billing Audit",
    description: "Review Plaid billing and audit logs."
  },
  {
    href: "/admin/bulk-disconnect",
    label: "Bulk Disconnect",
    description: "Manage and disconnect multiple accounts in bulk."
  },
  {
    href: "/admin/orphaned-data",
    label: "Orphaned Data",
    description: "Find and clean up orphaned accounts, transactions, and balances."
  },
  {
    href: "/admin/plaid-actions",
    label: "Plaid Actions",
    description: "Perform advanced Plaid operations and troubleshooting."
  },
  {
    href: "/admin/plaid-usage",
    label: "Plaid Usage",
    description: "View Plaid API usage statistics."
  },
  {
    href: "/admin/user-lookup",
    label: "User Lookup",
    description: "Search for users and view their account details."
  }
];

export default function AdminMainPage() {
  return (
    <main className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <ul className="space-y-4">
        {adminPages.map((page) => (
          <li key={page.href} className="border rounded p-4 hover:bg-gray-50 transition">
            <Link href={page.href} className="text-lg font-semibold text-blue-600 hover:underline">
              {page.label}
            </Link>
            <div className="text-sm text-gray-600 mt-1">{page.description}</div>
          </li>
        ))}
      </ul>
    </main>
  );
} 