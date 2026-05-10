#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Use Chinese mirror for Electron and electron-builder binary downloads
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"
export electron_config_cache="${electron_config_cache:-$HOME/.cache/electron}"

# ─── Helpers ────────────────────────────────────────────────────────────────

usage() {
    cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  linux        Build Linux .deb package (amd64)
  win          Build Windows .exe installer (NSIS, x64)
  android      Build Android APK via Capacitor
  ios          Build iOS app via Capacitor (requires macOS + Xcode)
  less-only    Compile LESS to CSS only, no packaging
  icons        Generate PNG icons from .ico for Linux packaging
  help         Show this help message
EOF
    exit 1
}

log() {
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "════════════════════════════════════════════════════════════"
    echo ""
}

# ─── LESS Compilation ──────────────────────────────────────────────────────

compile_less() {
    log "Compiling LESS files"

    # Core theme files
    for f in \
        public/themes/basic.less:public/themes/basic.css \
        public/themes/default.less:public/themes/default.css \
        public/themes/presentation.less:public/themes/presentation.css \
        public/themes/writting.less:public/themes/writting.css \
        public/themes/windows.less:public/themes/windows.css \
        public/css/login.less:public/css/login.css \
        public/themes/markdown/meditor.less:public/themes/markdown/meditor.css
    do
        src="${f%%:*}"
        dst="${f#*:}"
        if [ -f "$src" ]; then
            npx lessc "$src" "$dst"
            echo "  ✓ $src → $dst"
        fi
    done

    # Color themes
    for dir in public/themes/themes/*/; do
        if [ -f "$dir/theme.less" ]; then
            npx lessc "$dir/theme.less" "$dir/theme.css"
            echo "  ✓ $dir/theme.less"
        fi
    done

    # Markdown theme subdirectories
    for dir in public/themes/markdown/*/; do
        if [ -f "$dir/index.less" ]; then
            npx lessc "$dir/index.less" "$dir/index.css"
            echo "  ✓ $dir/index.less"
        fi
    done

    echo "  LESS compilation complete."
}

# ─── Icon Generation ───────────────────────────────────────────────────────

generate_icons() {
    log "Generating PNG icons from .ico"

    mkdir -p build/icons

    local sizes=(16 32 48 64 128 256)
    local src_ico="public/images/ico/256.ico"

    if [ ! -f "$src_ico" ]; then
        echo "  Error: $src_ico not found"
        exit 1
    fi

    for size in "${sizes[@]}"; do
        convert "$src_ico" -resize "${size}x${size}" "build/icons/${size}x${size}.png"
        echo "  ✓ ${size}x${size}.png"
    done

    echo "  Icon generation complete."
}

# ─── Linux Build ────────────────────────────────────────────────────────────

build_linux() {
    log "Building Linux .deb package"

    # Ensure icons exist
    if [ ! -f "build/icons/256x256.png" ]; then
        generate_icons
    fi

    compile_less
    npx electron-builder --linux deb --x64

    log "Linux build complete"
    ls -lh dist/*.deb 2>/dev/null || echo "  (check dist/ for output)"
}

# ─── Windows Build ──────────────────────────────────────────────────────────

build_windows() {
    log "Building Windows .exe installer"

    compile_less
    npx electron-builder --win nsis --x64

    log "Windows build complete"
    ls -lh dist/*.exe 2>/dev/null || echo "  (check dist/ for output)"
}

# ─── Android Build (Capacitor) ─────────────────────────────────────────────

build_android() {
    log "Building Android APK via Capacitor"

    if [ ! -d "android" ]; then
        echo "  Capacitor Android project not initialized."
        echo "  Run: npx cap add android"
        exit 1
    fi

    compile_less
    build_web_for_mobile
    npx cap sync android

    cd android && ./gradlew assembleDebug
    cd ..

    log "Android build complete"
    ls -lh android/app/build/outputs/apk/debug/app-debug.apk 2>/dev/null || echo "  (check android/ for output)"
}

# ─── iOS Build (Capacitor) ─────────────────────────────────────────────────

build_ios() {
    log "Building iOS app via Capacitor"

    if [ "$(uname)" != "Darwin" ]; then
        echo "  Error: iOS build requires macOS with Xcode."
        exit 1
    fi

    if [ ! -d "ios" ]; then
        echo "  Capacitor iOS project not initialized."
        echo "  Run: npx cap add ios"
        exit 1
    fi

    compile_less
    build_web_for_mobile
    npx cap sync ios

    xcodebuild -workspace ios/App/App.xcworkspace \
        -scheme App -configuration Release -sdk iphoneos

    log "iOS build complete"
}

# ─── Web Build for Mobile (Capacitor) ──────────────────────────────────────

build_web_for_mobile() {
    log "Building web assets for Capacitor"

    mkdir -p dist-web

    # Copy static assets
    cp note.html dist-web/
    cp login.html dist-web/
    cp -r public dist-web/
    cp -r src dist-web/

    echo "  ✓ Web assets copied to dist-web/"
}

# ─── Main ───────────────────────────────────────────────────────────────────

case "${1:-}" in
    linux)      build_linux ;;
    win)        build_windows ;;
    android)    build_android ;;
    ios)        build_ios ;;
    less-only)  compile_less ;;
    icons)      generate_icons ;;
    help|-h|--help) usage ;;
    *)          usage ;;
esac
