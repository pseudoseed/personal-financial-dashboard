# Active Context

## Current Focus
- **Month-over-Month Chart Dark Mode Fixes**: Addressed dark mode styling issues for chart labels and summary backgrounds
- **Analytics Page Card Styling Standardization**: Updated all Analytics page chart components to use consistent styling with the reusable card system
- **Time Period Filter Removal**: Removed redundant Time Period filter from Transaction Chart Settings
- **Vendor Chart Layout**: Modified vendor chart to vertical orientation and moved to separate row
- **Time Filter Extension**: Extended date range filtering to all charts on the transactions page
- **Vendor Chart Integration**: Updated vendor data query to include date filtering parameters
- **AI Categories Integration**: Updated AI categories query to use settings and support filtering
- **API Enhancement**: Enhanced AI categories API to support comprehensive filtering
- **Time Filter Implementation**: Added comprehensive date range filtering to Transaction Chart Settings
- **Date Utility Functions**: Created date utility functions for common time periods
- **Prebuilt Filters**: Added quick access buttons for common date ranges (This Week, This Month, This Quarter, Last Quarter, Fiscal Year, Year to Date)
- **Custom Date Inputs**: Added manual date range selection with start and end date inputs
- **UI/UX Enhancements**: Improved Transaction Chart Settings with date filtering capabilities
- **Theme/Styling**: Improved the styling of the `MetricCard` header.
- **Responsive Layout**: Improved the responsive grid layout for the dashboard metric cards.
- **Theme/Styling**: Fixed dark mode text color issues in the settings dialog.
- **Client-Side Data Handling**: Fixed a bug in the `SettingsDialog` where it was incorrectly parsing the response from the `/api/accounts` endpoint.
- **API Caching Fix**: Disabled caching on the `/api/accounts` route to prevent stale data in the settings dialog.
- **Settings Dialog Fixes**: Fixed several issues in the settings dialog, including account counts, sync status display, and last sync times table.
- **Settings Dialog Restoration**: Restored the comprehensive old settings dialog with portal rendering
- **Navigation Utility Buttons Fix**: Fixed all utility buttons in the navigation bar to work correctly
- **Portal Implementation**: Added proper portal rendering for full-page dialog display
- **UX Improvements**: Enhanced disconnect confirmation with detailed warning
- **Bug Fixes**: Fixed credit utilization display logic and sensitive data default state
- **Global State Management**: Implemented proper sensitive data context with persistence
- **Code Cleanup**: Removed redundant masking controls and simplified component interfaces
- **Enhanced Account Labeling**: Implemented improvements in the settings dialog
- **Mobile Responsiveness**: Improving mobile responsiveness and device compatibility across all pages

## Recent Changes

### Month-over-Month Chart Dark Mode Fixes (Latest)
- **Chart Label Colors**: Updated chart labels to use a lighter color in dark mode (`#9ca3af`) for better readability
- **Summary Backgrounds**: Corrected the background color for summary metrics and category changes to use the proper dark mode color (`dark:bg-zinc-800`) instead of a bright one

### Analytics Page Card Styling Standardization (Latest)
- **AccountTypeDistribution Component**: Updated to use standardized `.card` class and proper text colors (`text-surface-600 dark:text-gray-200` for headers, `text-surface-600 dark:text-gray-400` for labels, `text-surface-900 dark:text-surface-dark-900` for values)
- **InstitutionBreakdown Component**: Updated to use standardized `.card` class and consistent text color system
- **NetWorthChart Component**: Updated container to use `.card` class with proper header styling and maintained chart functionality
- **MonthOverMonthChart Component**: Updated to use `.card` class for loading, error, and main states with consistent text colors and background styling
- **FinancialGroupChart Component**: Updated to use `.card` class and standardized text colors for labels and progress bars
- **Consistent Design System**: All Analytics page cards now follow the same styling patterns as `MetricCard` and other reusable components
- **Dark Mode Support**: All components now have proper dark mode support with consistent color variables
- **Hover Effects**: All cards now have consistent hover effects and transitions from the `.card` class

