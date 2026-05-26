# Dossier Rewrite Backlog

Stand: 2026-05-26 | Generiert via `scripts/audit-dossiers.cjs`

**Qualitätsziel:** Score ≥ 85 (Note A) mit mind. 800 Wörtern, konkreten Effektgrößen, ehrlichen Limitierungen, aktuellem updatedAt.

---

## 🔴 P0 — Sofort (hohe Prio + schlechteste Qualität)

| Prio | Score | Wörter | Slug | Hauptprobleme |
|------|-------|--------|------|---------------|
| P0-1 | 60 | 202 | `omega-3` | Zu kurz, keine Zahlen, kein Limitation — großes SEO-Thema |
| P0-2 | 60 | 45 | `vitamin-d3` | Zu kurz, keine Zahlen — sehr hohe Suchanfragen |
| P0-3 | 55 | 55 | `glutathion` | Zu kurz, keine Zahlen, keine Limitierungen |
| P0-4 | 60 | 51 | `l-theanin` | Zu kurz, keine Zahlen, keine Limitierungen |
| P0-5 | 60 | 271 | `zink` | Zu kurz, keine Zahlen — wichtiger Basis-Nährstoff |
| P0-6 | 70 | 160 | `magnesium` | Zu kurz, keine Limitierungen — sehr hohe Suchanfragen |
| P0-7 | 70 | 187 | `coq10` | Zu kurz, keine Zahlen |
| P0-8 | 70 | 156 | `vitamin-d3-k2` | Zu kurz, keine Zahlen |
| P0-9 | 60 | 221 | `quercetin` | Zu kurz, schwache Evidenz, keine Zahlen |
| P0-10 | 80 | 320 | `vitamin-b12` | Zu kurz — kritischer Nährstoff für Veganer |

---

## 🟡 P1 — Bald (hohe Prio, mittlere Qualität)

| Prio | Score | Wörter | Slug | Hauptprobleme |
|------|-------|--------|------|---------------|
| P1-1 | 65 | 275 | `fisetin` | Zu kurz, keine Zahlen |
| P1-2 | 65 | 263 | `lion-s-mane` | Zu kurz, keine Zahlen |
| P1-3 | 65 | 201 | `resveratrol` | Zu kurz, keine Limitierungen |
| P1-4 | 65 | 209 | `spermidine` | Zu kurz, keine Zahlen |
| P1-5 | 70 | 264 | `alpha-liponsaeure` | Zu kurz, keine Zahlen |
| P1-6 | 70 | 227 | `kollagen` | Zu kurz, keine Zahlen |
| P1-7 | 70 | 472 | `kreatin` | Zu kurz, keine Zahlen — großes SEO-Thema |
| P1-8 | 70 | 348 | `probiotika` | Zu kurz, keine Zahlen |
| P1-9 | 70 | 254 | `rhodiola` | Zu kurz, keine Zahlen |
| P1-10 | 70 | 292 | `selen` | Zu kurz, keine Zahlen |
| P1-11 | 70 | 295 | `taurin` | Zu kurz, keine Limitierungen |
| P1-12 | 80 | 243 | `ashwagandha` | Zu kurz |
| P1-13 | 80 | 272 | `curcumin` | Zu kurz |
| P1-14 | 80 | 211 | `nr` | Zu kurz |
| P1-15 | 80 | 284 | `melatonin` | Zu kurz |
| P1-16 | 80 | 268 | `nac` | Zu kurz |
| P1-17 | 80 | 249 | `glycin` | Zu kurz |

---

## 🟠 P2 — Normalprio (wichtige Nährstoffe mit schlechter Qualität)

| Prio | Score | Wörter | Slug | Hauptprobleme |
|------|-------|--------|------|---------------|
| P2-1 | 60 | 155 | `eisen` | Zu kurz, keine Zahlen — relevant für Veganer |
| P2-2 | 60 | 131 | `calcium` | Zu kurz, keine Zahlen |
| P2-3 | 60 | 86 | `cholin` | Zu kurz, keine Zahlen |
| P2-4 | 65 | 327 | `apigenin` | Zu kurz, keine Zahlen |
| P2-5 | 65 | 271 | `astaxanthin` | Zu kurz, keine Zahlen |
| P2-6 | 70 | 248 | `vitamin-k2` | Zu kurz, keine Zahlen |
| P2-7 | 70 | 320 | `jod` | Zu kurz, keine Zahlen |
| P2-8 | 70 | 190 | `berberine` | Zu kurz, keine Zahlen |
| P2-9 | 80 | 330 | `vitamin-c` | Zu kurz |
| P2-10 | 80 | 255 | `egcg` | Zu kurz |
| P2-11 | 80 | 292 | `folsaeure` | Zu kurz |
| P2-12 | 80 | 293 | `vitamin-e` | Zu kurz |

---

## 🟢 Bereits gut (Score ≥ 85, kein Rewrite nötig)

| Score | Slug |
|-------|------|
| 110 | `hyaluronsaeure` ✅ |
| 100 | `koffein` ✅ |
| 100 | `l-citrullin` ✅ |
| 90 | `beta-alanin` ✅ |
| 90 | `nmn` ✅ |
| 90 | `urolithin-a` ✅ |
| 90 | `betain` ✅ |
| 90 | `l-tyrosin` ✅ |

---

## Rewrite-Workflow

Für jeden Rewrite:
1. PubMed-Digest laufen lassen → neue Studien checken
2. Claude Code spawnen mit Prompt: "Rewrite [slug] mit mind. 800 Wörtern, konkreten Effektgrößen (SMD, %, mg), ehrlichen Limitierungen, EFSA-Status, updatedAt: 2026-XX-XX"
3. Legal-Check (bestehende Scripts)
4. `pnpm build` → commit → push
5. Score nach Rewrite mit `audit-dossiers.cjs` prüfen

**Modell:** Claude Sonnet für Rewrites (Qualität > Kosten bei SEO-kritischen Seiten)
