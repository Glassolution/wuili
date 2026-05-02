# Requirements Document

## Introduction

This feature transforms the existing `TransacoesPage` into a full financial control center for the dropshipping dashboard. Instead of deriving split "entrada/saída" rows from orders, the redesigned page treats each **order** as the primary unit of analysis. The page is split into two main areas: a filterable, sortable order list on the left and a detailed order panel on the right that opens when a row is selected. Summary status cards at the top act as quick filters. The goal is to give the user deep visibility into each order's profitability, logistics status, and customer data — enabling fast, informed decisions.

---

## Glossary

- **Order**: A record in the `orders` Supabase table representing a single customer purchase.
- **TransacoesPage**: The React page component being redesigned (`src/pages/dashboard/TransacoesPage.tsx`).
- **Order_List**: The left-side scrollable list of orders with search, filter, and sort controls.
- **Detail_Panel**: The right-side panel that slides in when an order row is selected, showing full order details.
- **Status_Card**: A clickable summary card at the top of the page representing one order status group.
- **Margin_Indicator**: A visual color-coded badge (high / medium / low) derived from the order's profit margin percentage.
- **Financial_Breakdown**: A structured display of revenue, product cost, platform/gateway fees, and net profit for a single order.
- **Profit**: `sale_price - cost_price - fees` for a given order (where `fees` may be derived or stored separately).
- **Margin**: `(profit / sale_price) * 100`, expressed as a percentage.
- **CJ_Status**: The logistics status reported by the CJ Dropshipping supplier (e.g., pending, processing, shipped, delivered).
- **Tracking_Code**: The carrier tracking number associated with a shipped order.
- **staleTime**: The React Query cache duration, set to `5 * 60 * 1000` ms (5 minutes) across all queries on this page.

---

## Requirements

### Requirement 1: Order List as Primary Data Unit

**User Story:** As a dropshipping store owner, I want to see each order as a single row in the transactions list, so that I can quickly scan profitability and status without mentally combining split entrada/saída rows.

#### Acceptance Criteria

1. THE Order_List SHALL display one row per order fetched from the `orders` Supabase table, ordered by `ordered_at` descending by default.
2. WHEN the page loads, THE Order_List SHALL fetch orders using `@tanstack/react-query` with `staleTime: 5 * 60 * 1000`.
3. THE Order_List SHALL display the following fields per row: Order ID (external or internal), product name, order date, sale value, customer name, order status badge, and order profit.
4. WHEN `cost_price` or `profit` is null for an order, THE Order_List SHALL display "—" in the profit column rather than a calculated or zero value.

---

### Requirement 2: Margin Indicator per Row

**User Story:** As a store owner, I want a visual margin indicator on each order row, so that I can instantly identify high-profit and low-profit orders without opening the detail panel.

#### Acceptance Criteria

1. THE Order_List SHALL display a Margin_Indicator badge on each row derived from the order's Margin value.
2. WHEN Margin is greater than or equal to 30%, THE Order_List SHALL render the Margin_Indicator with a green (success) color and the label "Alta".
3. WHEN Margin is between 10% (inclusive) and 30% (exclusive), THE Order_List SHALL render the Margin_Indicator with a yellow (warning) color and the label "Média".
4. WHEN Margin is less than 10% or profit data is unavailable, THE Order_List SHALL render the Margin_Indicator with a red (destructive) color and the label "Baixa".

---

### Requirement 3: Search and Advanced Filters

**User Story:** As a store owner, I want to search and filter orders by multiple criteria, so that I can quickly locate specific orders or analyze a subset of my transactions.

#### Acceptance Criteria

1. THE Order_List SHALL include a search input that filters rows in real time by order ID, product name, or customer name.
2. THE Order_List SHALL include a status filter that restricts visible rows to orders matching a selected status value.
3. THE Order_List SHALL include a date-range filter that restricts visible rows to orders whose `ordered_at` falls within the selected start and end dates.
4. THE Order_List SHALL include a value-range filter that restricts visible rows to orders whose `sale_price` falls within the specified minimum and maximum values.
5. WHEN no filter is active, THE Order_List SHALL display all orders for the authenticated user.
6. WHEN multiple filters are active simultaneously, THE Order_List SHALL apply all filters with AND logic, showing only orders that satisfy every active filter.

