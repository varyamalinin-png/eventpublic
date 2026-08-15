// web stub for expo-image — uses standard img tag
const React = require('react');

function Image({ source, style, contentFit, ...props }) {
  const uri = typeof source === 'string' ? source : source?.uri;
  if (!uri) return null;
  return React.createElement('img', {
    src: uri,
    style: { objectFit: contentFit || 'cover', ...style },
    ...props,
  });
}

module.exports = { Image };