### Time Period Filter Removal (Latest)
- **Removed Time Period Dropdown**: Eliminated the redundant Time Period filter (daily/weekly/monthly) from TransactionChartSettings
- **Simplified Settings UI**: Removed the period selection dropdown since comprehensive date range filtering makes it redundant
- **Updated Display Text**: Changed "Transaction Overview" subtitle from period-specific text to generic "Transaction analytics"
- **Maintained API Compatibility**: API still accepts period parameter but defaults to 'monthly' for consistency
- **Enhanced buildApiUrl**: Added fallback to 'monthly' period in case settings don't include period value

### Time Filter Extension to All Charts (Latest)
- **Vendor Chart Integration**: Updated vendor data query in `TransactionChart.tsx` to include `startDate` and `endDate` parameters
- **AI Categories Integration**: Updated AI categories query to use settings and include all filtering parameters
- **Query Key Updates**: Updated query keys to include settings so all charts refresh when date filters change
- **AI Categories API Enhancement**: Enhanced `/api/transactions/for-ai` endpoint to support:
  - Date range filtering (`startDate`, `endDate`)
  - Account filtering (`accountIds`)
  - Category filtering (`categories`)
  - Amount range filtering (`minAmount`, `maxAmount`)
- **Vendor API Fix**: Fixed vendor API to properly handle explicit date parameters from frontend
- **Consistent Filtering**: All three charts now respond to the same date range settings
- **Performance Optimization**: Proper query key dependencies ensure efficient cache invalidation

### Time Filter Implementation (Previous)
- **Date Utility Functions**: Created `src/lib/dateUtils.ts` with comprehensive date range calculation functions
- **Prebuilt Filters**: Added quick access buttons for common time periods:
  - This Week (Sunday to Saturday)
  - This Month (1st to last day of current month)
  - This Quarter (current quarter start to end)
  - Last Quarter (previous quarter)
  - Fiscal Year (July 1 to June 30)
  - Year to Date (January 1 to current date)
- **Custom Date Inputs**: Added manual date range selection with HTML5 date inputs
- **Date Range Display**: Shows current selected date range in a formatted display
- **Clear Functionality**: Added "Clear" button to reset date filters
- **Validation**: Implemented date range validation to ensure start date <= end date
- **Integration**: Seamlessly integrated with existing Transaction Chart Settings
- **Persistence**: Date filters persist in localStorage with existing settings
- **API Integration**: Existing API already supports date parameters via `buildApiUrl` function

### UI Consistency
- **Grouped Stat Cards**: Created a `ListStatCard` component to restore the grouped list format for the "Account Status" section, ensuring a consistent design while improving code reusability.
- **Dashboard Stats**: Refactored the "Account Status" and "Quick Stats" sections to use the `MetricCard` component, ensuring a consistent design with the main dashboard metrics.

### Theme/Styling
- **Consistent Headers**: Applied the same header style to both `MetricCard` and `AccountCard` for a consistent look.
- **Metric Card Header**: Increased the font size and weight, and lightened the text color in dark mode for the `MetricCard` headers to match the requested style.
- **Dark Mode Text Color**: Corrected the text color in the "Last Sync Times" table within the `SettingsDialog` to be light in dark mode, improving readability.

### Responsive Layout
- **Dashboard Metric Cards**: Updated the grid layout to be more responsive. The cards now stack in 3x3, 2x2, and 1x1 configurations on smaller screens to prevent text from wrapping.

### Client-Side Data Handling
- **Fixed Response Parsing**: Corrected the `fetchAccounts` function in `SettingsDialog.tsx` to properly handle the array of accounts returned by the API, resolving the issue where no accounts were displayed.

### API Caching
- **Disabled Caching**: Added `export const dynamic = "force-dynamic";` to the `/api/accounts` route handler to ensure fresh data is always fetched. This resolves the issue of stale data appearing in the settings dialog after a sync.

