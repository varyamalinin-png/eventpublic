import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    // Создаем окно и запускаем React Native
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // В DEBUG режиме приоритет: Metro bundler (локальный или на VM)
    // Это позволяет работать как в Expo - с горячей перезагрузкой
    
    // 1. Сначала пытаемся подключиться к локальному Metro bundler (localhost)
    if let localBundleURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry") {
      print("🔗 [AppDelegate] DEBUG: Подключаемся к локальному Metro bundler")
      return localBundleURL
    }
    
    // 2. Если локальный Metro недоступен, пытаемся VM (для удаленной разработки)
    let vmIP = "158.160.67.4"
    let metroPort = 8081
    if let vmBundleURL = URL(string: "http://\(vmIP):\(metroPort)/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false") {
      print("🔗 [AppDelegate] DEBUG: Подключаемся к Metro на VM: \(vmBundleURL.absoluteString)")
      return vmBundleURL
    }
    
    // 3. Fallback: встроенный bundle (только если Metro недоступен)
    if let embeddedBundle = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      print("⚠️ [AppDelegate] DEBUG: Metro недоступен, используем встроенный bundle")
      return embeddedBundle
    }
    
    print("❌ [AppDelegate] DEBUG: Не удалось найти источник кода!")
    return nil
#else
    // В RELEASE режиме всегда используем встроенный bundle
    if let bundleURL = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      print("✅ [AppDelegate] Release: Используем встроенный bundle")
      return bundleURL
    }
    
    // Если bundle не найден, пытаемся найти в стандартных местах
    if let bundleURL = Bundle.main.url(forResource: "index", withExtension: "jsbundle") {
      return bundleURL
    }
    
    print("⚠️ [AppDelegate] Release: Bundle не найден!")
    return nil
#endif
  }
}
