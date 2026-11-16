# 4.45.1 — rejson-widgets cutover (source deletion NOT completed)

## Current operational state

- New authoritative game database: **rejson-widgets**, `hzbqzfimtroixnldzjeq`.
- The existing community identity, single-player cloud library, widgets, auth configuration, platform credentials and `rejfile` function are not replaced by the migration.
- Browser game URL **and matching public anon JWT**, account-world gateway, owner panel and operational reference/authorization scripts now use this project. Regression tests reject a partial URL/JWT cutover.
- Four game/reference Edge Functions deployed on the destination. The gateway still checks the community session; reference reader/archive still require GitHub OIDC. Archive writes remain locked (`budgetBytes: 0`). All four passed startup/unauthenticated request checks after inline deployment. The initial remote-import deployments failed startup and were replaced, not treated as success.
- Source **BlockCraft**, `bewwejewgqzctnjrbclu`, is **NOT deleted**. Its 13 application tables have statement-level INSERT/UPDATE/DELETE/TRUNCATE fences. A locked cutover transaction first verified there were no active player leases. The source gateway is a bounded compatibility proxy to the destination; it no longer writes its old database. This avoids split-brain while old cached pages remain open. Reloading loads the new direct endpoints.
- No local saves, account namespaces, profile checkpoints, journals, resume proofs or CAS rules are reset. No historical destructive migration was replayed.

## Copy verification actually completed

The successful job is `ba08e987-35ea-4de3-bccf-bb5f4b7251cc` in the private `mconline_migration.jobs` ledger on the destination.

| Table | Copied rows |
| --- | ---: |
| blockcraft_blocks | 2403 |
| blockcraft_blocks_backup_218 | 1563 |
| blockcraft_drops | 478 |
| blockcraft_players | 2 |
| blockcraft_plots | 0 |
| mconline_chest_imports | 0 |
| mconline_chest_operations | 36 |
| mconline_chests | 4 |
| mconline_members | 4 |
| mconline_messages | 238 |
| mconline_mob_hits | 0 |
| mconline_mob_regions | 12 |
| mconline_mob_viewers | 1 |

**4741 rows, 13/13 table hashes matched inside the destination restore transaction.** Each table SHA-256 is over sorted PostgreSQL `to_jsonb(row)::text` values joined by a newline. This includes the old backup table, inbox messages, chest operation receipts and all member rows, not just visible blocks.

The live schema was reconstructed from catalogs, not migration history: **20 SQL functions**, **3 sequences** (including the messages identity sequence), constraints, non-constraint indexes, RLS/policies, table/function/sequence grants and both player triggers. Restore explicitly revokes destination default public grants before applying source grants. Sequence positions were restored. Catalog discovery found all source owners were `postgres`, no column ACLs, custom views/types, relation options, cron extension, public publication members, auth users or Vault secrets to relocate. Independent post-copy schema/ACL equivalence testing is **not yet complete** (see below).

Private Storage bucket `mconline-reference-private` and its sole object `probes/roundtrip-v1.txt` were copied via the Storage API, not by inserting metadata. Object bytes were downloaded again and SHA-256 verified on the destination. The source object is 79 bytes; expected SHA-256 is `a46cc1a5248a3967c1b3ec5adccfcd83d86fdcc7fdeed200646d495b45c756b6`.

The destination's existing buckets and existing SQL objects were not dropped or recreated. A private before-image of the existing 73 public tables was taken; it is **not** a claim that a live shared database is frozen. A later check found concurrent changes to 10 existing community/rejchat tables (including account deletions), while the migration only created new, non-colliding game objects. Those changes were not blindly undone or attributed to this migration. The private `preservation_report` records counts without publishing account data. Any further integrity investigation must respect intentional concurrent deletions and must not restore stale account snapshots wholesale.

## Recovery copy and unfinished deletion gate

A complete application-schema/data export, source migration history and embedded Storage bytes were saved privately on the destination, independently of the source project:

- Bucket: `mconline-migration-private` (private, no public policy added).
- Object: `blockcraft/ba08e987-35ea-4de3-bccf-bb5f4b7251cc.json`.
- Size: **1,560,697 bytes**.
- SHA-256: `e2c578a5f4c355f16897098e036fe3144d515bbf0f498cc6d2723d4d2df7f0c2`.
- Upload followed by full readback/hash comparison: **PASS**.
- This is an independent copy from BlockCraft, **not an off-provider backup**, a full platform pg_dump, or an eternal durability guarantee. No private rows/tokens/keys are committed to Git or CI artifacts.

The first restore attempt failed atomically during JSON parameter binding; no partial application tables survived. Its earlier private export is retained too. The corrected copy transaction completed and its row hashes passed.

A separate restore rehearsal reached function verification but failed because the verifier incorrectly passed parameter names to `to_regprocedure`. It therefore rolled back; **do not claim that rehearsal passed**. A restricted helper `mconline_migration.check_snapshot(jsonb)` was created for a corrected rehearsal, but has **not been executed successfully**. The connector provider then blocked deployment of the corrected verification Edge code. The blocked call did not take effect and was **not rephrased or retried to evade the filter**.

Consequently the owner's conditional authorization to delete BlockCraft has **not yet been satisfied**. Before deletion:

1. Successfully rehearse restoration from the saved bytes without depending on the source; independently compare schema/function ACLs, policies, indexes, triggers and sequence state. Rolled-back tests can advance PostgreSQL sequences, so compare against the cutover receipt or a new fenced checkpoint appropriately, never reset a live sequence backwards.
2. Confirm public Storage denial and owner/OIDC authorized read on the destination, and run current rolled-back cloud/multiplayer/checkpoint/chest/mob/plot suites against the deployed target. Local SQL fixtures and anonymous HTTP checks alone are not a logged-in production multiplayer test.
3. Review live shared-target preservation, acknowledging independent concurrent changes; do not resurrect intentionally deleted accounts.
4. Confirm new frontend production deployment and green PR/main CI and Pages; then verify no operational dependencies on the source remain.
5. Only after these gates, delete **BlockCraft only**, then list projects to confirm the destination survives.

The temporary `mconline-project-migrate` Edge endpoint and `MCONLINE_MIGRATION_SOURCE_KEY` destination secret have been **deleted**. The private job/baseline/verification helper state is retained for audit/recovery; the schema denies PUBLIC/anon/authenticated/service_role access, and the helper has no public execute grant. Source export/guard helpers remain service-role-only behind the source write fence. No migration credentials were placed in browser code or GitHub secrets.

## Repository validation

- Four endpoint/key/secret/archive-lock regression groups in the default `npm test`.
- Existing typecheck, full headless/SQL-WASM suites and production build.
- Existing CI live authorization checks now exercise the unified target, including denied direct table/RPC access, invalid sessions, exact-origin CORS, reader/archive non-OIDC denial.
- See the PR/main Actions results for deployed HTTP status checks. These do not substitute for the unfinished deletion gates above.

Historical evidence documents and old SQL migration files intentionally retain their original source-project references. Do not replay resets `004`, `009` or `010` to recreate the migrated database.
