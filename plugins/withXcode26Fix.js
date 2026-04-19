/**
 * Config plugin that patches expo-dev-menu for Xcode 26 compatibility.
 * TARGET_IPHONE_SIMULATOR was removed in Xcode 26 (iOS 26).
 * This adds a CocoaPods post_install hook to fix the Swift file after pod install.
 */

const { withDangerousMods } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POST_INSTALL = `

# ── Xcode 26 compatibility fix ────────────────────────────────────────────────
# TARGET_IPHONE_SIMULATOR was removed in Xcode 26. Patch expo-dev-menu.
post_install do |installer|
  swift_file = "#{installer.sandbox.root}/expo-dev-menu/ios/DevMenuViewController.swift"
  if File.exist?(swift_file)
    content = File.read(swift_file)
    patched = content.gsub(
      'let isSimulator = TARGET_IPHONE_SIMULATOR > 0',
      'let isSimulator = ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] != nil'
    )
    if patched != content
      File.write(swift_file, patched)
      puts "\\n  ✓ Patched expo-dev-menu for Xcode 26\\n"
    end
  end
end
`;

module.exports = function withXcode26Fix(config) {
  return withDangerousMods(config, [
    [
      'ios',
      (modConfig) => {
        const podfilePath = path.join(
          modConfig.modRequest.platformProjectRoot,
          'Podfile'
        );
        if (fs.existsSync(podfilePath)) {
          let content = fs.readFileSync(podfilePath, 'utf-8');
          if (!content.includes('Xcode 26 compatibility fix')) {
            fs.writeFileSync(podfilePath, content + POST_INSTALL);
          }
        }
        return modConfig;
      },
    ],
  ]);
};
