
# Booking System — Agent Implementation Specifications

## Prompt 01 — Booking Date, Time and Duration

Implement booking date and time handling for an hourly service business.

### Requirements

1. Every booking must have:

   * Booking date
   * From time
   * To time

2. The customer must select both `From` and `To` times.

3. Do not ask the customer to manually enter booking hours.

4. Calculate total booking hours automatically from:

   `Total Hours = To Time - From Time`

5. Support fractional hours where applicable.

Examples:

* 10:00 AM to 12:00 PM = 2 hours
* 10:00 AM to 1:30 PM = 3.5 hours
* 9:15 AM to 11:45 AM = 2.5 hours

6. The `To` time must always be later than the `From` time.

7. Invalid or zero-duration bookings must not be allowed.

8. If the date, From time, or To time changes, automatically recalculate:

   * Total hours
   * Employee availability
   * Booking price

9. Show the calculated duration clearly to the customer before booking confirmation.

10. All time calculations and validations must also be verified by the backend. Do not rely only on frontend calculations.

---

# Prompt 02 — Services, Multiple Services and Hourly Pricing

Implement service selection and hourly booking pricing.

### Requirements

1. A booking must contain at least one service.

2. A customer may select multiple services within the same booking.

3. Each service has its own hourly rate.

4. Pricing is based on:

   `Hourly Rate × Number of Employees × Total Booking Hours`

5. If one service costs AED 8/hour, two employees are assigned, and the booking lasts four hours:

   `8 × 2 × 4 = AED 64`

6. Therefore:

   `Service Labour Total = Service Hourly Rate × Assigned Employee Count × Total Hours`

7. For multiple services, calculate each service independently and add the results.

Example:

Service A:

* AED 8/hour
* 2 employees
* 4 hours

Total:
`8 × 2 × 4 = AED 64`

Service B:

* AED 5/hour
* 2 employees
* 4 hours

Total:
`5 × 2 × 4 = AED 40`

Total labour charge:

`AED 64 + AED 40 = AED 104`

8. The same assigned employee count applies to the selected booking services unless another rule is explicitly introduced later.

9. Whenever any of the following changes, immediately recalculate the price:

   * Services
   * Booking duration
   * Employee count
   * Materials
   * Applicable discounts/taxes, if supported

10. The backend must calculate the authoritative final total independently before confirming the booking.

---

# Prompt 03 — Materials and Booking Total

Implement optional materials within bookings.

### Requirements

1. Customers must be able to add materials required for the booked service.

2. Materials are optional.

3. A booking may contain multiple materials.

4. Each material may have:

   * Quantity
   * Unit price

5. Calculate:

   `Material Total = Quantity × Unit Price`

6. Add all material charges to the labour charges.

7. Booking total must be:

   `Total Labour Charges + Total Material Charges`

8. Where taxes, discounts, additional fees, or adjustments exist, apply them after the labour and material subtotals according to the application's existing pricing rules.

9. Price must update immediately while the customer creates or modifies the booking.

10. Clearly show the customer a price breakdown before confirmation:

* Service charges
* Number of employees
* Total hours
* Materials
* Other applicable charges
* Final total

11. Never trust a total submitted from the frontend. Recalculate the final amount before saving or confirming the booking.

---

# Prompt 04 — Employee Requirement and Multiple Employee Assignment

Implement employee assignment for bookings.

### Requirements

1. Every operational booking must eventually have at least one employee assigned.

2. One booking may have multiple employees.

3. There is no maximum employee limit hardcoded unless an existing business rule already defines one.

4. The number of assigned employees directly affects booking price.

Formula:

`Hourly Rate × Assigned Employee Count × Total Hours`

5. Every time employees are added or removed, recalculate the booking total.

6. Before assigning an employee, verify that the employee is available for the complete requested booking slot.

7. Do not allow the same employee to be assigned to overlapping bookings.

8. Availability validation must apply consistently whether assignment is performed by:

   * Customer preference
   * Admin manual assignment
   * Automatic assignment

9. A booking may temporarily remain without an employee only when it is waiting for Admin assignment.

10. A booking must not be allowed to start until at least one employee has been assigned.

---

# Prompt 05 — Customer Preferred Employee Selection

Implement optional employee selection during customer booking.

### Requirements

1. During booking creation, provide an option such as:

   `Select Preferred Employee`

2. Customer employee selection must be optional.

3. If the customer does not enable preferred employee selection, do not force employee selection.

4. If enabled, show eligible employees to the customer.

5. When the customer selects an employee, check availability using:

   * Selected booking date
   * From time
   * To time

