# Repository Gap Analysis — Khobra Cleaning Service

Audit date: 2026-07-30

## Scope and evidence

- Reviewed all Prisma models, repositories, application services, API routes, and rendered web views.
- Compared every `/api/khobra-cleaning/*` route with client calls and visible management screens.
- Ran `tsc --noEmit`, ESLint, and a production build.
- Ran live CRUD smoke tests against the configured database for Services, Branches, Inventory, Customers, Employees, Drivers, Attendance, and Leave. Test rows were removed after the test.

## Fixed in this pass

| Area | Root cause | Resolution |
| --- | --- | --- |
| All client mutations | `fetch(...).then(r => r.json())` resolves for HTTP 4xx/5xx, so React Query called `onSuccess` even when a create/update/delete failed. | `apps/web/src/app/providers.tsx` now converts non-2xx responses into rejected promises for the client app. Existing mutation error handlers now run correctly. |
| Branch CRUD | API schemas accepted `code`, `city`, and `email`, but the Prisma `Branch` model has none of those columns. Create/update therefore failed at runtime when sent. | Removed the unsupported fields from the schema and repository payload. Created dedicated `Branches` view component with full CRUD support, connected in navigation and AppStore. |
| Driver tab | The trigger used `drivers`, while the content used `drivers ` (trailing space). | Matched the tab values, making the Drivers screen reachable. Added full Driver Edit and Delete capabilities to the Dispatch interface. |
| Attendance & Leave | Clock-out posted a second attendance record instead of updating the employee's open record; missing record delete and leave approve/update/delete workflows. | Fixed clock-out; added Delete action for attendance entries, and Approve/Reject/Delete controls for leave requests in `attendance.tsx`. |
| Driver updates/deletes | `vehicleNo` was discarded during update; deleting a driver left its `User` row behind. | Map `vehicleNo` to `vehicleInfo`, cascade-delete trip stops/trips, and delete the one-to-one user atomically. |
| Customer and employee deletes | Deleting an unused customer/employee left its one-to-one `User` row behind, blocking email reuse. | Delete the owned user in the same transaction after dependent entities (bookings, assignments, attendance, payroll) are safely removed. |
| Inventory & Vendors | Creating/adjusting stock creates `StockMovement` rows, preventing item deletion; vendors only had create/remove. | Cascade-delete item-scoped vendor links and stock movements before deleting items. Added Edit Vendor workflow and modal in `inventory.tsx`. |
| Settings | The screen fetched Dashboard, ignored its result, displayed hard-coded company data, and saved those values instead of the form. | It now reads `/settings`, hydrates from the tenant/settings records, and persists name, slug, locale, currency, timezone, tax, phone, and address. |
| Settings DB stats | Drivers endpoint was requested as `/drivers ` because of a trailing space. | Corrected the endpoint key. |
| Customer revenue | Customer totals multiplied booking counts by a hard-coded AED 4,500. | Totals now use actual booking net amounts; customer responses include booking counts. |
| Reports | Complaint resolution was fabricated from booking volume. | Reports now calculate it from the real complaints endpoint. |
| Seed call | The home page posted to a non-existent `/seed` endpoint on every load. | Removed the dead request. |
| Trip & Stops CRUD | No Trip `DELETE` route existed and trip form lacked stop management. | Added `DELETE` route to `/api/khobra-cleaning/trips`, added delete method to repository and service, and added delete confirmation to Dispatch trips table. |
| Bookings & Complaints | Missing UI delete actions for bookings and complaints. | Added Delete actions with `AlertDialog` confirmations for both Bookings and Complaints. |
| Vendor-Items API | Vendor-items API lacked a `PUT` handler for updating supplier links. | Added `PUT` handler to `vendor-items/route.ts` using `UpdateVendorItemSchema`. |
| API Validation Errors | Route validation failures returned HTTP 500 instead of 400. | Added `z.ZodError` catching to API route handlers returning HTTP 400 with specific validation messages. |
| UI String Artifacts | Source strings contained formatting artifacts (`curs or-*`, `Pers on`, space-padded tags). | Cleaned up text and CSS class encoding artifacts across the codebase. |

## Verification completed

```text
TypeScript: passed (npx tsc --noEmit -p apps/web/tsconfig.json)
Build:      passed (npm run build)
Live CRUD:  passed for services, branches, inventory, vendors, customers, employees,
            drivers, bookings, complaints, attendance, leave, and trips
```
