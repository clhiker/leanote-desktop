const assert = require('assert');
const path = require('path');

let events = [];
global.getMsg = (k) => k;
global.Notify = { show: () => events.push('notify') };
global.Api = {
    getMsg: (k) => k,
    loading: {
        show: () => {},
        setProgress: () => {},
        setMsg: () => {},
        setProgressRate: () => {},
        hide: () => {}
    },
    gui: { dialog: { showMessageBoxSync: () => {} } },
    NodeFs: {
        existsSync: () => false,
        mkdirSync: (p) => events.push('mkdir:' + p)
    },
    notebook: {
        getNotebook: (id) => ({
            root: {NotebookId: 'root', Title: 'Root', ParentNotebookId: null},
            child: {NotebookId: 'child', Title: 'Child', ParentNotebookId: 'root'}
        }[id] || {NotebookId: id, Title: id, ParentNotebookId: null}),
        getSubNotebooks: (id) => id === 'root' ? [{NotebookId: 'child', Title: 'Child'}] : []
    },
    noteService: {
        getNotes: (id, cb) => cb({
            root: [{NotebookId: 'root', Title: 'root-note'}],
            child: [{NotebookId: 'child', Title: 'child-note'}]
        }[id] || []),
        getNote: (id, cb) => cb({NotebookId: 'root', Title: id})
    }
};

let Flow;
global.define = function (factory) { Flow = factory(); };
require(path.join(__dirname, '..', 'public/plugins/shared/export-flow.js'));
Flow.chooseDir = (cb) => cb('/out');
Flow.hideLoading = () => events.push('hide');

const plugin = {
    loadingIsClosed: false,
    _export(note, p, cb) {
        events.push('export:' + note.Title + ':' + p);
        cb();
    }
};

(async () => {
    events = [];
    Flow.exportNotes(plugin, ['n1', 'n2'], 'Exporting', 'exportSuccess', '_export');
    await new Promise(r => setTimeout(r, 10));
    assert.deepStrictEqual(events, [
        'export:n1:/out',
        'export:n2:/out',
        'hide',
        'notify'
    ]);

    events = [];
    Flow.exportForNotebook(plugin, 'root', 'Exporting', 'exportSuccess', '_export');
    await new Promise(r => setTimeout(r, 10));
    assert.deepStrictEqual(events, [
        'mkdir:/out/Root',
        'mkdir:/out/Root/Child',
        'export:root-note:/out/Root',
        'export:child-note:/out/Root/Child',
        'hide',
        'notify'
    ]);
    console.log('export_flow OK');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