6. The employee must be available for the complete booking duration.

7. Also verify that the employee is:

   * Active
   * Eligible to provide the selected service(s)
   * Working/available during the requested period
   * Not on leave
   * Not otherwise unavailable
   * Not already booked for an overlapping period

8. If the selected employee is available, assign the booking directly to that employee after booking confirmation.

9. Do not send an available customer-selected employee booking back to Admin for normal assignment.

10. Recheck availability immediately before final confirmation to prevent double booking.

---

# Prompt 06 — Preferred Employee Unavailable and Suggestions

Implement alternative employee suggestions when a customer-selected employee is unavailable.

### Requirements

1. If the preferred employee is unavailable for the selected date and time, do not allow conflicting assignment.

2. Inform the customer clearly that the selected employee is unavailable for the requested slot.

3. Suggest alternative employees.

4. Only suggest employees who:

   * Can provide the selected service(s)
   * Are active
   * Are available for the entire requested booking period
   * Are not on leave
   * Have no conflicting booking

5. Rank the available suggestions primarily by employee rating.

6. Use the following recommended ranking order:

   1. Availability for the entire slot
   2. Eligibility for the selected services
   3. Highest average rating
   4. Lower current workload
   5. Higher number of successfully completed bookings

7. Show useful information such as:

   `Ahmed — 4.8 ★`

8. Customer must be able to select one of the suggested employees.

9. Once selected, revalidate availability before booking confirmation.

10. Never display unavailable employees as valid alternatives.

---

# Prompt 07 — Booking Without Customer Employee Selection

Implement the booking flow where the customer does not select a preferred employee.

### Requirements

1. Employee selection during customer booking is optional.

2. When no employee is selected, allow the customer to complete the booking.

3. The booking must then appear in the Admin Dashboard as requiring employee assignment.

4. Clearly identify such bookings as:

   `Pending Assignment`

5. The Admin must be able to:

   * View available employees
   * Manually assign one employee
   * Manually assign multiple employees
   * Use Auto Assign

6. Before manual assignment, check employee availability.

7. Do not allow Admin to assign an employee who has an overlapping booking.

8. After the required employee(s) are assigned, update the booking appropriately and recalculate the total based on assigned employee count.

---

# Prompt 08 — Automatic Employee Assignment

Implement automatic employee assignment for unassigned bookings.

### Requirements

1. Admin must have an `Auto Assign` action.

2. Auto Assign must find employees capable of servicing the booking.

3. Automatically exclude employees who:

   * Are inactive
   * Cannot provide the selected service(s)
   * Are unavailable
   * Are outside their applicable working schedule
   * Are on leave
   * Have another conflicting booking

4. Among eligible employees, prioritize:

   1. Required skill/service compatibility
   2. Complete availability for the booking duration
   3. Lower current workload
   4. Higher employee rating
   5. Higher completed-booking count

5. Assign the required number of available employees.

6. Never create a conflicting assignment simply because Auto Assign was requested.

7. If no suitable employee is available, leave the booking in `Pending Assignment`.

8. Inform Admin that automatic assignment could not be completed.

9. Availability must be revalidated at the actual point of assignment to prevent race conditions.

10. After auto-assignment, automatically recalculate booking price using:

`Hourly Rate × Assigned Employee Count × Total Hours`

---

# Prompt 09 — Employee Availability and Double-Booking Prevention

Implement centralized employee booking availability rules.

### Requirements

An employee is considered unavailable if any booking assigned to that employee overlaps the requested booking period.

Use the logical overlap rule:

`Existing Start < Requested End`

AND

`Existing End > Requested Start`

Examples:

Existing booking:

`10:00 AM – 12:00 PM`

Requested:

`11:00 AM – 1:00 PM`

Result:

`Unavailable`

Existing:

`10:00 AM – 12:00 PM`

Requested:

`12:00 PM – 2:00 PM`

Result:

`Available`

unless an additional service/travel buffer is configured elsewhere.

### Availability must be checked when:

1. Customer selects an employee.
2. Customer changes date.
3. Customer changes From time.
4. Customer changes To time.
5. Customer confirms booking.
6. Admin manually assigns an employee.
7. Admin uses Auto Assign.
8. An existing booking is rescheduled.
9. Employees are added to an existing booking.

Backend must always perform the final availability validation.

Two simultaneous requests must never result in the same employee being double-booked.

---

# Prompt 10 — Booking Types and Recurrence

Implement flexible booking scheduling.

Support the following booking types.

## A. One-Time Booking

A booking occurring once on one selected date.

Example:

`10 August, 10:00 AM – 2:00 PM`

---

