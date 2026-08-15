// Заглушка для react-native-webview на вебе (map.web использует import { WebView })
function WebView(props) {
  return null; // На вебе карта рисуется через iframe в map.web, не через WebView
}
export { WebView };
export default WebView;

