const React = require('react');

const SafeAreaView = ({ children, style }) => React.createElement(React.Fragment, null, children);
const SafeAreaProvider = ({ children }) => React.createElement(React.Fragment, null, children);
const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });
const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

module.exports = {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
  useSafeAreaFrame,
  initialWindowMetrics,
};
