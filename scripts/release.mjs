#!/usr/bin/env node
/* Cross-platform release orchestrator. No third-party runtime dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  patchAndroidGradle,
  patchIosPlist,
  patchIosPbx,
  signingGradleBlock,
} from './release-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const HOST = process.platform;
const NPX = HOST === 'win32' ? 'npx.cmd' : 'npx';
const DIST_ROOT = path.join(ROOT, 'dist');
const APP_ID = 'com.leanote.mobile';

// 镜像仅在显式设置时生效；默认走官方源以便复用本地 Electron 缓存
process.env.electron_config_cache = process.env.electron_config_cache || path.join(os.homedir(), '.cache/electron');

const argv = process.argv.slice(2);
const opts = {
  dryRun: false,
  strict: false,
  force: false,
  noChecksums: false,
  verbose: false,
  native: false,
  cleanAll: false,
  buildNumber: '',
  version: '',
  targets: '',
  positional: [],
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--strict') opts.strict = true;
  else if (a === '--force') opts.force = true;
  else if (a === '--no-checksums') opts.noChecksums = true;
  else if (a === '--verbose') opts.verbose = true;
  else if (a === '--native') opts.native = true;
  else if (a === '--all') opts.cleanAll = true;
  else if (a === '--build-number') opts.buildNumber = argv[++i] || '';
  else if (a.startsWith('--build-number=')) opts.buildNumber = a.slice(15);
  else if (a === '--version') opts.version = argv[++i] || '';
  else if (a.startsWith('--version=')) opts.version = a.slice(10);
  else if (a === '--targets') opts.targets = argv[++i] || '';
  else if (a.startsWith('--targets=')) opts.targets = a.slice(10);
  else if (a === '-h' || a === '--help') opts.positional.push('help');
  else if (a.startsWith('-')) die(`unknown option: ${a}`);
  else opts.positional.push(a);
}

const command = opts.positional[0] || 'help';
const VERSION = opts.version || process.env.VERSION || pkg.version;
const BUILD_NUMBER = opts.buildNumber || process.env.BUILD_NUMBER || gitCount() || '1';
const VERSION_DIR = path.join(DIST_ROOT, VERSION);
const results = [];
let anySkipped = false;

if (!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(VERSION)) die(`invalid version: ${VERSION}`);
if (!/^[0-9]+$/.test(BUILD_NUMBER)) die(`invalid build number: ${BUILD_NUMBER}`);

function log(...a) { console.log(...a); }
function section(t) { console.log(`\n== ${t} ==`); }
function warn(t) { console.warn(`WARN: ${t}`); }
function die(t, code = 2) { console.error(`ERROR: ${t}`); process.exit(code); }
function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }
function exists(p) { return fs.existsSync(p); }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function readJson(p, fallback = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function mkdir(p) { if (!opts.dryRun) fs.mkdirSync(p, { recursive: true }); }
function writeFile(p, data) { if (!opts.dryRun) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); } }
function hasCommand(cmd) {
  if (HOST === 'win32') return spawnSync('where', [cmd], { stdio: 'ignore' }).status === 0;
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}
function capture(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim(), status: r.status };
}
function run(cmd, args, options = {}) {
  const cwd = options.cwd || ROOT;
  if (opts.dryRun) { log(`DRY  ${rel(cwd)}$ ${cmd} ${args.join(' ')}`); return; }
  if (opts.verbose) log(`RUN  ${rel(cwd)}$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`);
}
function gitCount() {
  const r = capture('git', ['rev-list', '--count', 'HEAD']);
  return r.ok ? r.out.trim() : '';
}
function gitInfo() {
  const commit = capture('git', ['rev-parse', '--short', 'HEAD']);
  const dirty = capture('git', ['status', '--porcelain']);
  return { commit: commit.ok ? commit.out : '', dirty: dirty.ok ? dirty.out.length > 0 : false };
}
function javaMajor() {
  if (!hasCommand('java')) return 0;
  const r = capture('java', ['-version']);
  const m = /version "(\d+)/.exec(r.out);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n === 1 ? 8 : n;
}
function findAndroidSdk() {
  const candidates = [process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME];
  if (HOST === 'darwin') candidates.push(path.join(os.homedir(), 'Library/Android/sdk'));
  candidates.push(path.join(os.homedir(), 'Android/Sdk'));
  for (const p of candidates) if (p && isDir(p)) return p;
  return '';
}
function findXcode() {
  if (HOST !== 'darwin' || !hasCommand('xcodebuild')) return '';
  const r = capture('xcodebuild', ['-version']);
  return r.ok ? r.out.split('\n')[0] : '';
}
function certVersion(name) {
  return readJson(path.join(ROOT, 'node_modules', name, 'package.json'), {})?.version || '';
}
function notarizeEnabled() {
  if (process.env.NO_NOTARIZE === '1') return false;
  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) return true;
  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) return true;
  return !!process.env.APPLE_KEYCHAIN_PROFILE;
}
function androidSigning() {
  return !!(process.env.ANDROID_KEYSTORE_PATH && process.env.ANDROID_KEYSTORE_PASSWORD &&
    process.env.ANDROID_KEY_ALIAS && process.env.ANDROID_KEY_PASSWORD);
}
function iosSigning() {
  return !!(process.env.IOS_TEAM_ID && (process.env.IOS_SIGNING_IDENTITY || process.env.IOS_PROVISIONING_PROFILE));
}
function mark(name, status, reason = '', output = '', degraded = false) {
  results.push({ name, status, reason, output, degraded });
  if (status === 'skipped') anySkipped = true;
}
function outDir(target) { return path.join(VERSION_DIR, target); }
function ensureOut(dir) {
  if (exists(dir) && fs.readdirSync(dir).length && !opts.force) {
    die(`output dir not empty: ${rel(dir)} (use --force to merge)`);
  }
  mkdir(dir);
}
function targetPlan(target) {
  if (target === 'linux') {
    if (HOST !== 'linux') return { ok: false, reason: 'requires Linux host' };
    if (!hasCommand('dpkg-deb')) return { ok: false, reason: 'dpkg-deb not found' };
    return { ok: true };
  }
  if (target === 'win') {
    if (HOST === 'win32') return { ok: true };
    if (hasCommand('wine') || hasCommand('wine64')) return { ok: true };
    if (process.env.ALLOW_NO_WINE === '1') return { ok: true, degraded: true };
    return { ok: false, reason: 'wine not found (or ALLOW_NO_WINE=1 for degraded)' };
  }
  if (target === 'mac') {
    return HOST === 'darwin' ? { ok: true } : { ok: false, reason: 'requires macOS' };
  }
  if (target === 'android') {
    if (!capCli()) return { ok: false, reason: 'Capacitor CLI not installed (npm install)' };
    const java = javaMajor();
    if (java < 17) return { ok: false, reason: `JDK 17+ required (found ${java || 'none'})` };
    if (!findAndroidSdk()) return { ok: false, reason: 'Android SDK not found (ANDROID_SDK_ROOT/ANDROID_HOME)' };
    if (!exists('android/gradlew')) return { ok: false, reason: 'android/ missing (run npm run mobile:init)' };
    return { ok: true };
  }
  if (target === 'ios') {
    if (HOST !== 'darwin') return { ok: false, reason: 'requires macOS + Xcode' };
    if (!findXcode()) return { ok: false, reason: 'xcodebuild not found' };
    if (!capCli()) return { ok: false, reason: 'Capacitor CLI not installed' };
    if (!exists('ios/App/App.xcworkspace')) return { ok: false, reason: 'ios/ missing (run npm run mobile:init)' };
    return { ok: true };
  }
  return { ok: false, reason: 'unknown target' };
}
function capCli() {
  return exists(path.join(ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'));
}
function planTargets(targets) {
  section('release plan');
  log(`version ${VERSION}  build ${BUILD_NUMBER}  host ${HOST}  out ${rel(VERSION_DIR)}`);
  for (const t of targets) {
    const p = targetPlan(t);
    log(`  ${p.ok ? 'ready  ' : 'skip   '} ${t}${p.reason ? '  - ' + p.reason : ''}${p.degraded ? '  [degraded]' : ''}`);
  }
}

function builderEnvArgs() {
  const args = [];
  if (process.env.ELECTRON_DIST_PATH) {
    args.push(`--config.electronDist=${process.env.ELECTRON_DIST_PATH}`);
  }
  return args;
}

function buildLinux() {
  const p = targetPlan('linux');
  if (!p.ok) return mark('linux', 'skipped', p.reason);
  const out = outDir('linux');
  ensureOut(out);
  run(NPX, ['electron-builder', '--linux', 'deb', '--x64', '--publish', 'never',
    `--config.directories.output=${out}`, ...builderEnvArgs()]);
  mark('linux', 'built', '', out);
}
function buildWin() {
  const p = targetPlan('win');
  if (!p.ok) return mark('win', 'skipped', p.reason);
  const out = outDir('win');
  ensureOut(out);
  const args = ['electron-builder', '--win', 'nsis', '--x64', '--publish', 'never',
    `--config.directories.output=${out}`, ...builderEnvArgs()];
  if (p.degraded) args.push('--config.win.signAndEditExecutable=false');
  run(NPX, args);
  mark('win', 'built', '', out, !!p.degraded);
}
function buildMac() {
  const p = targetPlan('mac');
  if (!p.ok) return mark('mac', 'skipped', p.reason);
  const out = outDir('mac');
  ensureOut(out);
  const notify = notarizeEnabled();
  const args = ['electron-builder', '--mac', 'dmg', '--x64', '--arm64', '--publish', 'never',
    `--config.directories.output=${out}`, ...builderEnvArgs()];
  if (notify) args.push('--config.mac.notarize=true');
  run(NPX, args);
  mark('mac', 'built', '', out);
}

function mobilePrepare() {
  const allowHttp = process.env.MOBILE_ALLOW_HTTP !== '0';
  const defaultServer = process.env.MOBILE_DEFAULT_SERVER || '';
  const js = `window.LEANOTE_MOBILE_CONFIG = ${JSON.stringify({
    version: VERSION, buildNumber: BUILD_NUMBER, defaultServer, allowHttp,
  }, null, 2)};\n`;
  writeFile(path.join(ROOT, 'mobile/www/config.generated.js'), js);
  if (opts.dryRun) log(`DRY  write mobile/www/config.generated.js`);
}
function mobileEnsure(platform) {
  if (platform === 'ios' && HOST !== 'darwin') {
    warn('iOS project generation requires macOS');
    return false;
  }
  if (!isDir(path.join(ROOT, platform))) {
    run(NPX, ['cap', 'add', platform]);
  }
  run(NPX, ['cap', 'sync', platform]);
  if (platform === 'android') patchAndroidManifest();
  return true;
}
function patchAndroidManifest() {
  if (process.env.MOBILE_ALLOW_HTTP === '0') return;
  const file = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
  if (!exists(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  if (/android:usesCleartextTraffic=/.test(text)) {
    text = text.replace(/android:usesCleartextTraffic="[^"]*"/, 'android:usesCleartextTraffic="true"');
  } else {
    text = text.replace(/<application\b/, '<application\n        android:usesCleartextTraffic="true"');
  }
  writeFile(file, text);
}
function mobileInit() {
  mobilePrepare();
  if (!capCli()) die('Capacitor CLI not installed; run npm install');
  if (!isDir(path.join(ROOT, 'android'))) run(NPX, ['cap', 'add', 'android']);
  if (HOST === 'darwin' && !isDir(path.join(ROOT, 'ios'))) run(NPX, ['cap', 'add', 'ios']);
  for (const p of ['android', 'ios']) {
    if (isDir(path.join(ROOT, p))) {
      run(NPX, ['cap', 'sync', p]);
      if (p === 'android') patchAndroidManifest();
    }
  }
  log('mobile projects ready');
}
function mobileSync(platform) {
  mobilePrepare();
  if (!capCli()) die('Capacitor CLI not installed; run npm install');
  const platforms = platform ? [platform] : ['android', 'ios'];
  let count = 0;
  for (const p of platforms) {
    if (isDir(path.join(ROOT, p))) {
      run(NPX, ['cap', 'sync', p]);
      if (p === 'android') patchAndroidManifest();
      count++;
    }
  }
  if (!count) warn('no mobile project found; run npm run mobile:init');
}

function patchAndroid() {
  const gradle = path.join(ROOT, 'android/app/build.gradle');
  if (!exists(gradle)) throw new Error('android/app/build.gradle not found');

  if (androidSigning()) {
    const props = [
      `storeFile=${path.resolve(process.env.ANDROID_KEYSTORE_PATH).split(path.sep).join('/')}`,
      `storePassword=${propEscape(process.env.ANDROID_KEYSTORE_PASSWORD)}`,
      `keyAlias=${propEscape(process.env.ANDROID_KEY_ALIAS)}`,
      `keyPassword=${propEscape(process.env.ANDROID_KEY_PASSWORD)}`,
    ].join('\n') + '\n';
    writeFile(path.join(ROOT, 'android/keystore.properties'), props);
  }
  const text = patchAndroidGradle(fs.readFileSync(gradle, 'utf8'), {
    version: VERSION,
    buildNumber: BUILD_NUMBER,
    signingBlock: androidSigning() ? signingGradleBlock() : '',
  });
  writeFile(gradle, text);

  const sdk = findAndroidSdk();
  if (sdk) {
    const local = path.join(ROOT, 'android/local.properties');
    if (!exists(local)) writeFile(local, `sdk.dir=${sdk.split(path.sep).join('/')}\n`);
  }
}
function propEscape(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/=/g, '\\=').replace(/ /g, '\\ ');
}

function collectAndroid(out) {
  const apkDir = path.join(ROOT, 'android/app/build/outputs/apk/release');
  const aabDir = path.join(ROOT, 'android/app/build/outputs/bundle/release');
  const copies = [];
  for (const [dir, ext] of [[apkDir, 'apk'], [aabDir, 'aab']]) {
    if (!isDir(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.' + ext)) continue;
      const suffix = /unsigned/i.test(f) ? 'unsigned' : 'signed';
      const src = path.join(dir, f);
      const dst = path.join(out, `Leanote-${VERSION}-android-${suffix}.${ext}`);
      if (!opts.dryRun) fs.copyFileSync(src, dst);
      copies.push(dst);
    }
  }
  if (!copies.length) warn('no Android APK/AAB produced');
  return copies;
}
function buildAndroid() {
  const p = targetPlan('android');
  if (!p.ok) return mark('android', 'skipped', p.reason);
  mobilePrepare();
  if (!mobileEnsure('android')) return mark('android', 'skipped', 'Capacitor sync failed');
  const out = outDir('android');
  ensureOut(out);
  patchAndroid();
  const tasks = process.env.ANDROID_BUILD_AAB === '0' ? ['assembleRelease'] : ['assembleRelease', 'bundleRelease'];
  const gradle = HOST === 'win32' ? 'gradlew.bat' : './gradlew';
  run(gradle, ['--no-daemon', ...tasks], { cwd: path.join(ROOT, 'android') });
  collectAndroid(out);
  mark('android', 'built', '', out);
}

function patchIos() {
  const plist = path.join(ROOT, 'ios/App/App/Info.plist');
  if (!exists(plist)) throw new Error('ios/App/App/Info.plist not found');
  writeFile(plist, patchIosPlist(fs.readFileSync(plist, 'utf8'), {
    version: VERSION,
    buildNumber: BUILD_NUMBER,
  }));

  const pbx = path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj');
  if (exists(pbx)) {
    writeFile(pbx, patchIosPbx(fs.readFileSync(pbx, 'utf8'), {
      version: VERSION,
      buildNumber: BUILD_NUMBER,
    }));
  }
}
function iosExportOptions(file) {
  const method = process.env.IOS_EXPORT_METHOD || 'release-testing';
  const team = process.env.IOS_TEAM_ID || '';
  const profile = process.env.IOS_PROVISIONING_PROFILE || '';
  const provisioning = profile
    ? `\n\t<key>provisioningProfiles</key>\n\t<dict>\n\t\t<key>${APP_ID}</key>\n\t\t<string>${xmlEscape(profile)}</string>\n\t</dict>`
    : '';
  writeFile(file, `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>method</key>\n\t<string>${xmlEscape(method)}</string>\n\t<key>teamID</key>\n\t<string>${xmlEscape(team)}</string>\n\t<key>signingStyle</key>\n\t<string>${profile ? 'manual' : 'automatic'}</string>${provisioning}\n</dict>\n</plist>\n`);
}
function xmlEscape(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function findFile(dir, ext) {
  if (!isDir(dir)) return '';
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(ext)) return path.join(dir, f);
  }
  return '';
}
function buildIos() {
  const p = targetPlan('ios');
  if (!p.ok) return mark('ios', 'skipped', p.reason);
  mobilePrepare();
  if (!mobileEnsure('ios')) return mark('ios', 'skipped', 'Capacitor sync failed');
  const out = outDir('ios');
  ensureOut(out);
  patchIos();
  if (exists(path.join(ROOT, 'ios/App/Podfile')) && hasCommand('pod')) {
    run('pod', ['install'], { cwd: path.join(ROOT, 'ios/App') });
  }

  const signed = iosSigning();
  if (!signed && process.env.IOS_REQUIRE_SIGNING === '1') {
    return mark('ios', 'skipped', 'IOS_REQUIRE_SIGNING=1 but signing env is incomplete');
  }
  if (signed) {
    const work = path.join(DIST_ROOT, '.work/ios');
    const archive = path.join(work, 'App.xcarchive');
    const exportDir = path.join(work, 'export');
    mkdir(work);
    run('xcodebuild', ['-workspace', 'ios/App/App.xcworkspace', '-scheme', 'App',
      '-configuration', 'Release', '-destination', 'generic/platform=iOS',
      '-archivePath', archive, 'archive', `DEVELOPMENT_TEAM=${process.env.IOS_TEAM_ID}`,
      `MARKETING_VERSION=${VERSION}`, `CURRENT_PROJECT_VERSION=${BUILD_NUMBER}`,
      ...(process.env.IOS_ALLOW_PROVISIONING_UPDATES === '1' ? ['-allowProvisioningUpdates'] : []),
      ...(process.env.IOS_SIGNING_IDENTITY ? [`CODE_SIGN_IDENTITY=${process.env.IOS_SIGNING_IDENTITY}`] : [])]);
    const plist = path.join(work, 'ExportOptions.plist');
    iosExportOptions(plist);
    run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', plist,
      '-exportPath', exportDir]);
    const ipa = findFile(exportDir, '.ipa');
    if (!ipa) throw new Error('IPA not produced by xcodebuild');
    const dst = path.join(out, `Leanote-${VERSION}-ios-${process.env.IOS_EXPORT_METHOD || 'release-testing'}.ipa`);
    if (!opts.dryRun) fs.copyFileSync(ipa, dst);
    mark('ios', 'built', '', out);
  } else {
    const work = path.join(DIST_ROOT, '.work/ios/sim');
    mkdir(work);
    run('xcodebuild', ['-workspace', 'ios/App/App.xcworkspace', '-scheme', 'App',
      '-configuration', 'Release', '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
      'CODE_SIGNING_ALLOWED=NO', `CONFIGURATION_BUILD_DIR=${work}`, 'build']);
    const app = path.join(work, 'App.app');
    if (!exists(app)) throw new Error('simulator App.app not produced');
    const zip = path.join(out, `Leanote-${VERSION}-ios-simulator-unsigned.zip`);
    run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);
    warn('unsigned iOS build: set IOS_TEAM_ID + IOS_SIGNING_IDENTITY/IOS_PROVISIONING_PROFILE for IPA');
    mark('ios', 'built', 'simulator-unsigned', out);
  }
}

function walk(dir, base = dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (f.endsWith('-unpacked') || f === '.work') continue;
      out.push(...walk(p, base));
    } else {
      out.push(p);
    }
  }
  return out;
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function artifactFiles() {
  if (!isDir(VERSION_DIR)) return [];
  return walk(VERSION_DIR).filter(f => {
    const b = path.basename(f);
    if (b === 'SHA256SUMS' || b === 'release.json') return false;
    if (/^builder-.*\.ya?ml$/.test(b)) return false;
    if (b.endsWith('.blockmap')) return false;
    return /\.(deb|rpm|AppImage|exe|dmg|pkg|apk|aab|ipa|zip)$/i.test(b);
  });
}
function writeMetadata() {
  if (opts.noChecksums) return;
  const files = artifactFiles();
  const artifacts = files.map(f => {
    const relative = path.relative(VERSION_DIR, f).split(path.sep).join('/');
    return {
      platform: relative.split('/')[0],
      file: relative,
      size: fs.statSync(f).size,
      sha256: sha256(f),
    };
  });
  const sums = artifacts.map(a => `${a.sha256}  ${a.file}`).join('\n') + (artifacts.length ? '\n' : '');
  const old = readJson(path.join(VERSION_DIR, 'release.json'), {});
  const summarizeResults = list => list.map(t => ({
    name: t.name,
    status: t.status,
    reason: t.reason || '',
    output: t.output ? rel(t.output) : '',
    degraded: !!t.degraded,
  }));
  const previousTargets = (old.targets || []).map(t => ({
    ...t,
    output: t.output ? (path.isAbsolute(t.output) ? rel(t.output) : t.output) : '',
  }));
  const targetMap = new Map(previousTargets.map(t => [t.name, t]));
  for (const t of summarizeResults(results)) targetMap.set(t.name, t);
  const targetOrder = ['linux', 'win', 'mac', 'android', 'ios'];
  const targetResults = [
    ...targetOrder.filter(n => targetMap.has(n)).map(n => targetMap.get(n)),
    ...[...targetMap.keys()].filter(n => !targetOrder.includes(n)).map(n => targetMap.get(n)),
  ];
  const manifest = {
    name: pkg.name,
    productName: 'Leanote',
    version: VERSION,
    buildNumber: results.length ? Number(BUILD_NUMBER) : (old.buildNumber || Number(BUILD_NUMBER)),
    generatedAt: new Date().toISOString(),
    git: gitInfo(),
    host: { os: HOST, arch: process.arch },
    tools: {
      node: process.version,
      electronBuilder: certVersion('electron-builder'),
      capacitor: certVersion('@capacitor/cli'),
      java: javaMajor() || null,
      xcodebuild: findXcode() || null,
    },
    signing: {
      mac: notarizeEnabled() || !!process.env.CSC_LINK,
      win: !!process.env.CSC_LINK || !!process.env.WIN_CSC_LINK,
      android: androidSigning(),
      ios: iosSigning(),
    },
    targets: targetResults,
    degraded: targetResults.filter(t => t.degraded).map(t => `${t.name}:degraded`),
    artifacts,
  };
  if (opts.dryRun) { log('DRY  write SHA256SUMS / release.json'); return; }
  fs.writeFileSync(path.join(VERSION_DIR, 'SHA256SUMS'), sums);
  fs.writeFileSync(path.join(VERSION_DIR, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  log(`metadata: ${rel(path.join(VERSION_DIR, 'SHA256SUMS'))} (${artifacts.length} artifacts)`);
}

function clean() {
  const dirs = [DIST_ROOT];
  if (opts.native || opts.cleanAll) dirs.push(path.join(ROOT, 'android'), path.join(ROOT, 'ios'));
  if (opts.cleanAll) dirs.push(path.join(ROOT, 'dist-web'));
  for (const d of dirs) {
    if (!exists(d)) continue;
    log(`remove ${rel(d)}`);
    if (!opts.dryRun) fs.rmSync(d, { recursive: true, force: true });
  }
}

function icons() {
  const convert = hasCommand('magick') ? 'magick' : (hasCommand('convert') ? 'convert' : '');
  if (!convert) die('ImageMagick not found (magick/convert)');
  const src = path.join(ROOT, 'public/images/ico/256.ico');
  const out = path.join(ROOT, 'build/icons');
  mkdir(out);
  for (const size of [16, 32, 48, 64, 128, 256]) {
    run(convert, [src, '-resize', `${size}x${size}`, path.join(out, `${size}x${size}.png`)]);
  }
}

function targetsFor(cmd) {
  const all = ['linux', 'win', 'mac', 'android', 'ios'];
  let list;
  if (cmd === 'desktop') list = ['linux', 'win', 'mac'];
  else if (cmd === 'all') list = all;
  else if (all.includes(cmd)) list = [cmd];
  else die(`unknown command: ${cmd}`);
  if (opts.targets) {
    const wanted = opts.targets.split(',').map(s => s.trim()).filter(Boolean);
    for (const t of wanted) if (!all.includes(t)) die(`unknown target: ${t}`);
    list = list.filter(t => wanted.includes(t));
  }
  return list;
}
function runTargets(list) {
  planTargets(list);
  if (opts.dryRun) {
    if (opts.strict) {
      for (const t of list) if (!targetPlan(t).ok) process.exit(3);
    }
    return;
  }
  for (const t of list) {
    section(t);
    try {
      if (t === 'linux') buildLinux();
      else if (t === 'win') buildWin();
      else if (t === 'mac') buildMac();
      else if (t === 'android') buildAndroid();
      else if (t === 'ios') buildIos();
    } catch (e) {
      mark(t, 'failed', e.message);
      console.error(e.stack || e.message);
    }
  }
  writeMetadata();
  section('summary');
  for (const r of results) {
    log(`  ${r.status.padEnd(8)} ${r.name}${r.reason ? '  - ' + r.reason : ''}${r.output ? '  -> ' + rel(r.output) : ''}`);
  }
  if (results.some(r => r.status === 'failed')) process.exit(1);
  if (opts.strict && results.some(r => r.status === 'skipped')) process.exit(3);
}

function usage() {
  console.log(`Leanote release\n\n` +
    `Usage: node scripts/release.mjs <command> [options]\n\n` +
    `Commands:\n` +
    `  check                 dependency and target report\n` +
    `  desktop | linux | win | mac | android | ios | all\n` +
    `  mobile:init           generate Android (and iOS on macOS) Capacitor projects\n` +
    `  mobile:sync [android|ios]\n` +
    `  checksums             regenerate SHA256SUMS/release.json\n` +
    `  clean [--native|--all]\n` +
    `  icons                 regenerate desktop icons (ImageMagick)\n\n` +
    `Options:\n` +
    `  --dry-run  --strict  --force  --build-number N  --targets a,b\n` +
    `  --no-checksums  --verbose\n\n` +
    `Env signing: CSC_LINK, APPLE_*, ANDROID_KEYSTORE_*, IOS_TEAM_ID/IOS_SIGNING_IDENTITY.\n` +
    `Env mobile: MOBILE_DEFAULT_SERVER, MOBILE_ALLOW_HTTP=0, ANDROID_HOME, JAVA_HOME.`);
}

try {
  if (command === 'help') usage();
  else if (command === 'check') { opts.dryRun = true; runTargets(targetsFor('all')); }
  else if (command === 'mobile:init') mobileInit();
  else if (command === 'mobile:sync') mobileSync(opts.positional[1]);
  else if (command === 'checksums') writeMetadata();
  else if (command === 'clean') clean();
  else if (command === 'icons') icons();
  else runTargets(targetsFor(command));
} catch (e) {
  console.error(e.stack || e.message);
  process.exit(1);
}
