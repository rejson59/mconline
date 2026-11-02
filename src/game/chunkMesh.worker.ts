import {
  meshSnapshot,
  replyTransfers,
  type MeshSnapshot,
} from "./meshProtocol";

// A single bounded job at a time. No renderer, storage, network or game ticks.
const scope = self as unknown as {
  onmessage: (
    event: MessageEvent<{ id: number; snapshot: MeshSnapshot }>,
  ) => void;
  postMessage: (message: unknown, transfer?: ArrayBuffer[]) => void;
};
scope.onmessage = ({ data }) => {
  try {
    const reply = meshSnapshot(data.snapshot, data.id);
    scope.postMessage(reply, replyTransfers(reply));
  } catch {
    scope.postMessage({ id: data.id, error: true });
  }
};
