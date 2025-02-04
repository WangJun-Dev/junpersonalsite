---
tags: []
title: Sepia
---

## Agents in Sepia

Every Agent in Sepia follows the same lifecycle:

- Constructor – called once when the game engine instantiates your agent (no map info yet).
- initialStep(StateView, HistoryView) – called on turn 0. This is your chance to look at the starting map (units, resources, etc.).
- middleStep(StateView, HistoryView) – called each turn (1, 2, 3, …) until the game ends. This is where you return actions for your units.
- terminalStep(StateView, HistoryView) – called after the game ends (e.g. to print out who won or final stats).
