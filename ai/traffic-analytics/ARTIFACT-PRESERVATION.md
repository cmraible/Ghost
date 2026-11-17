# Preserved benchmark artifacts

This branch preserves the KPI session-qualification implementation and its local
benchmark workspace before removing the original worktree.

- Included: benchmark scripts, experimental pipe definitions, source snapshots,
  measurement results, reports, regression oracle, and sanitized validation logs.
- Excluded: the entire raw-data backup directory (including the 8 GB analytics
  export), compressed raw-data copies, Python bytecode, dependencies, and caches.
- Sanitized: personal home/worktree paths, private network addresses, and private
  CI execution URLs in historical logs. Historical commands and checksums describe
  the original experiment; redacted log bytes differ from their original copies.
- Local theme checkout: Source commit
  `219dc7dbe62bb6dfa8db9fd651528571eae6cfd3` was already present on the theme's
  upstream `main` and contained no local edits. This revision is recorded here;
  the KPI archive does not change the repository's theme submodule pin.

The original PR was closed without merging. The preserved implementation remains
experimental; this archival commit does not claim that the benchmark or test
suites were rerun. Historical validation outcomes are retained in the reports.
