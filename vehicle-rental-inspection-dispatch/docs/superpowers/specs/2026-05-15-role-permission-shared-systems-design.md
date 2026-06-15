# Role Permission And Shared Systems Design

## Goal

Build one shared platform for:

- Used-car rental and inspection
- Ride-hailing dispatch management

The platform has one shared SQLite database, one management entrance, and one user entrance. Both PC and mobile/tablet experiences must be supported. Data should be shared across both business systems while role permissions prevent users from modifying data outside their responsibility.

## Current Context

The current app already has:

- `/admin` management layout with vehicle, inspection, inventory, rental order, dispatch, and data center pages.
- `/user` layout with customer report, rental, order, driver task, and profile pages.
- A shared `fleetRepository` data layer currently backed by localStorage, with a native SQLite client scaffold available.
- Shared vehicle, report, inventory, rental order, driver, and dispatch task data types.

The current role model only distinguishes `admin` and `user`. This design replaces that with a central role-permission model.

## Roles

### Management Roles

`super_admin`

- Owns all management features.
- Can manage inspection, rental, dispatch, vehicles, data center, users, and permissions.
- Can create, edit, delete, and view all data.

`inspection_admin`

- Primary owner of the used-car inspection workflow.
- Can create and edit vehicle inspection records and inspection reports.
- Can trigger inspection-to-inventory linkage after a qualifying report.
- Can view vehicle status, rental orders, dispatch tasks, inventory records, and drivers.
- Cannot modify rental, dispatch, driver, or unrelated inventory data except through the approved inspection auto-stock-in flow.

`rental_admin`

- Primary owner of rental, inventory, ride-hailing dispatch, and driver operations.
- Can manage inventory records, rental orders, dispatch tasks, driver pool, and vehicle operation fields.
- Can view inspection reports and vehicle inspection grades.
- Cannot modify inspection reports or inspection item results.

### User Roles

`customer`

- Enters `/user`.
- Sees customer-facing home, rental vehicles, rental orders, reports, and profile.
- Can create rental orders, view own orders, cancel eligible orders, and request return.
- Can open a temporary vehicle inspection report link from rental vehicle cards.

`driver`

- Enters `/user`.
- Sees driver-facing home, task list, and profile.
- Can view, accept, and complete only their assigned dispatch tasks.
- Does not see rental customer ordering features.

## Entrances And Routing

The platform keeps two top-level entrances:

- `/admin`: management side for `super_admin`, `inspection_admin`, and `rental_admin`.
- `/user`: user side for `customer` and `driver`.

Login remains unified. After successful login:

- Management roles are redirected to `/admin`.
- Customer and driver roles are redirected to `/user`.

Route guards must:

- Reject unauthenticated access.
- Redirect authenticated users away from the wrong entrance.
- Prevent direct route access when the user lacks route permission.
- Fall back to the correct role home page.

## Central Permission Model

Permissions should be centralized in configuration rather than scattered across pages. The permission model controls:

- Visible PC menus.
- Visible mobile bottom navigation entries.
- Route access.
- Button/action availability.
- Repository-level mutation safeguards.

Pages may hide buttons for better UX, but the data layer must still reject unauthorized mutations.

## Management Menus

`super_admin`

- Workbench
- Vehicle center
- Inspection entry
- Inventory/preparation pool
- Rental orders
- Dispatch management
- Data center
- User and permission management
- Profile

`inspection_admin`

- Workbench
- Vehicle center, read-only except inspection-related base fields
- Inspection entry
- Inspection reports
- Data center with read-only cross-system modules
- Profile

`rental_admin`

- Workbench
- Vehicle center, editable for operation fields
- Inventory/preparation pool
- Rental orders
- Dispatch management
- Driver pool
- Data center with read-only inspection report access
- Profile

## User Menus

`customer`

- Home
- Rental vehicles
- Orders
- Reports
- Profile

`driver`

- Home
- Tasks
- Profile

## Data Permissions

Inspection reports:

- `super_admin`: full access.
- `inspection_admin`: create, edit, delete, view.
- `rental_admin`: view only.
- `customer`: view own related reports and temporary rental vehicle reports.
- `driver`: no general access unless needed for an assigned task context.

Vehicles:

- `super_admin`: full access.
- `inspection_admin`: create/update inspection-related base fields and latest inspection linkage.
- `rental_admin`: update warehouse, parking space, rental price, deposit, driver assignment, and operation status.
- `customer`: view rentable vehicle fields and inspection summary.
- `driver`: view assigned task vehicle fields.

Inventory records:

- `super_admin`: full access.
- `rental_admin`: full access.
- `inspection_admin`: can create records only through inspection auto-stock-in; otherwise read-only.
- `customer` and `driver`: no general access.

Rental orders:

- `super_admin` and `rental_admin`: full access.
- `inspection_admin`: read-only.
- `customer`: create/view/cancel/request return for own orders.
- `driver`: no general access.

Dispatch tasks and drivers:

- `super_admin` and `rental_admin`: full access.
- `inspection_admin`: read-only.
- `driver`: view/accept/complete own tasks only.
- `customer`: no access.

Data center:

- Management roles can open it.
- Each module shows or hides create/edit/delete/export actions according to role permissions.
- Cross-system data remains visible where useful, but non-owned data is read-only.

## Shared SQLite Data Model

The shared database should contain:

