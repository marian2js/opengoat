import { Writable } from "node:stream";

export interface StreamCapture {
  stream: NodeJS.WritableStream;
  output(): string;
}

export function createStreamCapture(): StreamCapture {
  let buffer = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      buffer += chunk.toString();
      callback();
    }
  });

  return {
    stream,
    output: () => buffer
  };
}
