/**
 * Server-local TLS bridge for the lobby stack on the relay host: gives the
 * anchor and mock reporter a plain ws endpoint (127.0.0.1:17443) whose bytes
 * ride TLS to the local relay, validating the relay certificate against the
 * deployment CA. Needed because Bun's WebSocket client cannot validate a
 * private CA (no NODE_EXTRA_CA_CERTS, no tls.ca in options).
 */
import { readFileSync } from "node:fs";
import * as net from "node:net";
import * as tls from "node:tls";

const UPSTREAM_HOST = "poolab-13w3nczazpz1liai.inc.alipay.net"; // cert SAN; SNI name
const UPSTREAM_PORT = 8443;
const UPSTREAM_ADDR = process.env.UPSTREAM_ADDR ?? "127.0.0.1"; // dial loopback, validate via SNI
const LOCAL_PORT = Number(process.env.PORT ?? 17443);
const CA_PATH = process.env.CA_PEM ?? import.meta.dir + "/certs/ca.pem";

const ca = readFileSync(CA_PATH, "utf8");

const server = net.createServer(local => {
	const upstream = tls.connect(
		{ host: UPSTREAM_ADDR, port: UPSTREAM_PORT, servername: UPSTREAM_HOST, ca },
		() => console.log(`${new Date().toISOString()} tunnel open`),
	);
	const closeBoth = (): void => {
		local.destroy();
		upstream.destroy();
	};
	upstream.on("error", err => {
		console.error(`${new Date().toISOString()} upstream error: ${String(err)}`);
		closeBoth();
	});
	local.on("error", () => closeBoth());
	upstream.on("close", () => local.end());
	local.on("close", () => upstream.end());
	local.pipe(upstream);
	upstream.pipe(local);
});

server.listen(LOCAL_PORT, "127.0.0.1", () => {
	console.log(`lobby bridge: ws://127.0.0.1:${LOCAL_PORT} -> wss://${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});
