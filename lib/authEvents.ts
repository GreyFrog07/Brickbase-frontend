type Listener = () => void;

const listeners: Listener[] = [];

export const authEvents = {
  onSessionExpired(listener: Listener) {
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  },

  emitSessionExpired() {
    listeners.forEach((fn) => fn());
  },
};