### Settings Dialog Fixes
- **Account Counts**: Correctly fetching and displaying the counts for "new" and "all" accounts to be synced.
- **Sync Status Display**: Updated to only show errors, not individual success messages, while keeping the "Batch sync complete" notice.
- **Last Sync Times Table**: Fixed the table to populate correctly with "Account" and "Last Sync" time, and removed the "Last 4" column.
- **Account Name Formatting**: Implemented the requested format: `[Institution] - [Account Type] ([Last 4])`.

### Settings Dialog Restoration
- **Restored Old Dialog**: Replaced the new basic settings dialog with the old comprehensive version.
- **Portal Rendering**: Added `ReactDOM.createPortal` to render the dialog in a portal for proper full-page display.

### Navigation Utility Buttons
- **Refresh Data Button**: Fixed to call `/api/accounts/refresh`
- **View Analytics Button**: Fixed to call `/api/plaid/refresh-institutions`
- **Hide Sensitive Data Icon**: Corrected the icon logic
- **Settings Button**: Opens the restored settings dialog

### Utility Buttons Reorganization (Previous)
- **Moved Utility Buttons**: Consolidated all utility buttons (refresh, globe, file, dark mode, sensitive data, settings) into the header
- **Mobile Dropdown**: Added mobile-friendly dropdown with toolbox icon for utility buttons
- **Improved Organization**: 
  - Desktop: All buttons visible in the header
  - Mobile: Buttons collapse into a toolbox dropdown menu
- **Consistent Styling**: Applied consistent styling and hover states
- **Better Accessibility**: Added proper aria labels and touch targets

### Dark Mode Black Background Fix (Previous)
- **Changed dark mode background**: From gray-900 to black for proper black background
- **Updated layout and DashboardMetrics components**: To use consistent black background
- **Eliminated dark blue appearance**: In dark mode
- **Matched CSS variables**: Defined in globals.css

### Dark Mode Background Fix (Previous)
- **Added proper dark mode classes**: To body element
- **Ensured dark background colors**: Are applied correctly
- **Fixed text color contrast**: For dark mode
- **Maintained JavaScript control**: Of dark mode class on html element

### Dark Mode Persistence Fix (Previous)
- **Fixed dark mode persistence**: By applying CSS class immediately when loading from localStorage
- **Ensured dark mode setting**: Is properly applied on page refresh
- **Maintained visual consistency**: Between page loads

### Sensitive Data Default State Fix (Previous)
- **Changed default state**: To show sensitive data (showSensitiveData: true)
- **Added localStorage persistence**: For sensitive data setting
- **Ensured setting persists**: Between page refreshes
- **Applied globally**: Across all components

### Disconnect Confirmation Enhancement (Previous)
- **Added detailed confirmation dialog**: For institution disconnection
- **Clear warning about data loss**: And irreversible action
- **Lists specific consequences**: Account removal, transaction history deletion, balance history deletion
- **Emphasizes that action cannot be undone**

### Credit Utilization Display Fix (Previous)
- **Fixed `formatBalance` function logic**: That was backwards
- **Credit utilization bars now show**: When sensitive data is visible
- **Credit utilization bars hide**: When sensitive data is hidden
- **Consistent behavior**: With other sensitive data display

### Sensitive Data Toggle (Previous)
- **Connected sensitive data context**: To all components that display financial data
- **Updated `DashboardMetrics`, `AccountCard`, and other components**: To use global state
- **Fixed the eye icon toggle**: To properly show/hide sensitive information
- **Added persistence**: So setting survives page refreshes

### Component Updates (Previous)
- **Updated `DashboardMetrics`**: To use sensitive data context
- **Updated `AccountCard`**: To use sensitive data context
- **Fixed credit utilization display logic**
- **Added proper dark mode styling**: To all components

### Mobile Responsiveness Improvements (Previous)
- **Navigation Bar**: Enhanced mobile layout with proper spacing and touch targets
- **Responsive Menus**: Added mobile-friendly dropdown menus for actions
- **Button Organization**: 
  - Primary actions (Financial Dashboard, Connect Bank) always visible
  - Secondary actions moved to mobile menu on small screens
