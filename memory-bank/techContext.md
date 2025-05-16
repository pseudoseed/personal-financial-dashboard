# Technical Context

## Technology Stack

### Frontend
- **Next.js 15.1.x**: React framework with App Router
- **React 19.x**: UI component library
- **TailwindCSS 3.4.x**: Utility-first CSS framework
- **shadcn/ui 0.9.x**: Component library built on Radix UI
- **Chart.js 4.4.x**: JavaScript charting library
- **react-chartjs-2 5.3.x**: React wrapper for Chart.js
- **react-plaid-link 3.6.x**: Plaid Link integration for React

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **Prisma 6.3.x**: Type-safe ORM for database access
- **SQLite**: File-based relational database
- **Nodemailer 6.10.x**: Email sending library
- **Handlebars 4.7.x**: Templating for email content

### External APIs
- **Plaid API**: Financial data aggregation
- **Coinbase API**: Cryptocurrency exchange data
- **Amazon SES (optional)**: Email delivery service

### Development Tools
- **TypeScript 5.x**: Static typing
- **ESLint 9.x**: Linting
- **Turbopack**: Used for dev server

## Development Environment
- **Node.js v18+**: JavaScript runtime
- **npm**: Package manager
- **Prisma CLI**: Database management
- **Prisma Studio**: Database visualization tool

## API Integrations

### Plaid API
- **Environment**: Development, Sandbox, or Production
- **Authentication**: Client ID and Secret
- **Integration Point**: Plaid Link for user authentication
- **Data Accessed**: Account metadata, balances, transactions
- **Refresh Pattern**: Access tokens stored for recurring data fetches

### Coinbase API
- **Authentication**: OAuth 2.0 flow
- **Scopes Required**: wallet:accounts:read
- **Integration Point**: OAuth redirect flow
- **Data Accessed**: Account balances, cryptocurrency holdings
- **Refresh Pattern**: Uses refresh tokens for recurring access

## Database Schema
The database uses a relational model with SQLite as the storage backend:

- **PlaidItem**: Stores institution connections and tokens
- **Account**: Financial accounts linked through Plaid or Coinbase
- **AccountBalance**: Historical balance records
- **Transaction**: Detailed transaction data
- **TransactionDownloadLog**: Tracks transaction sync operations

## Technical Constraints

### Data Storage
- SQLite used for simplicity in self-hosted environment
- Local file-based database requires backup strategy
- Schema optimized for reasonable performance with thousands of records

### Security Considerations
- Environment variables for sensitive credentials
- Tokens stored in database (requires secure hosting)
- No client-side exposure of API credentials

### API Limitations
- **Plaid**:
  - Rate limits vary by plan
  - Development environment has limited institution support
  - Transaction data may have delays or inconsistencies
  
- **Coinbase**:
  - Rate limits apply to API requests
  - OAuth tokens require periodic refresh

### Email Delivery
- Relies on Amazon SES or similar SMTP provider
- Requires verified sender email
- Subject to email delivery rate limits

## Deployment Considerations
- Self-hosted application
- Environment variables for configuration
- Cron job setup for scheduled data refresh
- Database file persistence and backup 