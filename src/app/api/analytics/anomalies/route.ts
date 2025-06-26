import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

// Known bad actors and suspicious patterns
const SUSPICIOUS_PATTERNS = [
  // Common scam patterns
  { pattern: /support.*urgent/i, reason: 'Potential support scam' },
  { pattern: /verify.*account/i, reason: 'Potential verification scam' },
  { pattern: /suspended.*account/i, reason: 'Potential account suspension scam' },
  { pattern: /refund.*pending/i, reason: 'Potential refund scam' },
  { pattern: /gift.*card/i, reason: 'Gift card purchase (common scam method)' },
  { pattern: /bitcoin|crypto|eth/i, reason: 'Cryptocurrency purchase' },
  { pattern: /western.*union|money.*gram/i, reason: 'Money transfer service' },
  { pattern: /paypal.*me|venmo.*request/i, reason: 'Peer-to-peer payment' },
  
  // Subscription traps
  { pattern: /free.*trial.*cancel/i, reason: 'Free trial subscription' },
  { pattern: /subscription.*renewal/i, reason: 'Subscription renewal' },
  
  // High-risk merchants (common in fraud)
  { pattern: /amazon.*gift.*card/i, reason: 'Amazon gift card purchase' },
  { pattern: /steam.*wallet/i, reason: 'Steam wallet purchase' },
  { pattern: /google.*play.*card/i, reason: 'Google Play card purchase' },
];

// Known legitimate transaction patterns to exclude
const LEGITIMATE_PATTERNS = [
  // Credit card payments
  /payment.*thank.*you/i,
  /credit.*card.*payment/i,
  /autopay/i,
  /payment.*to.*card/i,
  /chase.*credit.*crd.*autopay/i,
  /card.*ending.*in/i,
  
  // ATM transactions
  /atm.*cash.*deposit/i,
  /atm.*withdrawal/i,
  /atm.*deposit/i,
  /atm.*credit/i,
  
  // Bank transfers
  /zelle.*payment/i,
  /zelle.*from/i,
  /zelle.*to/i,
  /online.*transfer/i,
  /external.*transfer/i,
  /internal.*transfer/i,
  /wire.*transfer/i,
  
  // Deposits and credits
  /deposit/i,
  /direct.*deposit/i,
  /mobile.*deposit/i,
  /check.*deposit/i,
  /constant.*con.*osv/i,  // Direct deposit pattern
  /ach.*credit/i,
  /ach.*deposit/i,
  /electronic.*deposit/i,
  
  // Loan payments
  /loan.*payment/i,
  /mortgage.*payment/i,
  /car.*payment/i,
  
  // Utility payments
  /utility.*payment/i,
  /bill.*payment/i,
  /automatic.*payment/i,
  
  // Refunds and credits
  /refund/i,
  /credit/i,
  /reversal/i,
  /adjustment/i,
  
  // Investment transactions
  /investment/i,
  /dividend/i,
  /interest.*payment/i,
  
  // Government payments
  /irs.*payment/i,
  /tax.*payment/i,
  /government.*payment/i,
];