- **Layout Adjustments**:
  - Added proper padding and margins for mobile
  - Fixed navigation bar width issues
  - Added sticky header for better mobile UX
  - Improved touch targets (minimum 44px)
- **Custom Breakpoint**: Added 'xs' (480px) breakpoint for finer control
- **Dark Mode**: Improved dark mode consistency on mobile

### Enhanced Account Labeling (Previous)
- **Settings Dialog Improvements**: Enhanced the settings dialog to show accounts with institution names and improved formatting
- **Account Display Format**: Changed from simple "Account Name (Last 4)" to "Institution - Account Name (Last 4)"
- **Credit Card Detection**: Added logic to detect and format credit card names (Freedom, Sapphire, etc.) from account names
- **Simplified Table Design**: Removed institution headers and "Last 4" column to minimize data display
- **Improved Card Detection**: Removed generic color terms (red, blue, etc.) and added more meaningful card types
- **Consistent Formatting**: Applied the same improved formatting to TransactionChartSettings component
- **Error List Enhancement**: Updated error messages in sync status to use the new account display format

### AI Transaction Categorization Persistence (Previous)
- **Database Storage**: Updated AI categorization API to store results in the `categoryAi` field
- **Caching Logic**: Added logic to check for existing categories before calling OpenAI API
- **Cost Reduction**: Dramatically reduced API usage by only categorizing new transactions
- **Performance**: Faster response times for previously categorized transactions
- **Enhanced Logging**: Added detailed logging to track caching benefits and cost savings
- **API Response**: Enhanced response format to include caching statistics
- **Database Schema**: Fixed `categoryAi` field in Prisma schema (removed unsupported `@db.String` annotation)

### Vendor Chart Layout Changes (Previous)
- **Vertical Orientation**: Changed vendor chart from horizontal to vertical bars for better readability
- **Separate Row Layout**: Moved vendor chart to its own full-width row for better visibility and interaction
- **Improved UX**: Vendor names now display on x-axis and dollar amounts on y-axis for more intuitive viewing

## Current Status
- ✅ Time filter functionality extended to all charts (main transaction chart, vendor chart, AI categories chart)
- ✅ Vendor chart now responds to date range settings
- ✅ AI categories chart now responds to date range settings
- ✅ All charts use consistent filtering parameters
- ✅ Query keys updated to ensure proper cache invalidation
- ✅ AI categories API enhanced with comprehensive filtering support
- ✅ Vendor API fixed to properly handle explicit date parameters
- ✅ Time filter functionality implemented with prebuilt and custom date ranges
- ✅ Date utility functions created for common time period calculations
- ✅ Transaction Chart Settings enhanced with date filtering capabilities
- ✅ Prebuilt filters for This Week, This Month, This Quarter, Last Quarter, Fiscal Year, Year to Date
- ✅ Custom date inputs for manual date range selection
- ✅ Date range validation and display
- ✅ Integration with existing settings persistence
- ✅ Comprehensive settings dialog restored with all original features
- ✅ Portal rendering implemented for proper full-page dialog display
- ✅ Plaid sync functionality working with new and all accounts sync
- ✅ Sync status tracking and progress display
- ✅ Last sync times table showing account sync history
- ✅ Cooldown system preventing rapid sync requests
- ✅ All navigation utility buttons now work correctly
- ✅ Refresh data button calls `/api/accounts/refresh` with proper loading states
- ✅ View analytics button calls `/api/plaid/refresh-institutions` with proper loading states
- ✅ Hide sensitive data icon logic is fixed (crossed out when hidden)
- ✅ Settings button opens comprehensive settings dialog
- ✅ AI transaction categorization now persists in database
- ✅ Dramatically reduced OpenAI API usage through intelligent caching
- ✅ Enhanced logging shows cost savings and caching benefits
- ✅ Database schema properly configured for `categoryAi`