const React = require('react');
const { View } = require('react-native');

// Renders through RNW's View (not a raw <div>) so RN-only style shorthands
// used by callers (justifyContent without display:flex, paddingHorizontal,
// etc.) get resolved the same way a real native LinearGradient view would.
function LinearGradient({ children, style, colors, ...props }) {
  const bg = colors && colors.length >= 2
    ? `linear-gradient(to bottom, ${colors.join(', ')})`
    : 'transparent';
  return React.createElement(View, { style: [style, { backgroundImage: bg }], ...props }, children);
}
module.exports = { LinearGradient };
