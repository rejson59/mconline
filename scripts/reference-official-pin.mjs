/** Pinned official metadata contract, shared by CLI and server; no I/O. */
export const PIN = Object.freeze({
  version: "26.3",
  manifestSHA1: "80608ff6753705b6a82e2cb86a5937d4d233abd4",
  manifestURL:
    "https://piston-meta.mojang.com/v1/packages/80608ff6753705b6a82e2cb86a5937d4d233abd4/26.3.json",
  clientSHA1: "e877b6a07acd633fb3bb475002175cec036e7b87",
  clientBytes: 41483720,
  storageURL: "https://bewwejewgqzctnjrbclu.supabase.co/storage/v1/status",
});
export function validateManifest(manifest, pin = PIN) {
  if (manifest.id !== pin.version || manifest.type !== "release")
    throw new Error("Unexpected reference version");
  const client = manifest.downloads?.client;
  if (
    client?.sha1 !== pin.clientSHA1 ||
    client?.size !== pin.clientBytes ||
    client?.url !==
      `https://piston-data.mojang.com/v1/objects/${pin.clientSHA1}/client.jar`
  )
    throw new Error("Unexpected client download");
  const index = manifest.assetIndex;
  if (
    !index ||
    !/^[a-f0-9]{40}$/.test(index.sha1) ||
    !Number.isSafeInteger(index.size) ||
    index.size < 1 ||
    index.size > 2 * 1024 * 1024 ||
    index.url !==
      `https://piston-meta.mojang.com/v1/packages/${index.sha1}/${index.id}.json`
  )
    throw new Error("Unexpected asset index");
  return { client, index };
}
