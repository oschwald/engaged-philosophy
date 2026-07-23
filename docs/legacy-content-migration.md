# Legacy Portable Text Migration

The first migration phase is a read-only inventory of the Portable Text that
still depends on site-specific renderers. It does not connect to Cloudflare,
write to D1, or transform a backup.

## Create an Inventory

1. In the production EmDash admin, open **Settings -> Backups** and download a
   fresh backup.
2. Save the file under `.migration/`, which is ignored by Git. Backups contain
   content, drafts, trash, revisions, and media metadata. They do not contain
   media binaries, users, or secrets, but the content can still be private and
   should not be committed.
3. Run the human-readable audit:

   ```sh
   pnpm run audit:legacy-content -- --input .migration/emdash-backup-<date>.json
   ```

4. Save deterministic JSON when comparing runs or preparing a converter:

   ```sh
   pnpm run audit:legacy-content -- \
     --input .migration/emdash-backup-<date>.json \
     --json > .migration/legacy-content-inventory.json
   ```

The command accepts only EmDash backup format version 1 and writes only to
standard output. It discovers Portable Text fields from `_emdash_fields`
instead of keeping a second field list in application code.

## Inventory Scope

The audit checks:

- every content row, including published, draft, scheduled, and trashed rows;
- every historical value in the `revisions` table;
- nested blocks, including gallery images and content inside columns; and
- image references against the backup's `media` table.

Occurrences include collection and entry identifiers, field and block paths,
state, feature labels, provider hostnames, and blockers. They intentionally do
not include body text, captions, titles, or complete URLs.

Counts include every historical occurrence. A block that appears in the
current row and three revisions is counted four times; this is useful for
deciding whether revision history can still exercise a legacy renderer, but it
is not a count of unique logical blocks.

## Classifications

- `native` is already an EmDash block.
- `native-ready` can be represented by a standard EmDash block while retaining
  the behavior used by this site.
- `native-ready-after-media-normalization` also needs its image source converted
  to a standard `asset` reference.
- `blocked` has a behavior that the current standard block does not preserve,
  such as linked or shaped images, legacy gallery layout, an unsupported embed
  provider, or video editing/metadata.
- `site-specific` still performs application behavior rather than rendering
  static content.
- `content-transform-candidate` can be simplified by a content rewrite, but is
  not itself a standard custom block replacement.

The classifications are migration guidance, not an automatic approval to
remove code. Before deleting a renderer, the inventory must show that both
current content and revisions are compatible with the proposed replacement.

## Follow-up Migration Work

Keep later phases separate from this audit:

1. Capture and review a fresh production inventory.
2. Implement an idempotent, pure converter against backup fixtures, with
   explicit before/after summaries and no database access.
3. Add a dry-run command that reports the exact rows and fields it would
   change, then verify rendering and editing against the converted fixture.
4. Only then design an explicit production writer with a fresh backup,
   rollback instructions, and post-migration verification.
5. Remove renderers and editor plugins in independent commits after production
   content no longer needs them.

The live site uses Cloudflare Workers Free. Inventory and conversion work should
remain local, and an eventual writer should be a bounded one-off operation
rather than a migration performed in normal Worker requests. This avoids
spending request CPU on a corpus-wide transform and makes D1 write volume
reviewable before execution.
