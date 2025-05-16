# System Patterns

## Architecture Overview
The Personal Finance Dashboard follows a modern full-stack architecture with Next.js at its core:

```
Client Browser <--> Next.js Server <--> External APIs (Plaid, Coinbase)
                     |
                     v
                   Prisma ORM <--> SQLite Database
```

## Key Components

### Frontend
- **Next.js App Router**: Page structure and routing using the latest Next.js patterns
- **React Components**: Reusable UI components organized in `/components`
- **shadcn/ui**: UI component system based on Radix UI primitives and TailwindCSS
- **Chart.js with react-chartjs-2**: Data visualization components

### Backend
- **Next.js API Routes**: Serverless functions for API endpoints
- **Prisma ORM**: Database access layer with type-safe queries
- **SQLite Database**: Local data storage for financial information
- **Authentication**: Integrated with external providers (Plaid Link, Coinbase OAuth)

### Data Flow
1. **Account Connection**:
   - User initiates connection through UI
   - Authentication handled by Plaid Link or Coinbase OAuth
   - Access tokens stored securely in database
   - Account metadata retrieved and stored

2. **Balance Updates**:
   - Scheduled script or manual refresh triggers balance check
   - Access tokens used to query external APIs
   - New balance data stored in database with timestamps
   - Historical record maintained for trending

3. **Data Visualization**:
   - Balances retrieved from database
   - Processed and formatted for charting
   - Rendered in UI using Chart.js

## Design Patterns

### Data Models
- **PlaidItem**: Represents a connection to a financial institution
- **Account**: Individual accounts within an institution
- **AccountBalance**: Historical balance records with timestamps
- **Transaction**: Detailed transaction data (when available)
- **TransactionDownloadLog**: Tracking for data sync operations

### API Integration Pattern
For both Plaid and Coinbase, the application follows this pattern:
1. OAuth/authentication flow to obtain access tokens
2. Store tokens securely in database
3. Use tokens to periodically fetch updated data
4. Handle token refresh/expiration as needed
5. Transform and store retrieved data in local database

### Background Processing
- Cron-scheduled script for regular data updates
- Email notifications for significant changes
- Error logging for failed operations

## State Management
- **Server State**: Database as source of truth
- **Client State**: React Query for data fetching and caching
- **UI State**: React state/context for ephemeral UI state

## Scalability Considerations
- SQLite chosen for simplicity in self-hosted environment
- Database schema designed for reasonable performance with thousands of records
- Could be migrated to PostgreSQL or other RDBMS for higher scale needs 