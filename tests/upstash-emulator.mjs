// Minimal local stand-in for the Upstash Redis REST API, covering only the
// commands Cortana uses. For tests and local runs; never for real data.
//   node tests/upstash-emulator.mjs [port]   (defaults to 8079)
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export function startUpstashEmulator({
  port = 0,
  token = "local-test-token",
} = {}) {
  const data = new Map();
  const stats = { writes: 0 };
  const live = (key) => {
    const entry = data.get(key);
    if (entry?.expires != null && entry.expires <= Date.now()) {
      data.delete(key);
      return undefined;
    }
    return entry;
  };
  function run([name, ...args]) {
    switch (String(name).toUpperCase()) {
      case "PING":
        return "PONG";
      case "GET":
        return live(args[0])?.value ?? null;
      case "SET": {
        const [key, value, ...options] = args;
        let onlyIfAbsent = false,
          expires = null;
        for (let i = 0; i < options.length; i++) {
          const option = String(options[i]).toUpperCase();
          if (option === "NX") onlyIfAbsent = true;
          else if (option === "PX") expires = Date.now() + Number(options[++i]);
          else if (option === "EX")
            expires = Date.now() + Number(options[++i]) * 1000;
          else throw new Error(`ERR unsupported SET option ${option}`);
        }
        if (onlyIfAbsent && live(key)) return null;
        data.set(key, { value: String(value), expires });
        stats.writes++;
        return "OK";
      }
      case "DEL":
        return args.filter((key) => live(key) && data.delete(key)).length;
      case "INCR": {
        const entry = live(args[0]);
        const count = Number(entry?.value ?? 0) + 1;
        if (!Number.isInteger(count))
          throw new Error("ERR value is not an integer or out of range");
        data.set(args[0], {
          value: String(count),
          expires: entry?.expires ?? null,
        });
        return count;
      }
      default:
        throw new Error(`ERR unsupported command ${name}`);
    }
  }
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const reply = (status, payload) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    if (request.headers.authorization !== `Bearer ${token}`)
      return reply(401, { error: "Unauthorized" });
    const base64 = request.headers["upstash-encoding"] === "base64";
    const execute = (command) => {
      try {
        const result = run(command);
        return {
          result:
            base64 && typeof result === "string"
              ? Buffer.from(result).toString("base64")
              : result,
        };
      } catch (error) {
        return { error: error.message };
      }
    };
    try {
      const parsed = JSON.parse(body);
      if (request.url === "/pipeline") return reply(200, parsed.map(execute));
      const result = execute(parsed);
      reply(result.error ? 400 : 200, result);
    } catch {
      reply(400, { error: "ERR invalid request" });
    }
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        token,
        data,
        stats,
        close: () => new Promise((done) => server.close(done)),
      }),
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const emulator = await startUpstashEmulator({
    port: Number(process.argv[2] || 8079),
  });
  console.log(
    `Local Upstash stand-in ready.\nKV_REST_API_URL=${emulator.url}\nKV_REST_API_TOKEN=${emulator.token}`,
  );
}
