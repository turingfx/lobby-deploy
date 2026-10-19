/**
 * Demo anchor: the dumb persistent host of the lobby "directory" room.
 *
 * Holds the room open on the local relay and re-broadcasts every sealed
 * report it receives from a reporter guest to ALL guests. In relay topology
 * the host broadcasts by sending a peerId-0 envelope on its own host socket;
 * the relay fans that out to every connected guest (lobby pages included).
 * Content stays sealed — this process never sees plaintext.
 */
const RELAY = process.env.RELAY_WS ?? "ws://localhost:7466";
const ROOM = "lobby-directory-01";

const host = new WebSocket(`${RELAY}/r/${ROOM}?role=host`);
host.binaryType = "arraybuffer";
host.onopen = () => console.log(`anchor: hosting directory room ${ROOM} (broadcasts via peerId-0 envelopes)`);
host.onmessage = ev => {
	if (typeof ev.data === "string") return; // peer-joined/peer-left control
	// Guest frames arrive as [4B senderPeer][sealed payload]; rewrite the
	// prefix to 0 so the relay treats this as a broadcast to every guest.
	const frame = Buffer.from(ev.data);
	if (frame.byteLength < 4) return;
	new DataView(frame.buffer, frame.byteOffset, 4).setUint32(0, 0, false);
	host.send(frame);
	console.log(`anchor: rebroadcast ${frame.byteLength}B report`);
};
host.onclose = ev => {
	console.error(`anchor: directory room closed (${ev.code} ${ev.reason}); exiting`);
	process.exit(1);
};
