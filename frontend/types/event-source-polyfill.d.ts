declare module 'event-source-polyfill' {
  export class EventSourcePolyfill {
    constructor(url: string, options?: {
      headers?: Record<string, string>;
      withCredentials?: boolean;
      heartbeatTimeout?: number;
    });
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onopen: ((event: Event) => void) | null;
    addEventListener(type: string, listener: (event: MessageEvent) => void): void;
    removeEventListener(type: string, listener: (event: MessageEvent) => void): void;
    close(): void;
    readonly readyState: number;
    readonly url: string;
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSED: number;
  }
}
