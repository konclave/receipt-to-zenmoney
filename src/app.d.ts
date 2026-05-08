// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

declare module '@vercel/kv' {
  export const kv: {
    set: (key: string, value: unknown, options?: { ex?: number }) => Promise<unknown>;
    get: <T>(key: string) => Promise<T | null>;
    del: (key: string) => Promise<unknown>;
  };
}

export {};
