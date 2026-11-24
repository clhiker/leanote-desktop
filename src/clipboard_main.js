const { clipboard, ipcMain } = require('electron');

var clipboardMain = {
    init: function() {
        // Electron 44 起渲染进程不再暴露 clipboard, 且裁剪为异步 API
        ipcMain.handle('clipboard-read-image', async function() {
            const items = await clipboard.read();
            const types = ['image/png', 'image/jpeg'];
            for (var i = 0; i < types.length; i++) {
                const item = items.find(function(it) {
                    return it.types.includes(types[i]);
                });
                if (!item) {
                    continue;
                }
                const blob = await item.getType(types[i]);
                const buf = Buffer.from(await blob.arrayBuffer());
                if (buf.length) {
                    return 'data:' + types[i] + ';base64,' + buf.toString('base64');
                }
            }
            return '';
        });
    }
};

module.exports = clipboardMain;
