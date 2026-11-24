export function signingGradleBlock() {
  return `
// >>> leanote:release-signing (managed by scripts/release.mjs)
def leanoteKeystoreProperties = new java.util.Properties()
def leanoteKeystoreFile = rootProject.file("keystore.properties")
if (leanoteKeystoreFile.exists()) {
    leanoteKeystoreFile.withInputStream { stream -> leanoteKeystoreProperties.load(stream) }
}
android {
    signingConfigs {
        release {
            storeFile new java.io.File(leanoteKeystoreProperties["storeFile"])
            storePassword leanoteKeystoreProperties["storePassword"]
            keyAlias leanoteKeystoreProperties["keyAlias"]
            keyPassword leanoteKeystoreProperties["keyPassword"]
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
// <<< leanote:release-signing
`;
}

export function patchAndroidGradle(text, { version, buildNumber, signingBlock = '' }) {
  let out = String(text);
  out = out.replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`);
  out = out.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
  out = out.replace(/\n?\/\/ >>> leanote:release-signing[\s\S]*?\/\/ <<< leanote:release-signing\n?/g, '\n');
  out = out.replace(/\n+$/, '\n');
  if (signingBlock) out += signingBlock;
  return out;
}

const ATS = `\t<key>NSAppTransportSecurity</key>
\t<dict>
\t\t<key>NSAllowsArbitraryLoadsInWebContent</key>
\t\t<true/>
\t\t<key>NSAllowsLocalNetworking</key>
\t\t<true/>
\t</dict>
`;

export function patchIosPlist(text, { version, buildNumber }) {
  let out = String(text);
  out = out.replace(/(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${version}$2`);
  out = out.replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${buildNumber}$2`);
  if (!out.includes('<key>NSAppTransportSecurity</key>')) {
    const i = out.lastIndexOf('</dict>');
    if (i > 0) out = out.slice(0, i) + ATS + out.slice(i);
  }
  return out;
}

export function patchIosPbx(text, { version, buildNumber }) {
  let out = String(text);
  out = out.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
  out = out.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
  return out;
}
