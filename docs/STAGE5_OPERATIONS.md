# Stage 5 — AR, Collections and Checks

## What creates a receivable

A finalized Stage 4 Sales Invoice creates one AR obligation, even before delivery. Quotation, Sales Order and goods release do not create additional AR. Each partial invoice has its own amount and terms-based due date. Custom due dates remain explicit frozen dates. Existing invoice/Sale amounts, VAT and inventory records are never rewritten.

An eligible independent Posted Sale creates one Sale-based obligation. Stage 4 release Sales are always excluded, even before invoicing. Existing actual payments are recognized once, with a unique original-payment link. An unpaid payment-method selection is never money received. Historical checks enter as Received, not Cleared. Reversed Sales, historical returns and ambiguous payment histories require Owner review rather than automatic import. Use “Reconcile existing eligible invoices and Sales” for missing eligible historical sources; repeated use does not duplicate them.

## Recording money

Open Accounts Receivable → select the invoice → Record Collection. Enter amount, date and actual payment method. The customer/invoice relationship is already set. Record split payments as separate Collections; each receives its own COL number. Choose a configured receiving account where applicable. Receiving accounts remain managed in the existing Sales settings.

The form changes for Check payments. Record bank, check number and check date. Reference is optional for other methods. Cash does not display bank/check fields. Double-click/retry protection prevents duplicate submissions. Amounts cannot exceed available receivable capacity. Pending checks reserve capacity to avoid accidentally taking another payment against the same instrument; cancel/reverse an instrument before replacing it.

Financial events must not be dated before an already-recorded financial event on that receivable. This prevents retrospective over-collection and contradictory historical statements. Future Collection/status/reversal dates are rejected; a future check date is allowed.

## Checks

Received → Deposited → Cleared. Received and Deposited checks remain pending and do not reduce outstanding AR. Only Cleared settles AR. A post-dated check cannot be deposited/cleared before its check date. Cancelled or Returned / Bounced instruments do not settle AR. A bounced previously-cleared check restores the collectible balance. Every transition retains its employee, date, reason and history. Conflicting status changes require reloading.

Outstanding Balance, Pending Checks and Cleared Collections are separate figures. A historical independent Sale may retain its original payment label; the current authoritative settlement is the AR record.

## Corrections and returns

A Collection is reversed with a dated reason; it is never deleted. Open the Collection → Reverse Collection. The original remains in history and the balance updates.

A Product Return does not automatically change AR. After a Return is Completed, an employee with Owner-granted `ar.adjust` permission can select it on the AR detail and approve a separate reduction. It is capped by accepted historical returned value and the invoice's allocated share. One approved adjustment per return/receivable is supported. The invoice and Return remain unchanged.

If Collections exceed the reduced obligation, the excess is shown as **Refund Due / Customer Credit Pending**. This is not an executed refund, transferable customer credit or tax credit note. No cash/bank refund is recorded. Adjustment reversal/amendment and official tax-credit documents remain deferred; do not invent these by entering unrelated Collections.

## Dates, aging and statements

Terms include Cash, COD, 7/15/30/45/60/90 Days and Custom. Cash/COD are due immediately, not automatically Paid. Fixed-term invoice AR uses that invoice's Manila business date; Custom retains the explicit contractual due date. Legacy independent Sales retain their stored due dates. No original document is rewritten.

Aging uses remaining balance and Asia/Manila dates: Current, 1–30, 31–60, 61–90 and Over 90 days. Paid items contribute zero. Due Soon means today through the next seven days. Follow-up and Promise-to-Pay never change contractual due dates or balances.

Open a customer → Customer financial position → Statement of Account. Select an as-of date, Generate, then use browser Print. Statements reconstruct effective-dated Collections, check clearing/bounces, reversals and adjustments. They contain no COGS, profit or acquisition costs. They are reports, not new accounting transactions. Later recorded backdated documents can affect a regenerated historical report; generated report snapshots are not stored.

## Permissions

Owner uses existing Administration controls to grant individual permissions to any number of employees or shared roles. No employee names are hard-coded. New AR and Collection permissions are not automatically granted to existing employees.

AR permissions depend on AR read and customer directory access. Collection actions depend on Collection read and AR read. Separately grant check details/status, payment details, receiving accounts, paid history, aging, customer balances, statements, follow-ups/promises, credit and adjustments. Statements require customer-balance and paid-history access. UI hiding is supplemented by fresh server-side checks on every request.

Existing broad Customer credit access remains compatible with Stage 1. An explicit deny of `ar.credit` or `ar.credit.edit` also blocks the old customer form's corresponding field; the new credit editor uses granular permissions. Credit limits and existing On hold status remain advisory; Stage 5 does not automatically block Sales or change customer status.

## Standalone operation and boundaries

Use the existing standalone operating guide/startup scripts. Stage 5 contains no AI API or subscription dependency. Standard Node and PostgreSQL are the operational dependencies for production. The local embedded database must have only one server/process owner at a time.

Multi-invoice allocation tables are ready, but entry currently allocates one Collection to one receivable. Multi-invoice payment entry, automated credit enforcement, notifications, commission clearing, full ledger, marketplace/bank reconciliation, executed refunds and official tax credit notes remain deferred. No Stage 6.
