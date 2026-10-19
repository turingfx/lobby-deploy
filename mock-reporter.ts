/**
 * Demo-only mock reporter: simulates a second team member ("jiaqi") so the
 * per-person lobby can be evaluated without a second machine. Publishes
 * plausible metadata into the directory room with the same sealed shape as
 * reporter.ts; the working/idle badge flips on a 24s cycle to make the board
 * feel live. No real rooms back these entries (no view links).
 */
import { importRoomKey, sealSerialized } from "/home/admin/oh-my-pi/packages/coding-agent/src/collab/crypto";
import { packEnvelope } from "/home/admin/oh-my-pi/packages/coding-agent/src/collab/protocol";


const TEAM_KEY_B64URL = "58moMHwvnco7uLMVasyIV7W4GYyL8qXB9OAb7rnWhM0";
const RELAY = "ws://localhost:7466";
const ROOM = "lobby-directory-01";
const USER = process.env.LOBBY_USER ?? "jiaqi";

const key = await importRoomKey(Buffer.from(TEAM_KEY_B64URL, "base64url"));
const { promise: open, resolve: opened } = Promise.withResolvers<void>();
const guest = new WebSocket(`${RELAY}/r/${ROOM}?role=guest`);
guest.onopen = () => {
	console.log(`mock-reporter: connected as ${USER}`);
	opened();
};
guest.onclose = ev => {
	console.error(`mock-reporter: closed (${ev.code}); exiting`);
	process.exit(1);
};
guest.onmessage = () => {};
await open;

const sessions = [
	{
		instanceId: "jiaqi-mock-1",
		sessionId: "jiaqi-mock-session-1",
		name: "排查支付回调偶发超时",
		cwd: "/home/jiaqi/payment-gateway",
		model: "zhipu-coding-plan/glm-5.3",
		busy: true,
		participants: 2,
		startedAt: Date.now() - 42 * 60_000,
		relayConnected: true,
		viewLink: "",
	},
	{
		instanceId: "jiaqi-mock-2",
		sessionId: "jiaqi-mock-session-2",
		name: "给订单服务补集成测试",
		cwd: "/home/jiaqi/order-service",
		model: "crs/gpt-6.1-sol",
		busy: false,
		participants: 1,
		startedAt: Date.now() - 10 * 60_000,
		relayConnected: true,
		viewLink: "",
	},
];

let tick = 0;
while (true) {
	sessions[0].busy = tick % 2 === 0;
	tick++;
	const frame = JSON.stringify({ v: 1, user: USER, ts: Date.now(), sessions });
	guest.send(packEnvelope(0, await sealSerialized(key, frame)));
	console.log(`mock-reporter: pushed as ${USER} (busy=${sessions[0].busy})`);
	await Bun.sleep(5_000);
}
