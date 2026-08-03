# Routing Plan

## Goal

Give every main dashboard screen its own Next.js URL while keeping the current layout and components.

## Routes

| Current screen | New URL |
| --- | --- |
| Dashboard | `/` |
| Services | `/services` |
| Customers | `/customers` |
| Employees | `/employees` |
| Bookings | `/bookings` |
| Finance | `/finance` |
| Dispatch | `/dispatch` |
| Inventory | `/inventory` |
| Reports | `/reports` |
| Complaints | `/complaints` |
| Attendance | `/attendance` |
| Payroll | `/payroll` |
| Settings | `/settings` |

## Implementation steps

1. Extract the shared sidebar, header, notifications, keyboard shortcuts, and page shell from `apps/web/src/app/page.tsx` into an authenticated-style dashboard layout.

2. Create `apps/web/src/app/(dashboard)/layout.tsx` for that shared shell.

3. Create one small `page.tsx` route for each URL above. Each route renders the existing component (`Services`, `Customers`, and so on); do not duplicate component logic.

4. Replace `ViewRenderer`, `currentView`, and `setView()` navigation with Next.js `Link` and `usePathname()`:

   - Sidebar links use their route URL.
   - Active sidebar item comes from the current pathname.
   - Quick actions and command-palette items navigate with `router.push()`.
   - Keyboard shortcuts navigate with `router.push()`.

5. Keep only shared UI state in Zustand, such as `sidebarOpen` and the temporary role selector. Remove the `ViewId`, `currentView`, and `setView` state after all callers use routes.

6. Preserve the existing API routes under `/api/khobra-cleaning/*`; this routing work changes page URLs only, not API URLs or database code.

## Validation

- Opening `/services` directly shows Services.
- Refreshing `/customers` stays on Customers.
- Browser Back/Forward moves between pages correctly.
- Sidebar, quick actions, command palette, and keyboard shortcuts all change the URL.
- Existing CRUD dialogs and API calls continue to work on every page.
- `npm run build` passes.

## Notes

Do this before adding login/role-protected routes. The current role selector is client-only and should not be used as access control.
