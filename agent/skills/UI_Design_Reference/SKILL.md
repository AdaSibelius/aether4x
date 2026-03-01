---
name: UI Design Reference
description: Design standards for Nebula4X tables based on the Industrial Ledger style.
---
# Nebula4X UI Design Reference: Tables

All data tables in Nebula4X should follow the "Industrial Ledger" design patterns established in the Colony Manager to ensure a consistent, high-fidelity, and strategic aesthetic.

## 1. Typography & Hierarchy

- **Table Headers (`<th>`)**:
    - **Font Size**: 9px or 10px.
    - **Transform**: `uppercase`.
    - **Letter Spacing**: `0.1em` to `0.12em` (tracked out).
    - **Color**: `var(--text-muted)`.
    - **Background**: Subtle dark fill (e.g., `rgba(0, 0, 0, 0.2)`).
    - **Border**: `2px solid var(--border-dim)` bottom border for primary tables.
- **Table Cells (`<td>`)**:
    - **Font Size**: 11px or 12px (base).
    - **Color**: `var(--text-primary)` for labels, `var(--text-secondary)` for supplemental info.
    - **Padding**: `10px` preferred for standard rows, `6px 10px` for compact views.
- **Data & Values**:
    - **Font Family**: Always use `JetBrains Mono` (`var(--font-mono)`) for numerical values, IDs, and rates to ensure clear alignment and a "data-heavy" look.
    - **Font Weight**: `500` or `medium`.

## 2. Visual Structure

- **Row Separation**:
    - Use `1px solid rgba(255, 255, 255, 0.04)` for light, subtle row dividers.
- **Category Rows (`.ledgerCategory`)**:
    - For tables with multiple sections, use a full-width spanned row (`colSpan={...}`).
    - **Background**: `rgba(79, 195, 247, 0.05)` (subtle blue tint).
    - **Text**: Uppercase, bold, using `var(--accent-blue)`.
- **Interactivity**:
    - Include a `:hover` state on `<tr>` with a subtle background increase (e.g., `rgba(255, 255, 255, 0.02)`).

## 3. Alignment Standards

- **Labels/Names**: Always **Left-aligned**. If using an icon, wrap it in a `ledgerIcon` span (fixed width, centered) next to the name.
- **Numerical Quantities**: Always **Right-aligned** (standard for finance/industry ledgers).
- **Percentages/Status**: Generally **Centered** or **Right-aligned** depending on context.
- **Actions/Buttons**: **Center-aligned** or tucked into the rightmost column.

## 4. Common Components

- **Staffing/Progress Meters**:
    - Use the standard `meterTrack` and `meterFill` structure within cells for visual data representation.
    - Width should be roughly `60px - 80px`.
- **Status Badges**:
    - Use `status-badge` with `status-settled` (green) or `status-partial` (yellow) for discrete states.

## 5. CSS Reference

Always check `ColonyManager.module.css` for the latest implementation of `.ledgerTable`.

```css
.ledgerTable {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
}

.ledgerTable th {
    text-align: left;
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.1em;
    padding: 6px 10px;
    border-bottom: 2px solid var(--border-dim);
    background: rgba(0, 0, 0, 0.2);
}
```
