# RPNL / Total PnL Reconciliation — UI Design

**Ticket:** [FEDEV-3758](https://linear.app/gmx-io/issue/FEDEV-3758/bug-trade-history-rpnl-doesnt-reconcile-with-all-time-total-pnl-panel)
**Status:** Design approved
**Date:** 2026-04-20

## Background

Users cannot reconcile the **All-time Total PnL** shown in the General Performance Details panel against the sum of per-row **RPNL** in the trade history, even on accounts with no open positions. On the verified example account (`0x665Ba381eeC611431F201D146ce191b7534DCf6f` on Arbitrum), the unexplained gap is ~$3,081.60.

Two independent PRs address this:

1. **Squid-side (already shipped in a branch deployment)** — adds `swapFeeUsd` to `PositionChange` and `TradeAction`, changes `pnlUsd` to include opening fees on increase rows and swap-fee subtraction on decrease rows, and exposes `realizedSwapFeesUsd` as its own field on `accountPnlSummaryStats`.
2. **UI-side (this spec)** — renders the new values and removes a stale tooltip that said swap fees were excluded.

## Scope

Four UI tasks, priority order per the handoff:

1. Render `TradeAction.pnlUsd` in the RPNL column for increase rows
2. Add a "Realized swap fees" line in the General Performance Details debug tooltip
3. Remove "Excludes swap fees" from the leaderboard tooltip
4. Surface the outstanding-claimable disclaimer on the panel

All four land in one PR since they share the same ticket. Each task is independent — no shared state between them.

## Non-goals

- Introducing a dedicated **Fees** column in trade history. That lands under [FEDEV-2831](https://linear.app/gmx-io/issue/FEDEV-2831). When it ships, opening fees move out of the RPNL column back to `pnlUsd`-on-decreases only.
- Splitting `realizedFeesUsd` into per-type components (position fee / borrowing / funding / UI fee / referral discount) in the debug tooltip. Squid exposes aggregates only. Separate follow-up if/when squid exposes per-type.
- Showing "Outstanding claimable" as an actual dollar value in the panel. The current design only surfaces a text disclaimer; fetching claimable totals per account is deferred.
- Re-deriving swap fees, opening fees, or per-row decrease PnL client-side. Per handoff, use the squid fields directly.

## Interim-state coupling

Task 1's rendering is **temporary**. Per the ticket, once [FEDEV-2831](https://linear.app/gmx-io/issue/FEDEV-2831) ships a dedicated Fees column, the opening-fee value moves into that column and `TradeAction.pnlUsd` on increase rows should either be ignored by the UI or go back to `null` on the squid side. The design doc for FEDEV-2831 will need to reverse Task 1's rendering logic.

## Task 1 — Increase-row RPNL rendering

### Behavior

`MarketIncrease` / `LimitIncrease` / `StopIncrease` rows on the `OrderExecuted` event render the squid-provided negative `pnlUsd` in the RPNL column with a tooltip clarifying it's the opening fee, not realized PnL.

`OrderCreated` / `OrderCancelled` / `OrderFrozen` / `OrderUpdated` rows for these order types still show `-` in RPNL (no fee was paid).

### Files

- `src/components/TradeHistory/TradeHistoryRow/utils/position.ts` — three branches updated:
  - `MarketIncrease + OrderExecuted` (separate branch)
  - `LimitIncrease + OrderExecuted` and `StopIncrease + OrderExecuted` (share one branch in current code)
  - TWAP `OrderExecuted` (handles both increase and decrease TWAPs)
- `src/components/TradeHistory/TradeHistoryRow/utils/shared.ts` — add `pnlTooltip?: string` to `RowDetails`
- `src/components/TradeHistory/TradeHistoryRow/TradeHistoryRow.tsx` — wrap the RPNL cell in `TooltipWithPortal` when `msg.pnlTooltip` is set, otherwise render the existing bare span
- `src/components/TradeHistory/TradeHistoryRow/utils.spec.ts` — new tests covering the increase-execute scenarios

### Value source

`formatUsd(tradeAction.pnlUsd)` — squid returns the value already signed-negative for increase rows. No client-side sign flip.

### Color state

`numberToState(tradeAction.pnlUsd)` → `"error"` for negative values, rendering red. Same helper the decrease rows use. Matches the handoff intent ("subtracted from your realized PnL").

### Tooltip content

```
"Opening fee paid at this action. Subtracted from your realized PnL."
```

Wrapped in lingui `t\`...\`` for translation.

### TWAP handling

The TWAP `OrderExecuted` branch in `position.ts` (line 247) handles TWAP executes regardless of order type. Currently it only sets `pnl` when `sizeDeltaUsd > 0n` — decrease TWAPs with size render realized PnL; increase TWAPs with size today render nothing. Keep the `sizeDeltaUsd > 0n` guard and extend the branch so that when it's an increase order type, it also sets `pnlTooltip` to the opening-fee message. Decrease TWAPs keep the current behavior (no tooltip — the value is realized PnL, not a fee).

### Undefined handling

If `tradeAction.pnlUsd` is `undefined` (older indexer data, or a squid still on the pre-PR schema), leave `result.pnl` unset. `TradeHistoryRow.tsx`'s existing `!msg.pnl` check renders `-` as it does today. This keeps the UI safe against stale squid deployments.

## Task 2 — Realized swap fees in debug tooltip

### Behavior

New "Realized swap fees" line in the General Performance Details debug tooltip, immediately after the existing "Realized fees" line. Visible only when `showDebugValues` is on.

### Files

- `src/domain/synthetics/accountStats/usePnlSummaryData.ts` — add `realizedSwapFeesUsd: bigint` to `PnlSummaryPointDebugFields`, add the field to `DEBUG_QUERY`, add mapping in the debug transformer branch
- `src/pages/AccountDashboard/generalPerformanceDetailsDebug.tsx` — add one `StatsTooltipRow`

### Schema addition

```ts
// In PnlSummaryPointDebugFields
realizedSwapFeesUsd: bigint;
```

### GraphQL query addition

Add `realizedSwapFeesUsd` to `DEBUG_QUERY` only. `PROD_QUERY` stays unchanged; the non-debug tooltip doesn't show the fee breakdown.

### Transformer addition

```ts
realizedSwapFeesUsd: row.realizedSwapFeesUsd !== undefined ? BigInt(row.realizedSwapFeesUsd) : 0n,
```

in the `showDebugValues` branch of the transformer in `usePnlSummaryData.ts`.

### Component addition

Inserted after the "Realized fees" row, before the `<br />` separator:

```tsx
<StatsTooltipRow
  label={t`Realized swap fees`}
  showDollar={false}
  textClassName={getPositiveOrNegativeClass(-row.realizedSwapFeesUsd)}
  value={formatUsd(-row.realizedSwapFeesUsd)}
/>
```

The value is negated to match the existing "Realized fees" convention — the squid returns fees as positive magnitudes, but they subtract from PnL so the display shows them as negative.

### Label of the existing "Realized fees" row

No change. Per the updated handoff, `realizedFeesUsd` no longer includes swap fees, so "Realized fees" is still semantically correct for the position-fee aggregate. The new "Realized swap fees" line removes ambiguity.

## Task 3 — Leaderboard tooltip string removal

### Behavior

The `PNL ($)` column tooltip on the leaderboard no longer says "Excludes swap fees."

### File

`src/pages/LeaderboardPage/components/LeaderboardPositionsTable.tsx:151`

### Change

```diff
- tooltip={t`Total realized and unrealized PnL for the period. Includes price impact and fees. Excludes swap fees.`}
+ tooltip={t`Total realized and unrealized PnL for the period. Includes price impact and fees.`}
```

Locale `.po` files under `src/locales/*/messages.po` will pick up the new and removed strings when `npx lingui extract` runs. No manual `.po` edits.

### Related

Closes the UI ask in [FEDEV-2131](https://linear.app/gmx-io/issue/FEDEV-2131), now absorbed into FEDEV-3758.

## Task 4 — Outstanding-claimable disclaimer

### Behavior

The PnL cell tooltip in the General Performance Details panel appends a muted disclaimer:

> Outstanding claimable amounts are not included.

Shown in both the non-debug and debug branches of the tooltip (the claimable omission is real in both views).

### Rationale

The panel aggregate does not include unclaimed claimable amounts (positive funding owed to trader, capped impact diff, funding deficits). Per `claimable-pending-investigation.md`, both the panel and the per-row RPNL ignore claimables symmetrically — there is no squid-side reconciliation gap, but the panel still understates a trader's true net-entitled position when claimables are outstanding.

Option A (tooltip-only) was chosen over Option B (separate "Outstanding claimable: $X" line) because:
- The panel is per-bucket (today / week / month / year / all-time); claimable amounts are account-wide and not time-bucketable.
- A separate line with an actual dollar value requires fetching claimable totals per account — additional data plumbing, out of scope for this spec.
- The tooltip matches the existing pattern: cell-level tooltips hold contextual notes.
- The handoff says "Pick whichever fits the existing panel design." Tooltip fits; separate line would be new UI surface area.

### Files

- `src/pages/AccountDashboard/GeneralPerformanceDetails.tsx` — append disclaimer to the non-debug tooltip content (inside the `content={...}` prop of the PnL cell, after the three `StatsTooltipRow` entries)
- `src/pages/AccountDashboard/generalPerformanceDetailsDebug.tsx` — append the same disclaimer at the end of the fragment

### Content

```tsx
<br />
<div className="text-body-small text-typography-secondary">
  <Trans>Outstanding claimable amounts are not included.</Trans>
</div>
```

Exact class names verified during implementation against sibling muted-note patterns in the codebase.

### Alternative considered

A shared `<ClaimableNote />` component across both call sites. Rejected as premature — two usages of an identical text string don't justify a component. Extract if a third consumer appears.

## Data plumbing summary

### New fields read from the squid

| Field | Source | Used where | Plumbing path |
| --- | --- | --- | --- |
| `TradeAction.pnlUsd` on increase rows | `useTradeHistory.ts` GraphQL query (already present) | `position.ts` → `TradeHistoryRow.tsx` RPNL cell | No schema changes; value semantic changed on the squid side |
| `TradeAction.swapFeeUsd` | `useTradeHistory.ts` GraphQL query (new field to add) | Carried through `PositionTradeAction` type; **not rendered** in this spec | Add to GraphQL query, to `PositionTradeAction` type in `sdk/src/utils/tradeHistory/types.ts`, to transformer in `sdk/src/utils/tradeHistory/utils.ts`. Future-use for FEDEV-2831. |
| `accountPnlSummaryStats.realizedSwapFeesUsd` | `usePnlSummaryData.ts` `DEBUG_QUERY` (new field) | `generalPerformanceDetailsDebug.tsx` | Add to `DEBUG_QUERY`, to `PnlSummaryPointDebugFields`, to debug transformer branch |

### Decision: plumb `swapFeeUsd` even though it's not rendered now

The handoff lists it as one of the schema additions. Adding it to the type + query + transformer now means FEDEV-2831 (Fees column) can consume it without another round of SDK changes. Risk of dead field is low — it's a typed property on an interface, not a runtime import, and the incremental test surface is zero.

## Testing

### Unit tests

Extend `src/components/TradeHistory/TradeHistoryRow/utils.spec.ts` with:

- `MarketIncrease + OrderExecuted` with negative `pnlUsd` → asserts `pnl` rendered, `pnlState === "error"`, `pnlTooltip` set
- `LimitIncrease + OrderExecuted` with negative `pnlUsd` → same assertions
- `MarketIncrease + OrderCreated` → asserts `pnl` is `undefined`
- TWAP `OrderExecuted` on an increase order type with `pnlUsd` populated → asserts `pnl` rendered, `pnlTooltip` set

No new test files for Tasks 2, 3, 4 — they're either pure string replacements (Task 3), a one-line schema addition (Task 2), or a text-note addition (Task 4).

### Manual verification

Per the handoff:

- Account: `0x665Ba381eeC611431F201D146ce191b7534DCf6f` on Arbitrum (no open positions)
- Expected: sum of trade-history `TradeAction.pnlUsd` across all rows ≈ panel all-time `totalPnl` within rounding
- Requires the squid branch deployment pointed at the UI instance before verification is meaningful

### Type-check & build

- `yarn tsc` / `npx tsc --noEmit`
- `npx lingui extract` to regenerate `.po` files for added/removed strings

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Squid branch deployment isn't live when UI ships | `pnlUsd` undefined-check keeps the old behavior (blank RPNL) until the squid is deployed. No crash, no misleading number. |
| `realizedSwapFeesUsd` field missing in squid response | Debug transformer defaults to `0n`. Tooltip shows `$0.00` rather than crashing. Safe default. |
| Users confused by negative RPNL on increase rows | The tooltip clarifies it's an opening fee. If it's still confusing in user testing, FEDEV-2831 (Fees column) is the permanent fix — this is interim. |
| Tooltip disclaimer misread as "claimables are ignored entirely" | Wording focuses on "not included [in this figure]" to leave room for the user to know claimables exist separately elsewhere in the UI. |

## Out of scope — explicit

- FEDEV-2831 Fees column (this spec's interim rendering is its prerequisite UI work)
- Finer fee breakdown in debug tooltip (requires squid changes)
- Showing actual claimable dollar values in the panel (requires client-side claimable-totals fetch)
- Rendering `TradeAction.swapFeeUsd` per-row (folded into `pnlUsd` by the squid; no separate UI surface today)