- `users`: account, password, name, phone, role, status.
- `vehicles`: base vehicle profile, inspection grade, operation status, warehouse, parking space, prices, latest inspection report.
- `inspection_reports`: report header, vehicle link, customer info, inspector info, verdicts, grade, timestamps.
- `inspection_items`: report item rows with category, item name, result, and remark.
- `inventory_records`: stock-in, stock-out, transfer records with generated record number.
- `rental_orders`: rental order lifecycle linked to vehicle and customer.
- `drivers`: driver profile and status, optionally linked to a user account.
- `dispatch_tasks`: route/task lifecycle linked to vehicle and driver.

Temporary report links can start without a new table by using `vehicleId + timestamp` validation. A later hardening pass can add a `report_access_tokens` table if server-side revocation or audit is required.

## Data Integrity Rules

- Username is unique.
- Vehicle plate number and VIN are unique.
- Report number, inventory record number, rental order number, and dispatch task number are unique.
- Driver phone and license number are unique.
- Active warehouse plus parking space cannot be occupied by multiple vehicles.
- Active rental statuses cannot overlap for the same vehicle.
- Active dispatch statuses cannot overlap for the same vehicle or driver.
- A vehicle cannot be rented and dispatched at the same time.
- Inspection report creation updates the vehicle grade and latest inspection ID.
- Qualified inspection auto-stock-in creates an inventory record and makes the vehicle visible in the preparation pool.
- Repository methods own cross-table writes so pages cannot create inconsistent state manually.

## Temporary Vehicle Inspection Report Link

Customer rental cards expose a "view inspection report" action for vehicles that have an inspection report.

Suggested route:

`/user/rentals/:vehicleId/report/:timestamp`

Rules:

- Timestamp is generated at click time.
- The link is valid for 30 minutes.
- The page shows the vehicle's latest inspection report only.
- The page is read-only.
- Expired links show a clear expiration message and guide the user back to rental vehicles.
- Vehicles without reports show a clear no-report message.
- This page is part of the customer rental flow and does not replace management data center previews.

## PC Layout

Management PC:

- Keep the current sidebar plus top account dropdown structure.
- Sidebar menus are generated from role permission config.
- The data center keeps second-level modules for reports, inventory records, rental orders, dispatch tasks, and driver pool.
- Button-level permissions are reflected in table action bars and row actions.

User PC:

- Keep the current sidebar plus top account dropdown structure.
- Customer and driver menus are generated from role permission config.
- Customer rental cards include the temporary report link action.
- Driver pages focus on assigned task workflow.

## Mobile And Tablet Layout

Management mobile:

- Menus are role-aware and field-operation oriented.
- `inspection_admin` emphasizes inspection entry and report preview.
- `rental_admin` emphasizes inventory, orders, dispatch, and driver status.
- `super_admin` emphasizes overview, data center, and profile.
- Avoid dense tables; prefer compact cards and status actions.

User mobile:

- `customer` bottom navigation: home, rental, orders, reports, profile.
- `driver` bottom navigation: home, tasks, profile.
- Temporary report pages use mobile report preview, showing key info, grade, abnormal modules, and compact normal-module summaries.

## Core Business Flows

Inspection-to-inventory:

1. `inspection_admin` enters inspection data.
2. System creates inspection report and report item records.
3. If qualified and auto-stock-in is enabled, the vehicle enters the preparation pool.
4. System creates an inventory record.
5. `rental_admin` can see the vehicle in inventory/preparation views.

Rental:

1. `rental_admin` maintains warehouse, parking space, price, deposit, and rentable status.
2. `customer` sees rentable vehicles.
3. `customer` can open a 30-minute temporary inspection report link.
4. `customer` creates a rental order.
5. `rental_admin` handles order status and vehicle state.

Dispatch:

1. `rental_admin` creates dispatch task from preparation-pool vehicle and available driver.
2. `driver` sees assigned task.
3. `driver` accepts and completes the task.
4. Vehicle and driver statuses are updated consistently.

## Implementation Phases

Phase 1: Role and navigation foundation

- Expand role types.
- Update seed accounts.
- Add central permission config.
- Refactor route guards.
- Generate admin and user PC/mobile menus from permissions.

Phase 2: Data action permissions

- Add role-aware action checks.
- Hide unauthorized buttons.
- Enforce mutation permissions in the repository layer.
- Update data center actions per role.

Phase 3: Temporary customer report link

- Add customer rental-card report action.
- Add timestamp route.
- Validate 30-minute expiry.
- Show latest report read-only.

Phase 4: Mobile role optimization

- Refine role-specific mobile home pages and bottom navigation.
- Convert dense table experiences into compact mobile cards where needed.
- Keep PC data center optimized for management workflows.

## Verification

Build and behavior checks must cover:

- Five role logins redirect correctly.
- PC and mobile menus match each role.
- Unauthorized routes redirect to role home.
- Unauthorized buttons are hidden.
- Repository rejects unauthorized mutations.
- Child admins can view cross-system data but cannot edit non-owned modules.
- Inspection auto-stock-in makes vehicles visible to rental/dispatch admins.
- Customer temporary report link works within 30 minutes and expires afterward.
- Driver can only process assigned tasks.
- `npm run build` passes.

## Out Of Scope For This Iteration

- Remote server authentication.
- Cloud sync.
- Multi-tenant company separation.
- Payment processing.
- Real-time dispatch map.
- Server-side report access token revocation.

