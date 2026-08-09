export function stubWindowEvents() {
  const browserEvents = new EventTarget();
  Object.defineProperties(window, {
    addEventListener: {
      configurable: true,
      value: browserEvents.addEventListener.bind(browserEvents),
    },
    removeEventListener: {
      configurable: true,
      value: browserEvents.removeEventListener.bind(browserEvents),
    },
    dispatchEvent: {
      configurable: true,
      value: browserEvents.dispatchEvent.bind(browserEvents),
    },
  });
  return browserEvents;
}