## B. Multiple Selected Days — Non-Recurring

Allow the customer to select multiple specific dates.

Example:

* 10 August
* 14 August
* 20 August

These dates do not imply recurrence.

Each scheduled occurrence must be independently manageable.

---

## C. Daily Recurring Booking

Allow bookings such as:

`Every day`

with:

* Start date
* End date
* From time
* To time

Example:

Every day from 1 August to 31 August, 10:00 AM–12:00 PM.

---

## D. Selected Weekdays — Recurring

Allow customer to select one or more weekdays.

Example:

* Monday
* Wednesday
* Friday

and define:

* Start date
* End date
* From time
* To time

Generate the booking occurrences accordingly.

---

## E. Selected Weekdays — One-Time

Allow one or more days to be selected without creating an ongoing recurrence.

Example:

Monday and Thursday of a particular week only.

---

## F. Long-Term Booking

Allow long-term schedules across weeks or months.

Example:

Monday to Friday
9:00 AM–11:00 AM
1 August–31 December

### Recurrence Rules

1. Every occurrence must have its own operational state.

2. Changing or cancelling one occurrence must not automatically affect all others unless the user specifically chooses to modify the whole recurring schedule.

3. Availability must be checked separately for every occurrence.

4. Never assume an employee available for the first booking is automatically available for the complete recurring schedule.

5. Different occurrences may have different assigned employees where necessary.

6. Where an employee cannot be assigned to one occurrence, that occurrence may remain `Pending Assignment` while other occurrences continue normally.

---

# Prompt 11 — Booking Lifecycle and Statuses

Implement a controlled booking lifecycle.

Use the following primary statuses:

`Pending Assignment`

`Assigned`

`Scheduled`

`In Progress`

`Completed`

`Cancelled`

`No Show`

Do not use vague statuses such as `New Booked` or duplicate concepts such as both `Started` and `In Progress`.

### Status Rules

## Pending Assignment

Use when:

* Booking has been created.
* No employee has yet been assigned.

---

## Assigned

Use when:

* At least one employee has been assigned.
* Booking assignment is not yet considered ready/finalized for execution.

---

## Scheduled

Use when:

* Employee assignment is complete.
* Booking is confirmed and ready for execution at its scheduled time.

---

## In Progress

Use when:

* Work on the booking has actually started.

Do not automatically mark a booking `In Progress` only because its scheduled start time has arrived.

Actual service start must trigger this status.

---

## Completed

Use when:

* The service has been completed.

Only completed bookings may receive customer employee ratings.

---

## Cancelled

Use when:

* Booking is cancelled before successful completion.

Maintain cancellation reason and who initiated the cancellation.

---

## No Show

Use when:

* The booking could not proceed because the applicable party failed to attend.

Record the reason.

---

# Prompt 12 — Automatic Booking Status Management

Implement booking status transitions as controlled business logic.

### Expected normal workflow:

`Pending Assignment`

→ employee assigned

`Assigned`

→ assignment/booking confirmed

`Scheduled`

→ actual service started

`In Progress`

→ actual service completed

`Completed`

### Alternative transitions:

`Pending Assignment → Cancelled`

`Assigned → Cancelled`

`Scheduled → Cancelled`

`Scheduled → No Show`

`In Progress → Completed`

Do not allow arbitrary status changes that bypass required operational conditions.

Examples:

* A booking cannot become `Assigned` with zero employees.
* A booking cannot become `In Progress` with zero assigned employees.
* A booking cannot be rated before `Completed`.
* A completed booking should not silently return to `Scheduled`.
* A cancelled booking must not remain on employee availability as an active future booking.

Maintain the complete status change history.

For every change record:

* Previous status
* New status
* Date/time
* User/system responsible
* Reason where relevant

Do not overwrite previous lifecycle history.

---

# Prompt 13 — Employee Ratings

Implement customer ratings for employees after booking completion.

### Requirements

1. Customer can rate employees only after the booking becomes `Completed`.

2. Ratings are out of five stars.

3. Supported ratings:

   * 1.0
   * 1.5
   * 2.0
   * 2.5
   * 3.0
   * 3.5
   * 4.0
   * 4.5
   * 5.0

4. Do not allow arbitrary values such as:

   * 4.2
   * 3.7
   * 5.5

5. Where multiple employees worked on the booking, allow the customer to rate each employee separately.

Example:

Ahmed — 5.0 ★
Ali — 4.5 ★
Usman — 3.5 ★

6. Do not apply one overall rating automatically to every employee.

7. Maintain employee rating history.

8. Maintain and display:

   * Average employee rating
   * Number of ratings

