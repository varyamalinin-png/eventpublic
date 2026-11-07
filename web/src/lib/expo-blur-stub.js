const React = require('react');
const { View } = require('react-native');

// expo-blur на вебе: настоящий нативный BlurView недоступен, а наш
// GuestBlurredValue на вебе и так рисует CSS-blur и BlurView не вызывает.
// Стаб нужен, чтобы сборка не зависела от client/node_modules — иначе
// на прод-VM (там только web/node_modules) билд падал на резолве модуля.
function BlurView({ children, style, intensity, tint, ...props }) {
  const alpha = Math.min(0.85, 0.35 + ((intensity || 50) / 100) * 0.5);
  const bg = tint === 'light'
    ? `rgba(255,255,255,${alpha})`
    : `rgba(10,10,12,${alpha})`;
  return React.createElement(View, {
    style: [style, { backgroundColor: bg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }],
    ...props,
  }, children);
}
module.exports = { BlurView };
