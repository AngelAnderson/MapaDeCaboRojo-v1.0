#!/usr/bin/env node
// One-shot palette migration: cold slate + teal -> warm token system.
// Ordered rules, most-specific first. Only touches paired light/dark class
// combos and bg-/text-/border- prefixes so image-scrim gradients (from-slate-900)
// are left alone. Run: node scripts/migrate-palette.mjs <files...>
import { readFileSync, writeFileSync } from 'node:fs';

const rules = [
  // ---- text (dark-to-light pairs, darkest first) ----
  [/text-slate-900 dark:text-white/g, 'text-ink'],
  [/text-slate-900 dark:text-slate-100/g, 'text-ink'],
  [/text-slate-800 dark:text-white/g, 'text-ink'],
  [/text-slate-800 dark:text-slate-100/g, 'text-ink'],
  [/text-slate-800 dark:text-slate-200/g, 'text-ink'],
  [/text-slate-700 dark:text-slate-100/g, 'text-ink'],
  [/text-slate-700 dark:text-slate-200/g, 'text-ink'],
  [/text-slate-700 dark:text-slate-300/g, 'text-ink-soft'],
  [/text-slate-600 dark:text-slate-300/g, 'text-ink-soft'],
  [/text-slate-600 dark:text-slate-400/g, 'text-ink-soft'],
  [/text-slate-500 dark:text-slate-400/g, 'text-ink-muted'],
  [/text-slate-500 dark:text-slate-500/g, 'text-ink-muted'],
  [/text-slate-400 dark:text-slate-500/g, 'text-ink-muted'],
  [/text-slate-400 dark:text-slate-600/g, 'text-ink-muted'],
  // single-sided text (no dark: variant) — safe neutral mapping
  [/text-slate-900(?!\/)/g, 'text-ink'],
  [/text-slate-800(?!\/)/g, 'text-ink'],
  [/text-slate-700(?!\/)/g, 'text-ink'],
  [/text-slate-600(?!\/)/g, 'text-ink-soft'],
  [/text-slate-500(?!\/)/g, 'text-ink-muted'],
  [/text-slate-400(?!\/)/g, 'text-ink-muted'],
  [/text-slate-300(?!\/)/g, 'text-ink-muted'],

  // ---- borders ----
  [/border-slate-100 dark:border-slate-700/g, 'border-line'],
  [/border-slate-100 dark:border-slate-600/g, 'border-line'],
  [/border-slate-200 dark:border-slate-700/g, 'border-line'],
  [/border-slate-200 dark:border-slate-600/g, 'border-line'],
  [/border-slate-300 dark:border-slate-600/g, 'border-line-strong'],
  [/border-slate-200(?!\/)/g, 'border-line'],
  [/border-slate-100(?!\/)/g, 'border-line'],
  [/border-slate-700(?!\/)/g, 'border-line'],
  [/border-slate-600(?!\/)/g, 'border-line'],

  // ---- surfaces / backgrounds (paired) ----
  [/bg-white dark:bg-slate-900/g, 'bg-canvas'],
  [/bg-white dark:bg-slate-800/g, 'bg-paper'],
  [/bg-slate-50 dark:bg-slate-900/g, 'bg-canvas'],
  [/bg-slate-50 dark:bg-slate-800\/50/g, 'bg-paper-2'],
  [/bg-slate-50 dark:bg-slate-800/g, 'bg-paper-2'],
  [/bg-slate-50 dark:bg-slate-700\/50/g, 'bg-paper-2'],
  [/bg-slate-50 dark:bg-slate-700/g, 'bg-paper-2'],
  [/bg-slate-100 dark:bg-slate-800/g, 'bg-paper-2'],
  [/bg-slate-100 dark:bg-slate-700/g, 'bg-paper-2'],
  [/bg-slate-200 dark:bg-slate-700/g, 'bg-line'],
  [/bg-slate-200 dark:bg-slate-600/g, 'bg-line'],
  // hovers
  [/hover:bg-slate-100 dark:hover:bg-slate-700/g, 'hover:bg-paper-2'],
  [/hover:bg-slate-100 dark:hover:bg-slate-600/g, 'hover:bg-line'],
  [/hover:bg-slate-200 dark:hover:bg-slate-600/g, 'hover:bg-line'],
  [/hover:bg-slate-200 dark:hover:bg-slate-700/g, 'hover:bg-line'],
  [/hover:bg-slate-50 dark:hover:bg-slate-700/g, 'hover:bg-paper-2'],

  // ---- translucent glass chrome (opacity variants) ----
  [/bg-white\/90 dark:bg-slate-900\/90/g, 'bg-paper/90'],
  [/bg-white\/80 dark:bg-slate-800\/80/g, 'bg-paper/80'],
  [/bg-white\/90 dark:bg-slate-800\/90/g, 'bg-paper/90'],
  [/bg-white\/70 dark:bg-slate-800\/80/g, 'bg-paper/75'],
  [/bg-white\/60 dark:bg-slate-800\/60/g, 'bg-paper/70'],
  [/border-white\/60 dark:border-slate-700\/50/g, 'border-line'],
  [/border-white\/40 dark:border-slate-700\/50/g, 'border-line'],
  // single-sided dark hovers/text left behind by paired rules
  [/dark:hover:bg-slate-800(?!\/)/g, 'dark:hover:bg-paper-2'],
  [/dark:hover:bg-slate-700(?!\/)/g, 'dark:hover:bg-paper-2'],
  [/dark:hover:text-slate-200/g, 'dark:hover:text-ink'],
  [/dark:hover:text-slate-100/g, 'dark:hover:text-ink'],
  // CategoryPills active/inactive
  [/bg-slate-800 text-white shadow-lg shadow-slate-900\/20/g, 'bg-ink text-canvas shadow-e2'],
  [/bg-slate-100 text-ink-muted hover:bg-slate-200/g, 'bg-paper-2 text-ink-soft hover:bg-line'],
  [/bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700/g, 'bg-paper-2 hover:bg-line'],

  // ---- teal accent -> brand emerald ----
  [/teal-950/g, 'brand-950'], [/teal-900/g, 'brand-900'], [/teal-800/g, 'brand-800'],
  [/teal-700/g, 'brand-700'], [/teal-600/g, 'brand-600'], [/teal-500/g, 'brand-500'],
  [/teal-400/g, 'brand-400'], [/teal-300/g, 'brand-300'], [/teal-200/g, 'brand-200'],
  [/teal-100/g, 'brand-100'], [/teal-50(?![0-9])/g, 'brand-50'],
];

let grand = 0;
for (const file of process.argv.slice(2)) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  let count = 0;
  for (const [re, to] of rules) {
    src = src.replace(re, () => { count++; return to; });
  }
  if (count > 0) { writeFileSync(file, src); grand += count; console.log(`${count.toString().padStart(4)}  ${file}`); }
}
console.log(`total replacements: ${grand}`);
