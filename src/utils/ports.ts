import net from "net";

export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findAvailablePort(
  preferredPort: number,
  reservedPorts: Set<number>,
  checkAvailability: (port: number) => Promise<boolean> = isPortAvailable,
): Promise<number> {
  for (let port = preferredPort; port <= 65535; port += 1) {
    if (!reservedPorts.has(port) && (await checkAvailability(port)))
      return port;
  }

  throw new Error(`No available host port found at or above ${preferredPort}.`);
}
