import React, { useState, useEffect } from 'react';
import { TransactionLink, EntityType } from '@/types/transactionLink';
import { Button } from './ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { useSensitiveData } from '@/app/providers';

interface EntityLinkListProps {
  entityType: EntityType;
  entityId: string;
  showSensitiveData?: boolean;
  onLinkUpdated?: (link: TransactionLink) => void;
  onLinkDeleted?: (linkId: string) => void;
}

export const EntityLinkList: React.FC<EntityLinkListProps> = ({
  entityType,
  entityId,
  showSensitiveData = true,
  onLinkUpdated,
  onLinkDeleted,
}) => {
  const [links, setLinks] = useState<TransactionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/transactions/links?entityType=${entityType}&entityId=${entityId}&showSensitiveData=${showSensitiveData}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch links');
      }
      
      const data = await response.json();
      setLinks(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [entityType, entityId, showSensitiveData]);

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this link?')) {
      return;
    }

    setDeletingLinkId(linkId);
    try {
      const response = await fetch(`/api/transactions/links/${linkId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLinks(prev => prev.filter(link => link.id !== linkId));
        onLinkDeleted?.(linkId);
      } else {
        throw new Error('Failed to delete link');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingLinkId(null);
    }
  };

  const formatMetadata = (metadata: any) => {
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        return 'Invalid metadata';
      }
    }

    const parts = [];
    if (metadata.paymentDate) {
      parts.push(`Date: ${new Date(metadata.paymentDate).toLocaleDateString()}`);
    }
    if (metadata.paymentAmount) {
      parts.push(`Amount: $${Math.abs(metadata.paymentAmount).toFixed(2)}`);
    }
    if (metadata.paymentType) {
      parts.push(`Type: ${metadata.paymentType}`);
    }
    if (metadata.detectionMethod) {
      parts.push(`Method: ${metadata.detectionMethod}`);
    }

    return parts.join(' • ');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-600 dark:text-red-400">Error: {error}</div>
          <Button onClick={fetchLinks} className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Linked Transactions ({links.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400 mb-2">
              No transactions linked yet
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Link transactions to track payments and get better insights
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {link.transaction?.name || 'Unknown Transaction'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatMetadata(link.metadata)}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Linked on {new Date(link.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {showSensitiveData 
                      ? `$${Math.abs(link.transaction?.amount || 0).toFixed(2)}`
                      : '••••••'
                    }
                  </div>
                  <Button
                    onClick={() => handleDeleteLink(link.id)}
                    variant="secondary"
                    size="sm"
                    disabled={deletingLinkId === link.id}
                    loading={deletingLinkId === link.id}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 