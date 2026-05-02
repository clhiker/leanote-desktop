// Local shim for nw.gui API (replaces https://leanote.com/js/app_electron.js)
(function() {
    try {
        var fs = require('fs');
        fs.appendFileSync('/tmp/electron-debug.log', '[shim] Loading shim...\n');
        
        var electron = require('electron');
        
        // Use @electron/remote which is enabled by remoteMain.enable() in main.js
        var remote = require('@electron/remote');
        fs.appendFileSync('/tmp/electron-debug.log', '[shim] @electron/remote loaded\n');
        
        // Check if Menu is available
        if (!remote.Menu) {
            fs.appendFileSync('/tmp/electron-debug.log', '[shim] Menu not available, trying to get from app\n');
            // In some Electron versions, Menu might be accessed differently
            try {
                var Menu = remote.getGlobal('Menu');
                if (Menu) {
                    remote.Menu = Menu;
                    fs.appendFileSync('/tmp/electron-debug.log', '[shim] Got Menu from getGlobal\n');
                }
            } catch(e) {
                fs.appendFileSync('/tmp/electron-debug.log', '[shim] getGlobal failed: ' + e.message + '\n');
            }
        }

        var gui = {
            Window: {
                get: function() {
                    return remote.getCurrentWindow();
                }
            },
            Shell: electron.shell,
            Menu: remote.Menu,
            MenuItem: remote.MenuItem,
            dialog: remote.dialog,
            app: remote.app,
            win: remote.getCurrentWindow(),
            getCurrentWindow: function() {
                return remote.getCurrentWindow();
            },
            getSeparatorMenu: function() {
                return new remote.MenuItem({ type: 'separator' });
            }
        };

        if (typeof window !== 'undefined') {
            window.gui = gui;
            fs.appendFileSync('/tmp/electron-debug.log', '[shim] window.gui set, Menu:', typeof gui.Menu, '\n');
        }
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = gui;
        }
    } catch(e) {
        try {
            fs.appendFileSync('/tmp/electron-debug.log', '[shim] Error: ' + e.message + '\n');
            fs.appendFileSync('/tmp/electron-debug.log', '[shim] Stack: ' + e.stack + '\n');
        } catch(e2) {}
    }
})();