Example:

`4.8 ★ (126 ratings)`

9. Employee ratings must be available to the employee recommendation system.

10. Higher-rated employees should be prioritized when suggesting available employees, subject to availability and service eligibility.

---

# Prompt 14 — Real-Time Pricing Behaviour

Implement live booking price calculation throughout the booking workflow.

Use:

`Labour Total = Sum of Selected Service Hourly Rates × Assigned Employee Count × Total Hours`

Then:

`Booking Total = Labour Total + Materials + Other Applicable Charges - Discounts`

Example:

Selected services:

Service A = AED 8/hour
Service B = AED 5/hour

Employees = 2

Duration = 4 hours

Labour:

`(8 + 5) × 2 × 4`

`13 × 2 × 4`

`AED 104`

Materials:

`AED 30`

Final before taxes/discounts:

`AED 134`

### Recalculate immediately when:

* Service added
* Service removed
* Start time changed
* End time changed
* Date/time configuration changes
* Employee added
* Employee removed
* Material added
* Material removed
* Material quantity changed
* Material price changes where applicable

Always show the updated total before the booking is confirmed.

The backend calculation is authoritative.

---

# Prompt 15 — Booking Editing and Rescheduling

Implement safe booking editing.

### Requirements

If a booking's:

* Date
* From time
* To time
* Services
* Assigned employees
* Recurrence

is changed, rerun all relevant validations.

Changing booking time must trigger:

1. Duration recalculation.
2. Employee availability validation.
3. Price recalculation.

If an existing assigned employee is no longer available after rescheduling:

1. Do not silently create the conflict.
2. Inform the applicable user/Admin.
3. Require reassignment or provide alternative available employees.

Changing services must also revalidate whether the currently assigned employee(s) are eligible to perform the updated services.

Changing employee count must immediately recalculate price.

---

# Prompt 16 — Final Booking Confirmation Validation

Before any booking is finally confirmed, perform a complete final validation.

Verify:

* Customer has selected at least one service.
* Booking date is valid.
* From time is valid.
* To time is valid.
* To time is later than From time.
* Total hours have been calculated correctly.
* Selected services are currently available/bookable.
* Materials and quantities are valid.
* Employee count is correct.
* Any selected employees are eligible.
* Any selected employees are available for the complete booking duration.
* No employee scheduling conflicts exist.
* Recurrence configuration is valid.
* Pricing has been recalculated from current authoritative values.
* Material charges have been recalculated.
* Final total is valid.

Do not allow frontend state to bypass any booking rule.

---

# Prompt 17 — Acceptance Criteria

Treat the booking functionality as complete only when all of the following work correctly:

1. Customer selects From and To times.

2. Duration calculates automatically.

3. Fractional booking hours work.

4. Multiple services work.

5. Multiple employees work.

6. Booking requires at least one employee before execution.

7. Labour pricing uses:

   `Service Hourly Rate × Employee Count × Total Hours`

8. Multiple-service totals are calculated correctly.

9. Materials can be added.

10. Materials increase booking total.

11. Booking total updates in real time.

12. Customer can optionally select a preferred employee.

13. Preferred employee availability is validated.

14. Available preferred employee is directly assigned.

15. Unavailable employee cannot be assigned.

16. Available alternative employees are suggested.

17. Alternatives are ranked using ratings.

18. Customer may proceed without selecting an employee.

19. Such bookings reach Admin as `Pending Assignment`.

20. Admin manual assignment works.

21. Admin can assign multiple employees.

22. Auto Assign works.

23. Auto Assign respects availability.

24. Double booking of employees is prevented.

25. One-time bookings work.

26. Multiple selected date bookings work.

27. Daily recurrence works.

28. Selected weekday recurrence works.

29. Long-term bookings work.

30. Each recurring occurrence can be handled independently.

31. Employee availability is checked for individual recurring occurrences.

32. Lifecycle statuses work.

33. Invalid status transitions are prevented.

34. Status history is maintained.

35. Completed bookings allow employee ratings.

36. Ratings support half-star increments.

37. Each employee can be rated independently.

38. Employee average rating is maintained.

39. Employee rating count is maintained.

40. Ratings influence employee recommendations.

41. Editing booking time rechecks employee availability.

42. Changing employee count recalculates total.

43. Server independently validates availability.

44. Server independently calculates booking duration.

45. Server independently calculates final price.



# Prompt 18 — Admin-Configurable Daily Booking Hours

Extend the existing booking system with **Daily Booking Hours** configurable by Admin.

Do not rebuild or alter the existing booking, pricing, recurrence, employee assignment, availability, or status workflows except where required to enforce these booking-hour limits.

