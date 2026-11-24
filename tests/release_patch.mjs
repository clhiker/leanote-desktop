import assert from 'node:assert/strict';
import {
    patchAndroidGradle,
    patchIosPlist,
    patchIosPbx,
    signingGradleBlock,
} from '../scripts/release-lib.mjs';

const gradle = `
android {
    defaultConfig {
        applicationId "com.leanote.mobile"
        versionCode 1
        versionName "1.0"
    }
}
`;

const signed = patchAndroidGradle(gradle, { version: '2.3.4', buildNumber: 99, signingBlock: signingGradleBlock() });
assert.match(signed, /versionCode 99/);
assert.match(signed, /versionName "2\.3\.4"/);
assert.match(signed, /leanote:release-signing/);
assert.match(signed, /signingConfig signingConfigs\.release/);

const again = patchAndroidGradle(signed, { version: '2.3.4', buildNumber: 99, signingBlock: signingGradleBlock() });
assert.equal(again, signed, 'android patch must be idempotent');
assert.equal((again.match(/leanote:release-signing \(managed/g) || []).length, 1);

const unsigned = patchAndroidGradle(signed, { version: '2.3.4', buildNumber: 99, signingBlock: '' });
assert.doesNotMatch(unsigned, /leanote:release-signing/);
assert.match(unsigned, /versionCode 99/);

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
\t<key>CFBundleShortVersionString</key>
\t<string>1.0</string>
\t<key>CFBundleVersion</key>
\t<string>1</string>
</dict>
</plist>
`;
const patched = patchIosPlist(plist, { version: '2.3.4', buildNumber: 99 });
assert.match(patched, /<string>2\.3\.4<\/string>/);
assert.match(patched, /<string>99<\/string>/);
assert.match(patched, /NSAllowsArbitraryLoadsInWebContent/);
assert.equal(patchIosPlist(patched, { version: '2.3.4', buildNumber: 99 }), patched);
assert.equal((patched.match(/NSAppTransportSecurity/g) || []).length, 1);

const pbx = `
MARKETING_VERSION = 1.0;
CURRENT_PROJECT_VERSION = 1;
MARKETING_VERSION = 1.0;
`;
const patchedPbx = patchIosPbx(pbx, { version: '2.3.4', buildNumber: 99 });
assert.equal((patchedPbx.match(/MARKETING_VERSION = 2\.3\.4;/g) || []).length, 2);
assert.match(patchedPbx, /CURRENT_PROJECT_VERSION = 99;/);

console.log('OK release patch helpers');
