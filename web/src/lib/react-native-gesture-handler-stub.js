// Заглушка для react-native-gesture-handler
const React = require('react');

export const GestureHandlerRootView = ({ children, style }) => {
  return React.createElement('div', { style }, children);
};

export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

export const PanGestureHandler = ({ children, onGestureEvent, onHandlerStateChange }) => {
  return React.createElement('div', {}, children);
};

export const PinchGestureHandler = ({ children, onGestureEvent, onHandlerStateChange }) => {
  return React.createElement('div', {}, children);
};

export default {
  GestureHandlerRootView,
  State,
  PanGestureHandler,
  PinchGestureHandler,
};