## Admin Configuration

1. Add a dedicated Admin submenu item:

   `Booking Settings → Booking Hours`

2. Admin must be able to configure:

   * **First Booking Start Time**
   * **Last Working / Booking End Time**

3. Example configuration:

   `First Booking Start Time: 08:00 AM`

   `Last Working Time: 08:00 PM`

4. These values define the daily operational window during which service bookings may take place.

5. Admin must be able to update these times at any time through the submenu.

6. Validate the configuration so that:

   `Last Working Time > First Booking Start Time`

7. Do not allow invalid configurations such as:

   `Start: 08:00 PM`

   `End: 08:00 AM`

8. Display the currently configured booking hours clearly in the Admin settings screen.

---

## Booking Time Restrictions

Apply the configured booking hours throughout the existing booking system.

### First Booking Start Time

No booking may start before the configured first booking time.

Example:

Configured:

`08:00 AM – 08:00 PM`

Valid:

`08:00 AM – 10:00 AM`

Invalid:

`07:30 AM – 09:30 AM`

---

### Last Working Time

The booking must fully finish by the configured last working time.

Example:

Configured last working time:

`08:00 PM`

Valid:

`06:00 PM – 08:00 PM`

Invalid:

`07:00 PM – 09:00 PM`

The last working time represents the latest time at which an assigned employee can finish work for a booking.

Do not treat it as the latest booking start time.

---

## Customer Booking UI

1. Only allow booking times within the configured daily booking window.

2. Do not present invalid start times before the first booking start time.

3. Do not allow the selected end time to exceed the last working time.

4. When a customer selects a start time, restrict available end times accordingly.

Example:

Configured:

`08:00 AM – 08:00 PM`

Selected start:

`06:00 PM`

The customer may select an end time up to:

`08:00 PM`

but not later.

5. Existing minimum duration, booking interval, employee availability, and conflict rules must still apply.

---

## Admin Booking and Rescheduling

The same booking-hour restrictions must apply when Admin:

* Creates a booking
* Edits a booking
* Reschedules a booking
* Manually assigns employees
* Uses Auto Assign

Admin must not be able to create or move a normal booking outside configured booking hours unless a separate override feature is explicitly introduced later.

---

## Employee Availability

Existing employee availability logic must operate within the configured booking hours.

An employee may be individually available for a wider period, but normal customer bookings must still respect the business booking window.

Example:

Employee availability:

`07:00 AM – 10:00 PM`

Business Booking Hours:

`08:00 AM – 08:00 PM`

Customer-bookable window remains:

`08:00 AM – 08:00 PM`

---

## Recurring Bookings

Apply booking-hour validation to all existing recurring booking types.

Every occurrence must:

* Start at or after the configured first booking start time.
* Finish at or before the configured last working time.

Do not create invalid recurring occurrences outside the daily booking window.

If an existing recurring schedule is edited and its time violates the current booking-hour configuration, prevent the change and show an appropriate validation message.

---

## Required Validation

Before creating, updating, or rescheduling any booking, validate:

`Booking Start Time >= First Booking Start Time`

AND

`Booking End Time <= Last Working Time`

AND

`Booking End Time > Booking Start Time`

These validations must be enforced server-side in addition to the UI restrictions.

---

## Example

Admin configuration:

`First Booking Start Time: 08:00 AM`

`Last Working Time: 08:00 PM`

### Allowed

* 08:00 AM – 09:00 AM
* 10:00 AM – 02:00 PM
* 05:30 PM – 08:00 PM

### Not Allowed

* 07:30 AM – 09:00 AM
* 07:00 PM – 08:30 PM
* 08:00 PM – 09:00 PM
* Any booking crossing into the next day

The booking system is currently daytime-only. Do not support overnight bookings.

---

## Acceptance Criteria

Consider this enhancement complete only when:

1. Admin has a `Booking Settings → Booking Hours` submenu.
2. Admin can set the first booking start time.
3. Admin can set the last working/end time.
4. Invalid booking-hour configurations are rejected.
5. Customers cannot start bookings before opening time.
6. Customers cannot end bookings after closing time.
7. Available time selectors respect the configured window.
8. Admin-created bookings follow the same restrictions.
9. Rescheduled bookings follow the same restrictions.
10. Recurring bookings follow the same restrictions.
11. Employee assignment cannot result in work extending beyond the configured last working time.
12. Auto Assign respects booking-hour restrictions.
13. Backend validates all booking-hour rules.
14. Overnight bookings remain unsupported.
15. Existing booking functionality continues to work without regression.
