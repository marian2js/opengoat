import net from "node:net";

const DEFAULT_PREFERRED_PORT = 19288;

async function checkPortAvailable(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.listen(port, "127.0.0.1", () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

async function reserveFreeLoopbackPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to reserve a free loopback port."));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

export async function pickGatewayPort(
  preferredPort = DEFAULT_PREFERRED_PORT,
): Promise<number> {
  if (await checkPortAvailable(preferredPort)) {
    return preferredPort;
  }

  return await reserveFreeLoopbackPort();
}
