/** Disk adapter for the chunk protocol. No cloud credentials or game execution. */
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PART_BYTES, TransferError } from "./reference-transfer-core.mjs";
export * from "./reference-transfer-core.mjs";
const HEADER_BYTES = 1024;
const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
function check(ok, reason) {
  if (!ok) throw new TransferError(reason);
}
function binary(value) {
  check(value instanceof Uint8Array, "non-binary-data");
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}
/** Private-cache disk adapter. Local durable files only, NOT cloud backup or an HTTP API. */
export async function directoryStore(directory) {
  const root = path.resolve(directory);
  check(
    root.startsWith(path.join(ROOT, ".cache") + path.sep),
    "store-must-be-in-ignored-cache",
  );
  check((await fs.realpath(ROOT)) === ROOT, "noncanonical-repository-root");
  async function parentFor(filename, create) {
    let dir = ROOT;
    for (const part of path
      .relative(ROOT, path.dirname(filename))
      .split(path.sep)) {
      dir = path.join(dir, part);
      if (create) {
        try {
          await fs.mkdir(dir, { mode: 0o700 });
        } catch (e) {
          if (e.code !== "EEXIST") throw e;
        }
      }
      const st = await fs.lstat(dir);
      check(st.isDirectory() && !st.isSymbolicLink(), "unsafe-store-directory");
    }
  }
  function filename(key) {
    check(
      typeof key === "string" &&
        /^archive-parts\/v1\/[a-f0-9]{64}\/[a-f0-9]{32}\/[a-f0-9]{40}\/[1-9][0-9]{0,6}\/(parts\/[0-9]{6}\.bin|complete\.json)$/.test(
          key,
        ),
      "invalid-store-key",
    );
    return path.join(root, key);
  }
  return Object.freeze({
    async read(key, limit) {
      check(
        Number.isSafeInteger(limit) &&
          limit >= 0 &&
          limit <= PART_BYTES + HEADER_BYTES + 8,
        "invalid-read-limit",
      );
      const file = filename(key);
      let handle;
      try {
        await parentFor(file, false);
        const initial = await fs.lstat(file);
        check(
          initial.isFile() &&
            !initial.isSymbolicLink() &&
            initial.size <= limit,
          "invalid-store-file",
        );
        handle = await fs.open(
          file,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        const before = await handle.stat();
        check(
          before.isFile() &&
            before.ino === initial.ino &&
            before.dev === initial.dev &&
            before.size <= limit,
          "store-file-changed",
        );
        const data = Buffer.alloc(before.size + 1);
        let count = 0;
        while (count < data.length) {
          const { bytesRead } = await handle.read(
            data,
            count,
            data.length - count,
            count,
          );
          if (!bytesRead) break;
          count += bytesRead;
        }
        const after = await handle.stat();
        check(
          count === before.size &&
            after.size === before.size &&
            after.mtimeMs === before.mtimeMs,
          "store-file-changed",
        );
        return data.subarray(0, count);
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      } finally {
        await handle?.close();
      }
    },
    async create(key, value) {
      const data = binary(value);
      check(
        data.length <= PART_BYTES + HEADER_BYTES + 8,
        "stored-record-exceeds-limit",
      );
      const file = filename(key);
      await parentFor(file, true);
      // No overwrite. A fully fsynced work file is linked atomically into its final name.
      // Only this invocation's scratch link is removed; accepted archive objects are never deleted.
      const scratch = `${file}.${randomBytes(16).toString("hex")}.work`;
      let handle,
        ownsScratch = false;
      try {
        handle = await fs.open(
          scratch,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            constants.O_NOFOLLOW,
          0o600,
        );
        ownsScratch = true;
        await handle.writeFile(data);
        await handle.sync();
        await handle.close();
        handle = null;
        try {
          await fs.link(scratch, file);
        } catch (e) {
          if (e.code === "EEXIST") return false;
          throw e;
        }
        const parent = await fs.open(
          path.dirname(file),
          constants.O_RDONLY | constants.O_DIRECTORY,
        );
        try {
          await parent.sync();
        } finally {
          await parent.close();
        }
        return true;
      } finally {
        await handle?.close();
        if (ownsScratch)
          await fs.unlink(scratch).catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
      }
    },
  });
}
