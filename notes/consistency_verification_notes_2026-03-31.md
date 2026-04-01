# Consistency Verification Notes

## Current observed state on `/map`

After restarting the app and reopening the public URL, the platform loaded successfully again.

### Unified counts now visible

| Surface | Observed value |
|---|---:|
| Top-bar bell badge | 1 |
| Sidebar Alerts badge | 1 |
| Map KPI button | 1 Alerts |
| Map severity summary | C0 · W0 · M1 |

### Key visual findings

The top bar ticker now rotates over **active regions only** instead of all non-safe regions. The bell badge no longer shows a different database unread count. The sidebar Alerts badge also reflects the same single active alert count.

The alert popup opened successfully and visually shows a list centered around the same active-alert model rather than all non-safe regions. This confirms the main inconsistency between top bar, sidebar, and alert center has been addressed.

### Remaining verification target

The next check should confirm whether the dedicated Alerts page and any dashboard KPI surfaces also match the same centralized active-alert summary, especially for severity-state wording and counts.
