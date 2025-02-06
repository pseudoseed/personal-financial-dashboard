# Personal Finance Dashboard

A dashboard to track all your financial accounts in one place using Plaid API. Features include account balance tracking, daily updates, and email notifications.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Plaid account (Development or Production)
- (Optional) Amazon SES account for email notifications

## Setup Instructions

### 1. Plaid Setup

1. Create a [Plaid account](https://dashboard.plaid.com/signup)
2. Once logged in, go to the [Keys section](https://dashboard.plaid.com/team/keys)
3. Copy your `client_id` and the appropriate `secret` (sandbox/development/production)
4. Note: For real bank connections, you'll need Development or Production credentials

### 2. Environment Setup

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd personal-finance-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your credentials:
   ```env
   # Plaid API credentials
   PLAID_CLIENT_ID="your_client_id"
   PLAID_SECRET="your_secret"
   PLAID_ENV="development"  # or "sandbox" or "production"

   # Database
   DATABASE_URL="file:./dev.db"

   # Next Auth (generate a secret with: openssl rand -base64 32)
   NEXTAUTH_SECRET="your_generated_secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

### 3. Database Setup

1. Initialize the database:
   ```bash
   npx prisma db push
   ```

### 4. Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

### 5. Connecting Bank Accounts

1. Click the "Connect Account" button in the dashboard
2. Follow the Plaid Link flow to connect your bank accounts
3. Your accounts should appear in the dashboard immediately
4. Refresh the page to see updated balances

## Daily Balance Updates (Optional)

If you want to receive daily balance updates via email, follow these additional steps:

### 1. Email Setup (Amazon SES)

Add the following to your `.env` file to enable email notifications:
   ```env
   EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
   EMAIL_PORT=587
   EMAIL_USER=your_ses_smtp_username
   EMAIL_PASSWORD=your_ses_smtp_password
   EMAIL_FROM=your_verified_email@domain.com
   ```

### 2. Setting Up the Daily Update Script

1. Make the refresh script executable:
   ```bash
   chmod +x scripts/refresh-data.sh
   ```

2. Create a logs directory:
   ```bash
   mkdir logs
   ```

3. Test the script:
   ```bash
   ./scripts/refresh-data.sh
   ```

### 3. Setting Up the Cron Job

1. Open your crontab:
   ```bash
   crontab -e
   ```

2. Add the following line to run the script daily at 6 AM:
   ```bash
   0 6 * * * /full/path/to/scripts/refresh-data.sh >> /full/path/to/logs/refresh.log 2>&1
   ```
   Replace `/full/path/to` with your actual project path.

3. Save and exit the editor

4. Verify your cron job:
   ```bash
   crontab -l
   ```

### Troubleshooting

1. Check the logs for any errors:
   ```bash
   tail -f logs/refresh.log
   ```

2. Common issues:
   - `ITEM_LOGIN_REQUIRED`: You need to re-authenticate with your bank
   - `INVALID_CREDENTIALS`: Your bank credentials need updating
   - `INSTITUTION_DOWN`: The bank's systems are temporarily unavailable

## Development

### Project Structure

- `/src` - Application source code
  - `/app` - Next.js app router components
  - `/components` - Reusable React components
  - `/lib` - Utility functions and configurations
- `/scripts` - Automation scripts
- `/prisma` - Database schema and migrations

### Database Management with Prisma Studio

Prisma Studio provides a modern interface to view and edit your database data:

1. Start Prisma Studio:
   ```bash
   npx prisma studio
   ```

2. Open [http://localhost:5555](http://localhost:5555) in your browser

3. You can:
   - View all your connected bank accounts
   - See historical balance records
   - Manage Plaid connections
   - Export data as CSV
   - Filter and sort records

Note: Be cautious when manually editing data as it might affect the application's functionality.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `./scripts/refresh-data.sh` - Manually run balance update

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
