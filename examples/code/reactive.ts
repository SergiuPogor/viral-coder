type Listener<T> = (state: T) => void;
type Selector<T, S> = (state: T) => S;

function createStore<T extends object>(initialState: T) {
  let state = structuredClone(initialState);
  const listeners = new Set<Listener<T>>();

  const notify = () => listeners.forEach((fn) => fn(state));

  return {
    get: () => state,

    set: (partial: Partial<T>) => {
      state = { ...state, ...partial };
      notify();
    },

    update: (fn: (prev: T) => Partial<T>) => {
      state = { ...state, ...fn(state) };
      notify();
    },

    subscribe: (fn: Listener<T>) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    select: <S>(selector: Selector<T, S>, fn: (slice: S) => void) => {
      let prev = selector(state);
      return listeners.add((s) => {
        const next = selector(s);
        if (next !== prev) fn((prev = next));
      }), () => listeners.delete(fn as any);
    },

    reset: () => {
      state = structuredClone(initialState);
      notify();
    },
  };
}

const store = createStore({ count: 0, user: "anon" });

const unsub = store.subscribe((s) => console.log("State:", s));
store.select((s) => s.count, (c) => console.log("Count changed:", c));

store.set({ count: 1 });
store.update((s) => ({ count: s.count + 1 }));
store.set({ user: "sergio" });
store.reset();
unsub();
