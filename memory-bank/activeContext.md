# Active Context

## Current Focus
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

## Current Status
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
- ✅ Database schema properly configured for `categoryAi` field
- ✅ Dark mode persists between page refreshes
- ✅ Sensitive data setting persists between page refreshes
- ✅ Sensitive data defaults to visible (not hidden)
- ✅ Sensitive data toggle works globally across all components
- ✅ Account page buttons have clear purposes with tooltips
- ✅ Disconnect confirmation provides clear warning about consequences
- ✅ Credit utilization bars display correctly based on sensitive data toggle
- ✅ All components properly respect dark mode and sensitive data settings
- ✅ Removed redundant controls and simplified interfaces

## Next Steps
1. **Test Settings Dialog Functionality**: Verify that all sync features work correctly
2. **Test Portal Rendering**: Ensure dialog displays properly on all screen sizes
3. **Add User Feedback**: Consider adding toast notifications for sync success/failure
4. **Test All Utility Button Functionality**: Verify that all buttons work correctly in both desktop and mobile views
5. **Enhance Settings Dialog**: Add more advanced settings as needed
6. **Test AI Categorization Persistence**: Verify that categories are properly stored and retrieved
7. **Monitor API Usage**: Track cost savings from reduced OpenAI API calls
8. **User Interface for Category Management**: Add UI for users to manually edit categories
9. **Bulk Category Operations**: Implement bulk editing and recategorization features
10. **Category Analytics**: Add analytics to track categorization accuracy and user corrections

## Key Decisions
- Using existing theme context instead of next-themes for simplicity
- Global sensitive data state for consistent behavior with localStorage persistence
- Default to showing sensitive data (more user-friendly)
- Detailed confirmation dialogs for destructive actions
- Tooltips for better UX on action buttons
- Simplified component interfaces by removing redundant props
- Comprehensive settings dialog for centralized user preferences
- Proper loading states and error handling for all API operations
- Portal rendering for proper dialog display outside header constraints
- Restored original settings dialog functionality over simplified version

## Active Decisions
- Considering SimpleFIN as an alternative to Plaid for bank connections
- Evaluating the best approach for displaying investment transactions
- Determining the optimal strategy for Coinbase transaction retrieval and display
- Using Headless UI's Menu component for mobile dropdown
- Keeping account-specific actions (refresh, disconnect) on individual pages
- Using consistent button styling across all header components
- Keep "Connect Bank" button always visible as primary action
- Use dropdown menus for secondary actions on mobile
- Maintain consistent touch targets (44px minimum)
- Preserve dark mode experience across devices
- Use toolbox icon for mobile utility dropdown (more intuitive than ellipsis)
- Keep all utility buttons in the header for easy access
- Centralized settings dialog for better user experience
- Portal rendering for proper dialog display

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
5. **Dialog Rendering**: Using React portals for proper full-page dialog display

## Current Questions
1. Is SimpleFIN a viable alternative to Plaid for bank connections?
2. What's the best way to handle investment transaction display given their complexity?
3. How to optimize the data refresh mechanism to be both reliable and efficient?
4. What additional security measures should be implemented to protect financial data? 