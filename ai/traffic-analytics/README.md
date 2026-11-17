# Archived Tinybird KPI benchmark workspace

This branch preserves the experimental KPI session-qualification implementation
and its reviewed local benchmark artifacts before deleting the original worktree.

The [artifact archive](benchmark-artifacts.tar.gz) contains benchmark scripts,
experiment definitions, source snapshots, result samples, reports, and sanitized
validation logs. The [manifest](artifact-manifest.json) lists every included file
with its size and SHA-256 checksum.

The entire raw-data backup directory, including the 8 GB analytics export and
any compressed copies, is excluded. Dependencies, caches, and Python bytecode are
also excluded. See [preservation notes](ARTIFACT-PRESERVATION.md) for redactions
and the separately recorded theme revision.

To inspect the artifacts from the repository root:

```sh
python3 -c "import hashlib,json,pathlib; p=pathlib.Path('ai/traffic-analytics'); m=json.loads((p/'artifact-manifest.json').read_text()); assert hashlib.sha256((p/m['archive']).read_bytes()).hexdigest() == m['sha256']"
tar -xzf ai/traffic-analytics/benchmark-artifacts.tar.gz -C ai/traffic-analytics
```

The extracted `WORKSPACE-README.md` describes the historical benchmark workspace.
Historical benchmark results are preserved; the workload and test suites have
not been rerun as part of this archival operation. Restoring a raw analytics
dataset requires a separately supplied export; none is included in this branch.
