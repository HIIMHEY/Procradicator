jest.mock('react-native-draglist', () => {
  const { View } = jest.requireActual('react-native');
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: <T,>({
      data,
      keyExtractor,
      renderItem,
      ListFooterComponent,
    }: {
      data: T[];
      keyExtractor: (item: T, index: number) => string;
      renderItem: (info: {
        item: T;
        index: number;
        onDragStart: () => void;
        onDragEnd: () => void;
        onStartDrag: () => void;
        onEndDrag: () => void;
        isActive: boolean;
        separators: Record<string, unknown>;
      }) => React.ReactElement;
      ListFooterComponent?: React.ComponentType | React.ReactElement;
    }) => (
      <View>
        {data.map((item, index) =>
          React.cloneElement(
            renderItem({
              item,
              index,
              onDragStart: jest.fn(),
              onDragEnd: jest.fn(),
              onStartDrag: jest.fn(),
              onEndDrag: jest.fn(),
              isActive: false,
              separators: {},
            }),
            { key: keyExtractor(item, index) },
          ),
        )}
        {typeof ListFooterComponent === 'function'
          ? React.createElement(ListFooterComponent)
          : ListFooterComponent}
      </View>
    ),
  };
});