---

### Requirement 4: Sorting

**User Story:** As a store owner, I want to sort the order list by date, value, or profit, so that I can prioritize which orders to review first.

#### Acceptance Criteria

1. THE Order_List SHALL support sorting by order date (`ordered_at`), sale value (`sale_price`), and profit.
2. WHEN a sort column header is clicked once, THE Order_List SHALL sort rows in descending order by that column.
3. WHEN the same sort column header is clicked again, THE Order_List SHALL toggle to ascending order.
4. THE Order_List SHALL display a visual indicator (arrow icon) on the active sort column showing the current sort direction.

---

### Requirement 5: Status Summary Cards

**User Story:** As a store owner, I want clickable status cards at the top of the page showing order counts per status, so that I can instantly see my pipeline and jump to a filtered view with one click.

#### Acceptance Criteria

1. THE TransacoesPage SHALL display five Status_Cards at the top: "Aguardando Pagamento", "Em Processamento", "Em Entrega", "Concluídos", and "Cancelados".
2. THE Status_Card SHALL display the count of orders matching its status group, derived from the same query used by the Order_List.
3. WHEN a Status_Card is clicked, THE Order_List SHALL automatically filter to show only orders belonging to that status group.
4. WHEN a Status_Card that is already active is clicked again, THE Order_List SHALL clear the status filter and show all orders.
5. THE Status_Card SHALL render with a highlighted border or background when its filter is currently active.
6. WHEN the order data is loading, THE Status_Card SHALL display a skeleton placeholder instead of a count.

---

### Requirement 6: Order Selection and Detail Panel

**User Story:** As a store owner, I want to click an order row and see a full detail panel slide in from the right, so that I can inspect every aspect of the order without leaving the page.

#### Acceptance Criteria

1. WHEN an order row is clicked, THE Detail_Panel SHALL open and display the full details of the selected order.
2. THE Detail_Panel SHALL visually highlight the selected row in the Order_List with a distinct background color.
3. WHEN the Detail_Panel is open and a different row is clicked, THE Detail_Panel SHALL update to show the newly selected order without closing.
4. WHEN the Detail_Panel close button is activated, THE Detail_Panel SHALL close and the row highlight SHALL be removed.
5. THE Detail_Panel SHALL open with a smooth CSS transition (slide-in from right).
6. WHILE the Detail_Panel is open on a viewport narrower than 1024px, THE TransacoesPage SHALL display the Detail_Panel as a full-width overlay above the Order_List.

---

### Requirement 7: Detail Panel — Order Summary Section

**User Story:** As a store owner, I want the top of the detail panel to show the most critical financial figures at a glance, so that I can assess the order's health immediately.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display an Order Summary section containing: order status (visually highlighted badge), total sale value, real profit (highlighted in success color when positive, destructive color when negative), and margin percentage.
2. WHEN profit is null or cost_price is null, THE Detail_Panel SHALL display "Dados insuficientes" in place of profit and margin values.

---

### Requirement 8: Detail Panel — Product Info Section

**User Story:** As a store owner, I want to see the product details inside the order panel, so that I can identify exactly what was sold and at what cost.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display a Product Info section containing: product name, product image (if available), product variant (if available), product cost (`cost_price`), and sale price (`sale_price`).
2. WHEN a product image URL is unavailable, THE Detail_Panel SHALL display a placeholder image or icon.
3. WHEN a product variant is not present, THE Detail_Panel SHALL omit the variant field rather than displaying an empty or null value.

---

### Requirement 9: Detail Panel — Financial Breakdown Section

**User Story:** As a store owner, I want a clear breakdown of revenue, costs, fees, and net profit for each order, so that I understand exactly where my money goes.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display a Financial_Breakdown section listing: revenue (sale_price), product cost (cost_price), platform/gateway fees, and net profit.
2. THE Financial_Breakdown SHALL present each line item with its label and formatted currency value (BRL).
3. THE Financial_Breakdown SHALL visually distinguish the net profit line (e.g., bold text, colored value) from the other line items.
4. WHEN fees data is unavailable, THE Financial_Breakdown SHALL display "—" for the fees line item.

