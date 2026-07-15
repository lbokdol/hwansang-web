// Minimal browser-global stubs so any transitive import that grazes the DOM at
// module-eval time doesn't crash the headless harness. The gameplay logic
// itself (Run + content) never touches these.
const g = globalThis as unknown as Record<string, unknown>;
g.window ??= g;
g.document ??= {
  createElement: () => ({ getContext: () => ({}), width: 0, height: 0, style: {} }),
  getElementById: () => null,
  addEventListener: () => {},
};
g.localStorage ??= {
  store: {} as Record<string, string>,
  getItem(k: string) {
    return (this.store as Record<string, string>)[k] ?? null;
  },
  setItem(k: string, v: string) {
    (this.store as Record<string, string>)[k] = v;
  },
  removeItem(k: string) {
    delete (this.store as Record<string, string>)[k];
  },
};
g.requestAnimationFrame ??= () => 0;
g.devicePixelRatio ??= 1;
