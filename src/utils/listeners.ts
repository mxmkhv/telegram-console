/** Callbacks for one kind of event: subscribe returns the unsubscribe */
export function createListeners<Args extends unknown[]>() {
  const callbacks = new Set<(...args: Args) => void>();
  return {
    emit(...args: Args) {
      callbacks.forEach((cb) => cb(...args));
    },
    subscribe(callback: (...args: Args) => void): () => void {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  };
}
