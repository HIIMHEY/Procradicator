jest.mock('@tanstack/devtools-event-client', () => {
  class EventClient {
    getPluginId() {
      return 'form-devtools';
    }

    createEventPayload(eventSuffix: string, payload: unknown) {
      return {
        type: eventSuffix,
        payload,
        pluginId: 'form-devtools',
      };
    }

    emit() {}

    on() {
      return () => {};
    }

    onAll() {
      return () => {};
    }

    onAllPluginEvents() {
      return () => {};
    }
  }

  return { EventClient };
});
