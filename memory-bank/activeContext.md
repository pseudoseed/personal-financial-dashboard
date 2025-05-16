# Active Context

## Current Focus
Based on the TODO list, the current focus areas for the project are:

1. **Investment Transaction Display**: Improving the display and handling of investment transactions
2. **Coinbase Transaction Integration**: Implementing functionality to download and display Coinbase transactions
3. **Refresh Script Refactoring**: Aligning the refresh script logic with the dashboard implementation

## Recent Changes
- Added ability to mask sensitive balance information in the UI
- Implemented account hiding functionality
- Added account nickname functionality

## Active Decisions
- Considering SimpleFIN as an alternative to Plaid for bank connections
- Evaluating the best approach for displaying investment transactions
- Determining the optimal strategy for Coinbase transaction retrieval and display

## Next Steps
### Short-term
1. Implement improved investment transaction display
2. Develop Coinbase transaction download functionality
3. Refactor refresh script to match dashboard logic
4. Add better error handling for Plaid connection issues
5. Implement retry mechanism for failed balance updates

### Medium-term
1. Add balance trends analysis and visualization
2. Implement account grouping functionality
3. Add month-over-month comparison charts
4. Develop net worth tracking over time
5. Enhance email notification system

## Current Challenges
1. **API Limitations**: Working within the constraints of Plaid and Coinbase APIs
2. **Data Consistency**: Ensuring consistent data representation across different financial institutions
3. **Error Handling**: Improving resilience when external APIs have issues
4. **User Experience**: Balancing comprehensive information with a clean, intuitive interface

## Technical Decisions
1. **Database Choice**: Continuing with SQLite for simplicity in self-hosted environment
2. **Authentication Approach**: Using provider-specific OAuth flows rather than implementing custom auth
3. **Data Update Strategy**: Cron-based polling rather than webhooks for simplicity
4. **UI Framework**: Continuing with shadcn/ui components based on TailwindCSS

## Current Questions
1. Is SimpleFIN a viable alternative to Plaid for bank connections?
2. What's the best way to handle investment transaction display given their complexity?
3. How to optimize the data refresh mechanism to be both reliable and efficient?
4. What additional security measures should be implemented to protect financial data? 