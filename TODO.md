# TODO List

## High Priority

### Security & Privacy
- [x] Add option to mask sensitive balance information in the UI
- [ ] Add ability to delete historical data older than X days/months

### Error Handling
- [ ] Improve error messages for Plaid connection issues
- [ ] Add retry mechanism for failed balance updates
- [ ] Add notifications for connection issues that require re-authentication

### User Experience
- [ ] Add ability to group accounts (e.g., "Joint Accounts", "Business", "Personal")
- [x] Add ability to hide accounts from dashboard
- [ ] Add last refresh timestamp to each account
- [x] Add ability to nickname accounts

## Medium Priority

### Data Analysis
- [ ] Add balance trends analysis
- [ ] Add month-over-month comparison charts
- [ ] Add net worth over time chart
- [ ] Add custom date range selection for charts

### Email Notifications
- [ ] Add email template customization
- [ ] Add option to set notification thresholds (e.g., notify only for changes > $100)
- [ ] Add weekly and monthly summary options
- [ ] Add ability to customize which accounts are included in notifications
- [ ] Add option to disable email notifications for specific accounts

### Configuration
- [ ] Add a configuration UI for email settings
- [ ] Add ability to customize refresh intervals per account
- [ ] Add support for multiple email recipients

## Low Priority

### Nice-to-Have Features
- [x] Add support for manual account addition (for accounts not supported by Plaid)
- [ ] Add budget tracking features
- [ ] Add support for categorizing large balance changes
- [ ] Add support for tagging transactions
- [ ] Add support for custom financial ratios
- [ ] Add printable reports

### Developer Experience
- [ ] Add better documentation for local development setup
- [ ] Add development environment troubleshooting guide

## Future Considerations

### Integration
- [ ] Consider adding support for other financial APIs
- [ ] Consider adding support for cryptocurrency wallets
- [ ] Consider adding support for investment performance tracking
- [ ] Consider adding support for property value tracking (e.g., Zillow API)