// Known duplicate charge patterns
const DUPLICATE_PATTERNS = [
  { pattern: /double.*charge/i, reason: 'Explicitly marked as double charge' },
  { pattern: /duplicate.*transaction/i, reason: 'Explicitly marked as duplicate' },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get or create default user (same logic as dismiss-pattern route)
    let user = await (prisma as any).user.findFirst({
      where: { email: 'default@example.com' }
    });

    if (!user) {
      user = await (prisma as any).user.create({
        data: {
          email: 'default@example.com',
          name: 'Default User'
        }
      });
    }
    
    const userId = user.id;
    
    // Get or create user settings
    let settings = await (prisma as any).anomalyDetectionSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await (prisma as any).anomalyDetectionSettings.create({
        data: {
          userId,
          minAmount: 50,
          maxAmount: 10000,
          timeWindow: 30,
          zScoreThreshold: 2.5,
          newMerchantThreshold: 100,
          geographicThreshold: 50,
          hoursWindow: 24,
          enabled: true,
          emailNotifications: true,
          emailFrequency: "daily",
        },
      });
    }

    // Allow overriding settings via query params
    const minAmount = parseFloat(searchParams.get('minAmount') || settings.minAmount.toString());
    const maxAmount = parseFloat(searchParams.get('maxAmount') || settings.maxAmount.toString());
    const timeWindow = parseInt(searchParams.get('timeWindow') || settings.timeWindow.toString());
    const zScoreThreshold = parseFloat(searchParams.get('zScoreThreshold') || settings.zScoreThreshold.toString());
    const newMerchantThreshold = parseFloat(searchParams.get('newMerchantThreshold') || settings.newMerchantThreshold.toString());
    const geographicThreshold = parseFloat(searchParams.get('geographicThreshold') || settings.geographicThreshold.toString());
    const hoursWindow = parseInt(searchParams.get('hoursWindow') || settings.hoursWindow.toString());
    
    // Get transactions from the last N days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeWindow);

    const transactions = await (prisma as any).transaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        amount: {
          gte: -maxAmount,
          lte: maxAmount,
        },
        account: {
          userId: userId,
        },
      },
      include: {
        account: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (!transactions.length) {
      return NextResponse.json({ anomalies: [] });
    }

    // Get user's dismissal rules
    const dismissalRules = await (prisma as any).anomalyDismissalRule.findMany({
      where: { userId },
    });

    // Filter out transactions that match dismissal rules
    const filteredTransactions = transactions.filter((transaction: any) => {
      const transactionText = `${transaction.name} ${transaction.merchantName || ''}`.toLowerCase();
      const amount = Math.abs(transaction.amount);
      const category = transaction.categoryAi || transaction.category || 'Uncategorized';
      
      return !dismissalRules.some((rule: any) => {
        try {
          // Parse the ruleValue JSON to get the pattern data
          const ruleData = JSON.parse(rule.ruleValue);
          const pattern = ruleData.pattern;
          const patternType = ruleData.patternType;
          
          switch (patternType) {
            case 'exact_name':
              return transaction.name.toLowerCase() === pattern.toLowerCase();
            case 'merchant_name':
              return transaction.merchantName && 
                     transaction.merchantName.toLowerCase().includes(pattern.toLowerCase());
            case 'category':
              return category.toLowerCase().includes(pattern.toLowerCase());
            case 'amount_range':
              const [min, max] = pattern.split('-').map(Number);
              return amount >= min && amount <= max;
            default:
              return transactionText.includes(pattern.toLowerCase());
          }
        } catch (error) {
          // If we can't parse the rule, skip it
          console.warn('Failed to parse dismissal rule:', rule.id);
          return false;
        }
      });
    });

    const anomalies: any[] = [];

    // 1. Detect suspicious patterns
    filteredTransactions.forEach((transaction: any) => {
      const transactionText = `${transaction.name} ${transaction.merchantName || ''}`.toLowerCase();
      
      // Skip if this is a legitimate transaction
      if (LEGITIMATE_PATTERNS.some(pattern => pattern.test(transactionText))) {
        return;
      }
      
      SUSPICIOUS_PATTERNS.forEach(({ pattern, reason }) => {
        if (pattern.test(transactionText)) {
          anomalies.push({
            id: transaction.id,
            type: 'suspicious_pattern',
            severity: 'high',
            reason,
            transaction,
            date: transaction.date,
          });
        }
      });
    });

    // 2. Detect duplicate charges
    const potentialDuplicates = findDuplicateCharges(filteredTransactions, hoursWindow);
    anomalies.push(...potentialDuplicates);

    // 3. Detect unusual spending patterns
    const unusualSpending = detectUnusualSpending(filteredTransactions, zScoreThreshold);
    anomalies.push(...unusualSpending);

    // 4. Detect new high-value merchants
    const newHighValueMerchants = detectNewHighValueMerchants(filteredTransactions, newMerchantThreshold);
    anomalies.push(...newHighValueMerchants);

    // 5. Detect geographic anomalies
    const geographicAnomalies = detectGeographicAnomalies(filteredTransactions, geographicThreshold, hoursWindow);
    anomalies.push(...geographicAnomalies);

    // Store anomalies in database
    const anomalyResults = [];
    for (const anomaly of anomalies) {
      // Defensive: Only store if transactionId and settingsId are present
      if (!anomaly.transaction?.id || !settings?.id) continue;

      // Defensive: Check that the transaction actually exists in the DB
      const txExists = await (prisma as any).transaction.findUnique({
        where: { id: anomaly.transaction.id }
      });
      if (!txExists) {
        console.warn('Skipping anomaly for missing transaction:', anomaly.transaction.id);
        continue;
      }

      try {
        // Avoid duplicate anomaly results for the same transaction/type
        const existing = await (prisma as any).anomalyDetectionResult.findFirst({
          where: {
            settingsId: settings.id,
            transactionId: anomaly.transaction.id,
            type: anomaly.type,
          },
        });
        if (!existing) {
          const result = await (prisma as any).anomalyDetectionResult.create({
            data: {
              settingsId: settings.id,
              transactionId: anomaly.transaction.id,
              type: anomaly.type,
              severity: anomaly.severity,
              reason: anomaly.reason,
              metadata: {
                zScore: anomaly.zScore,
                duplicateCount: anomaly.duplicateCount,
                merchantTotal: anomaly.merchantTotal,
                previousLocation: anomaly.previousLocation,
                currentLocation: anomaly.currentLocation,
                timeDiff: anomaly.timeDiff,
                // Add duplicate transactions for duplicate_charge type
                ...(anomaly.type === 'duplicate_charge' && {
                  duplicateTransactions: anomaly.duplicateTransactions,
                  timeSpan: anomaly.timeSpan
                }),
              },
            },
          });
          anomalyResults.push(result);
        }
      } catch (err) {
        const errorMessage = err ? (err instanceof Error ? err.message : String(err)) : 'Unknown error';
        console.log('Error creating anomaly result:', {
          message: errorMessage,
          errorType: err ? typeof err : 'null/undefined'
        });
      }
    }

    // Get all anomaly results from database (including hidden ones for the UI)
    const showHidden = searchParams.get('showHidden') === 'true';
    const dbAnomalies = await (prisma as any).anomalyDetectionResult.findMany({
      where: {
        settingsId: settings.id,
        ...(showHidden ? {} : { isHidden: false }),
      },
      include: {
        transaction: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Apply dismissal rules to existing anomalies in the database
    console.log(`Found ${dbAnomalies.length} anomalies in database`);
    console.log(`Found ${dismissalRules.length} dismissal rules`);
    
    const filteredDbAnomalies = dbAnomalies.filter((dbAnomaly: any) => {
      const transaction = dbAnomaly.transaction;
      const transactionText = `${transaction.name} ${transaction.merchantName || ''}`.toLowerCase();
      const amount = Math.abs(transaction.amount);
      const category = transaction.categoryAi || transaction.category || 'Uncategorized';
      
      const shouldFilter = dismissalRules.some((rule: any) => {
        try {
          // Parse the ruleValue JSON to get the pattern data
          const ruleData = JSON.parse(rule.ruleValue);
          const pattern = ruleData.pattern;
          const patternType = ruleData.patternType;
          
          let matches = false;
          switch (patternType) {
            case 'exact_name':
              matches = transaction.name.toLowerCase() === pattern.toLowerCase();
              break;
            case 'merchant_name':
              matches = transaction.merchantName && 
                     transaction.merchantName.toLowerCase().includes(pattern.toLowerCase());
              break;
            case 'category':
              matches = category.toLowerCase().includes(pattern.toLowerCase());
              break;
            case 'amount_range':
              const [min, max] = pattern.split('-').map(Number);
              matches = amount >= min && amount <= max;
              break;
            default:
              matches = transactionText.includes(pattern.toLowerCase());
          }
          
          if (matches) {
            console.log(`Anomaly ${dbAnomaly.id} matches dismissal rule: ${patternType}="${pattern}"`);
          }
          
          return matches;
        } catch (error) {
          // If we can't parse the rule, skip it
          console.warn('Failed to parse dismissal rule:', rule.id);
          return false;
        }
      });
      
      if (shouldFilter) {
        console.log(`Filtering out anomaly ${dbAnomaly.id} for transaction: ${transaction.name}`);
      }
      
      return !shouldFilter;
    });
    
    console.log(`After filtering: ${filteredDbAnomalies.length} anomalies remaining`);

    // Map database anomalies to the expected format
    const dbAnomaliesFormatted = filteredDbAnomalies.map((dbAnomaly: any) => ({
      id: dbAnomaly.id,
      type: dbAnomaly.type,
      severity: dbAnomaly.severity,
      reason: dbAnomaly.reason,
      transaction: dbAnomaly.transaction,
      date: dbAnomaly.transaction.date,
      isHidden: dbAnomaly.isHidden,
      isResolved: dbAnomaly.isResolved,
      metadata: dbAnomaly.metadata,
    }));

    // Sort by severity and date
    dbAnomaliesFormatted.sort((a: any, b: any) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return NextResponse.json({ 
      anomalies: dbAnomaliesFormatted,
      settings: {
        minAmount,
        maxAmount,
        timeWindow,
        zScoreThreshold,
        newMerchantThreshold,
        geographicThreshold,
        hoursWindow,
      }
    });
  } catch (error) {
    const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
    console.log('Error detecting anomalies:', {
      message: errorMessage,
      errorType: error ? typeof error : 'null/undefined'
    });
    return NextResponse.json({ error: 'Failed to detect anomalies' }, { status: 500 });
  }
}

function findDuplicateCharges(transactions: any[], hoursWindow: number): any[] {
  const anomalies: any[] = [];
  const seenCharges = new Map<string, any[]>();

  transactions.forEach(transaction => {
    const transactionText = `${transaction.name} ${transaction.merchantName || ''}`.toLowerCase();
    
    // Skip legitimate transactions that might appear as duplicates
    if (LEGITIMATE_PATTERNS.some(pattern => pattern.test(transactionText))) {
      return;
    }
    
    // Create a key based on merchant and exact amount (to the cent)
    const amount = Math.abs(transaction.amount);
    const merchantKey = transaction.merchantEntityId || transaction.merchantName || transaction.name;
    const chargeKey = `${merchantKey}_${amount.toFixed(2)}`;
    
    if (!seenCharges.has(chargeKey)) {
      seenCharges.set(chargeKey, []);
    }
    
    const existingCharges = seenCharges.get(chargeKey)!;
    existingCharges.push(transaction);
    
    // Check for duplicates within a 24-hour window
    if (existingCharges.length > 1) {
      const recentCharges = existingCharges.filter(charge => {
        const timeDiff = Math.abs(new Date(charge.date).getTime() - new Date(transaction.date).getTime());
        return timeDiff <= hoursWindow * 60 * 60 * 1000; // hours
      });
      
      if (recentCharges.length > 1) {
        // Check if these are legitimate recurring charges (same day of month, different months)
        const isLegitimateRecurring = recentCharges.length === 2 && 
          recentCharges.every(charge => {
            const date = new Date(charge.date);
            return date.getDate() >= 1 && date.getDate() <= 5; // Common billing cycle days
          });
        
        if (!isLegitimateRecurring) {
          // Create an anomaly for each duplicate transaction, but include all duplicates in metadata
          recentCharges.forEach(duplicateTransaction => {
            // Sort duplicates by date for consistent ordering
            const sortedDuplicates = recentCharges.sort((a, b) => 
              new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            
            anomalies.push({
              id: duplicateTransaction.id,
              type: 'duplicate_charge',
              severity: 'high',
              reason: `Duplicate charge detected: $${amount.toFixed(2)} at ${merchantKey}`,
              transaction: duplicateTransaction,
              date: duplicateTransaction.date,
              duplicateCount: recentCharges.length,
              // Store all duplicate transactions in metadata
              duplicateTransactions: sortedDuplicates.map(t => ({
                id: t.id,
                name: t.name,
                amount: t.amount,
                date: t.date,
                merchantName: t.merchantName,
                accountId: t.accountId
              })),
              // Store the time difference between first and last duplicate
              timeSpan: {
                first: sortedDuplicates[0].date,
                last: sortedDuplicates[sortedDuplicates.length - 1].date,
                hoursDiff: (new Date(sortedDuplicates[sortedDuplicates.length - 1].date).getTime() - 
                           new Date(sortedDuplicates[0].date).getTime()) / (1000 * 60 * 60)
              }
            });
          });
        }
      }
    }
  });

  return anomalies;
}

function detectUnusualSpending(transactions: any[], zScoreThreshold: number): any[] {
  const anomalies: any[] = [];
  
  // Group by category
  const byCategory = new Map<string, any[]>();
  transactions.forEach(transaction => {
    const transactionText = `${transaction.name} ${transaction.merchantName || ''}`.toLowerCase();
    
    // Skip legitimate transactions
    if (LEGITIMATE_PATTERNS.some(pattern => pattern.test(transactionText))) {
      return;
    }
    
    const category = transaction.categoryAi || transaction.category || 'Uncategorized';
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(transaction);
  });

  byCategory.forEach((categoryTransactions, category) => {
    // Only analyze categories with enough transactions
    if (categoryTransactions.length < 3) return;
    
    const amounts = categoryTransactions.map(t => Math.abs(t.amount));
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    categoryTransactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      const zScore = (amount - mean) / stdDev;

      if (zScore > zScoreThreshold) {
        anomalies.push({
          id: transaction.id,
          type: 'unusual_amount',
          severity: zScore > 3.5 ? 'high' : 'medium',
          reason: `Unusually high ${category} transaction (${zScore.toFixed(1)}x average)`,
          transaction,
          date: transaction.date,
          zScore: zScore.toFixed(1),
        });
      }
    });
  });

  return anomalies;
}

function detectNewHighValueMerchants(transactions: any[], newMerchantThreshold: number): any[] {
  const anomalies: any[] = [];
  const merchantHistory = new Map<string, { firstSeen: Date; totalSpent: number; transactionCount: number }>();

  // Sort by date to process chronologically
  const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedTransactions.forEach(transaction => {
    const merchantKey = transaction.merchantEntityId || transaction.merchantName || transaction.name;
    const transactionText = `${transaction.name} ${transaction.merchantName || ''}`.toLowerCase();
    
    // Skip legitimate transactions
    if (LEGITIMATE_PATTERNS.some(pattern => pattern.test(transactionText))) {
      return;
    }
    
    if (!merchantHistory.has(merchantKey)) {
      merchantHistory.set(merchantKey, {
        firstSeen: new Date(transaction.date),
        totalSpent: 0,
        transactionCount: 0,
      });
    }

    const history = merchantHistory.get(merchantKey)!;
    history.totalSpent += Math.abs(transaction.amount);
    history.transactionCount++;

    // Check if this is a new merchant with high value
    const daysSinceFirstSeen = (new Date(transaction.date).getTime() - history.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceFirstSeen <= 7 && history.totalSpent > newMerchantThreshold && history.transactionCount === 1) {
      anomalies.push({
        id: transaction.id,
        type: 'new_high_value_merchant',
        severity: history.totalSpent > 500 ? 'high' : 'medium',
        reason: `New merchant with high-value transaction: $${history.totalSpent.toFixed(2)}`,
        transaction,
        date: transaction.date,
        merchantTotal: history.totalSpent,
      });
    }
  });

  return anomalies;
}

function detectGeographicAnomalies(transactions: any[], geographicThreshold: number, hoursWindow: number): any[] {
  const anomalies: any[] = [];
  const locationHistory = new Map<string, { locations: Set<string>; lastLocation: string; lastDate: Date }>();

  // Sort by date
  const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedTransactions.forEach(transaction => {
    const transactionText = `${transaction.name} ${transaction.merchantName || ''}`.toLowerCase();
    
    // Skip legitimate transactions
    if (LEGITIMATE_PATTERNS.some(pattern => pattern.test(transactionText))) {
      return;
    }
    
    const location = transaction.location || 'Unknown';
    const merchantKey = transaction.merchantEntityId || transaction.merchantName || transaction.name;
    
    if (!locationHistory.has(merchantKey)) {
      locationHistory.set(merchantKey, {
        locations: new Set([location]),
        lastLocation: location,
        lastDate: new Date(transaction.date),
      });
    } else {
      const history = locationHistory.get(merchantKey)!;
      const timeDiff = new Date(transaction.date).getTime() - history.lastDate.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Only flag if:
      // 1. Location changed
      // 2. Within 24 hours of last transaction
      // 3. Not a known chain store (like Starbucks, McDonald's, etc.)
      // 4. Amount is significant (>$50)
      const isSignificantAmount = Math.abs(transaction.amount) > 50;
      const isRecentChange = hoursDiff <= hoursWindow;
      const isLocationChange = location !== history.lastLocation && location !== 'Unknown';
      const isNotChainStore = !isKnownChainStore(merchantKey);
      
      if (isLocationChange && isRecentChange && isSignificantAmount && isNotChainStore) {
        anomalies.push({
          id: transaction.id,
          type: 'geographic_anomaly',
          severity: 'medium',
          reason: `Unusual location change: ${history.lastLocation} → ${location} within ${Math.round(hoursDiff)} hours`,
          transaction,
          date: transaction.date,
          previousLocation: history.lastLocation,
          currentLocation: location,
          timeDiff: Math.round(hoursDiff),
        });
      }
      
      history.locations.add(location);
      history.lastLocation = location;
      history.lastDate = new Date(transaction.date);
    }
  });

  return anomalies;
}

function isKnownChainStore(merchantName: string): boolean {
  const chainStores = [
    'starbucks', 'mcdonalds', 'subway', 'burger king', 'wendys', 'taco bell',
    'dunkin', 'dominos', 'pizza hut', 'kfc', 'chipotle', 'panera',
    'walmart', 'target', 'costco', 'sams club', 'home depot', 'lowes',
    'amazon', 'uber', 'lyft', 'doordash', 'grubhub', 'uber eats',
    'shell', 'exxon', 'chevron', 'bp', 'mobil', 'sunoco',
    'cvs', 'walgreens', 'rite aid', 'dollar general', 'dollar tree',
    '7-eleven', 'circle k', 'speedway', 'quik trip',
  ];
  
  const merchantLower = merchantName.toLowerCase();
  return chainStores.some(chain => merchantLower.includes(chain));
}