import { createServer } from "node:net";

/**
 * Lighthouse does not drive the `Browser` object playwright hands back. It
 * attaches over the DevTools protocol to a TCP port, and Chromium only opens
 * that port if `--remote-debugging-port` was passed **at launch** — it cannot be
 * turned on afterwards. So the port has to be chosen before the browser starts
 * and then carried alongside it to whoever runs Lighthouse.
 *
 * Picking a fixed port would make two concurrent audits fight over it, and the
 * loser fails silently: `runLighthouse` cannot connect, all four
 * Lighthouse-derived checks record as `unavailable`, and `scoreSite` —
 * correctly — computes neglect over the checks that did return a verdict. The
 * result is a plausible-looking neglect score measured over a third fewer
 * checks, with nothing thrown and nothing logged.
 *
 * Asking the OS for port 0 is what removes the clash: it hands back a port no
 * one else holds.
 */

/** An ephemeral port for Chromium's CDP endpoint, so parallel runs cannot clash. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Could not determine a free port.")));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}
