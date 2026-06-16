# Commission & Pay Calculator — Design

## Overview

A manager-only page at `/commission` that lets store managers build pay offers for prospective employees. Combines base hourly pay, position-specific certifications/add-ons, and commission tiers to show weekly and annualized total compensation.

## Positions & Base Pay

| Position | Base Pay | Commission Program |
|---|---|---|
| Mechanic (with tools) | $22/hr | Non-Flag Hour (2–7%) |
| Mechanic (without tools) | $18/hr | Non-Flag Hour (2–7%) |
| Tire Tech | $18/hr | Non-Flag Hour (2–7%) |
| Service Tech | $18/hr | Service Tech (4–8.5%) |
| Warehouse | $18/hr | None |
| Lube | $14/hr | None |
| Retail | $18/hr | None |

## Commission Tiers

**Service Tech** (labor only, starts at $7K/week):
$7K–$10K → 4% | $10K–$12.5K → 5% | $12.5K–$15K → 6% | $15K–$20K → 7% | $20K+ → 8.5%

**Non-Flag Hour** (labor + parts, starts at $14K/week):
$14K–$16K → 2% | $16K–$18K → 3% | $18K–$22K → 4% | $22K–$24K → 5% | $24K–$28K → 6% | $28K+ → 7%

## Add-Ons (Position-Specific)

Each position has a different set of available certifications and bonuses. The calculator only shows relevant add-ons based on the selected position.

## Architecture

- **`app/lib/commission.ts`** — pure TypeScript functions for all calculations (no React, no API)
- **`app/commission/page.tsx`** — single-page UI, client-rendered, follows existing styling patterns
- **`app/components/NavBar.tsx`** — adds Commission nav link
- No backend changes needed — all data hardcoded from the compensation plan PDF

## Page Flow

1. Manager selects position → reveals role-specific toggles (Mechanic: tools, Retail: manager)
2. Certifications section shows position-appropriate add-ons (checkboxes for flat bonuses, +/- buttons for counted items)
3. Weekly production input appears only for commission-eligible roles
4. Pay summary card updates in real-time: base + add-ons → effective hourly → weekly + commission → annualized

## Pay Calculation Formula

```
effectiveHourly = basePay + addOnsPerHour
weeklyBasePay = effectiveHourly × 40
weeklyCommission = weeklyBilled × commissionRate (0 if below threshold)
weeklyTotal = weeklyBasePay + weeklyCommission + addedWeekly
annualized = weeklyTotal × 52
```
