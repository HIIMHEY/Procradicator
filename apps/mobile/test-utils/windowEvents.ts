export function stubWindowEvents() {
  const methods = ['addEventListener', 'removeEventListener', 'dispatchEvent'] as const;
  const originalDescriptors = new Map(
    methods.map((method) => [method, Object.getOwnPropertyDescriptor(window, method)]),
  );
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
  return () => {
    for (const method of methods) {
      const descriptor = originalDescriptors.get(method);
      if (descriptor) {
        Object.defineProperty(window, method, descriptor);
      } else {
        Reflect.deleteProperty(window, method);
      }
    }
  };
}
