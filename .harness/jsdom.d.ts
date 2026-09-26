/**
 * Minimal ambient types for the optional jsdom dependency.
 *
 * jsdom ships no type definitions and is installed with `npm i --no-save jsdom`
 * only when you want the interactive UI test. Declaring the module here keeps
 * `npm run typecheck` green in both cases (installed or not).
 */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: {
      url?: string;
      pretendToBeVisual?: boolean;
      runScripts?: 'outside-only' | 'dangerously';
    });
    window: Window & typeof globalThis;
    readonly document: Document;
  }
}