---

### Requirement 10: Detail Panel — Customer Info Section

**User Story:** As a store owner, I want to see the customer's contact information in the order panel, so that I can reach out if needed.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display a Customer Info section containing: customer name (`buyer_name`), phone number (if available), and email address (if available).
2. WHEN a contact field (phone or email) is unavailable, THE Detail_Panel SHALL omit that field rather than displaying a null or empty value.

---

### Requirement 11: Detail Panel — Delivery Address Section

**User Story:** As a store owner, I want to see the full delivery address in the order panel, so that I can verify shipping details.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display a Delivery Address section containing: street address, city, state, and postal code (when available in the order data).
2. WHEN address data is not present in the order record, THE Detail_Panel SHALL display a "Endereço não disponível" message in the Delivery Address section.

---

### Requirement 12: Detail Panel — Logistics Status Section

**User Story:** As a store owner, I want to see the logistics status and tracking code in the order panel, so that I can monitor delivery progress without switching tools.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display a Logistics Status section containing: shipment status (whether shipped), CJ_Status, and Tracking_Code (if available).
2. WHEN a Tracking_Code is available, THE Detail_Panel SHALL display it as copyable text.
3. WHEN a Tracking_Code is unavailable, THE Detail_Panel SHALL display "Sem rastreio" in the tracking field.

---

### Requirement 13: Detail Panel — Actions Section

**User Story:** As a store owner, I want quick action buttons in the order panel, so that I can take common actions without navigating away.

#### Acceptance Criteria

1. THE Detail_Panel SHALL display an Actions section with the following buttons: "Marcar como entregue", "Reenviar para CJ" (visible only when order status indicates an error), and "Abrir WhatsApp".
2. WHEN "Abrir WhatsApp" is activated, THE Detail_Panel SHALL open a new browser tab with a WhatsApp Web URL pre-filled with the customer's phone number and a default message referencing the order ID.
3. WHEN the customer phone number is unavailable, THE Detail_Panel SHALL disable the "Abrir WhatsApp" button and display a tooltip explaining the reason.
4. WHEN "Reenviar para CJ" is activated, THE Detail_Panel SHALL trigger the appropriate re-submission action and display a loading state on the button until the action completes.
5. WHEN "Marcar como entregue" is activated, THE Detail_Panel SHALL update the order status to "delivered" via Supabase and reflect the change in both the Detail_Panel and the Order_List without a full page reload.

---

### Requirement 14: Responsive Layout

**User Story:** As a store owner using a tablet or smaller screen, I want the page to remain usable and uncluttered, so that I can manage orders on any device.

#### Acceptance Criteria

1. WHILE the viewport width is 1024px or wider, THE TransacoesPage SHALL display the Order_List and Detail_Panel side by side.
2. WHILE the viewport width is less than 1024px, THE TransacoesPage SHALL display only the Order_List by default, and the Detail_Panel SHALL appear as a full-screen overlay when an order is selected.
3. THE TransacoesPage SHALL preserve the existing visual identity: `card-wuili` class, Tailwind design tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-success`, `text-destructive`), and dark/light theme support.

---

### Requirement 15: Data Integrity and Caching

**User Story:** As a store owner, I want the page to use real order data with consistent caching, so that I always see accurate information without unnecessary re-fetches.

#### Acceptance Criteria

1. THE TransacoesPage SHALL fetch order data exclusively from the Supabase `orders` table using the authenticated user's ID.
2. THE TransacoesPage SHALL use `staleTime: 5 * 60 * 1000` on all React Query queries to prevent redundant network requests during navigation.
3. THE TransacoesPage SHALL NOT use mocked, hardcoded, or derived data as the primary data source.
4. WHEN a Supabase query returns an error, THE TransacoesPage SHALL display an error message to the user and SHALL NOT render a broken or empty layout silently.
