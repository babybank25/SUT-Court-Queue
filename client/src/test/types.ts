import { vi } from 'vitest';

declare global {
  var io: any;
  var localStorage: Storage;
  var fetch: typeof global.fetch;
  
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

export {};