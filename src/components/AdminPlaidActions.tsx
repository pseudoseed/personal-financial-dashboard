"use client";

import { useState } from 'react';

interface PlaidItem {
  id: string;
  institutionName: string | null;
  institutionId: string;
  accounts: Array<{ name: string }>;
  updatedAt: string;
}

interface AdminPlaidActionsProps {
  item: PlaidItem;
  onAction: () => void;
}

export function AdminPlaidActions({ item, onAction }: AdminPlaidActionsProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRestore = async () => {
    if (!confirm(`Are you sure you want to restore "${item.institutionName || item.institutionId}"?`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/admin/plaid-items/${item.id}/restore`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('PlaidItem restored successfully!');
        onAction(); // Refresh the page
      } else {
        const error = await response.json();
        alert(`Failed to restore: ${error.error}`);
      }
    } catch (error) {
      alert('Error restoring PlaidItem');
      console.error('Restore error:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE "${item.institutionName || item.institutionId}"?\n\nThis will delete ALL associated accounts, transactions, and data. This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/plaid-items/${item.id}/delete`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('PlaidItem deleted successfully!');
        onAction(); // Refresh the page
      } else {
        const error = await response.json();
        alert(`Failed to delete: ${error.error}`);
      }
    } catch (error) {
      alert('Error deleting PlaidItem');
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleRestore}
        disabled={isRestoring || isDeleting}
        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
      >
        {isRestoring ? 'Restoring...' : 'Restore'}
      </button>
      <button
        onClick={handleDelete}
        disabled={isRestoring || isDeleting}
        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
} 