const React = require('react');
const { View } = require('react-native');

const LineChart = () => React.createElement(View, { testID: 'line-chart' });
const BarChart = () => React.createElement(View, { testID: 'bar-chart' });
const PieChart = () => React.createElement(View, { testID: 'pie-chart' });

module.exports = { LineChart, BarChart, PieChart };
