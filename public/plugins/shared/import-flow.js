define(function () {
    function tpl(c) {
        const id = c.ids;
        return `
        <style>
        #${id.dialog} .tab-pane {
          text-align: center;
          padding: 10px;
          padding-top: 20px;
        }
        #${id.dialog} .alert {
          margin-top: 10px;
          padding: 0;
          border: none;
        }
        </style>
        <div class="modal fade bs-modal-sm" id="${id.dialog}" tabindex="-1" role="dialog" aria-labelledby="mySmallModalLabel">
            <div class="modal-dialog modal-sm">
              <div class="modal-content">
              <div class="modal-header">
                  <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                  <h4 class="modal-title" class="modalTitle"><span class="lang">Import to</span> <span id="${id.notebook}"></span></h4>
              </div>
              <div class="modal-body" id="">
                <div role="tabpanel">
                  <div class="tab-content">
                    <div role="tabpanel" class="tab-pane active" id="${id.tab}">
                        <a id="${id.choose}" class="btn btn-success btn-choose-file">
                          <i class="fa fa-upload"></i>
                          <span class="lang">${c.chooseText}</span>
                        </a>
                        <div id="${id.msg}" class="alert alert-info">
                            <div class="curImportFile"></div>
                            <div class="curImportNote"></div>
                            <div class="allImport"></div>
                        </div>
                    </div>
                    <div role="tabpanel" class="tab-pane" id="youdaoTab">
                        <input id="${id.input}" type="file" accept="${c.accept}" multiple style="display: none"/>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer ">
                <button type="button" class="btn btn-default upgrade-cancel-btn lang" data-dismiss="modal">Close</button>
              </div>
              </div><!-- /.modal-content -->
            </div><!-- /.modal-dialog -->
        </div><!-- /.modal -->
        `;
    }

    function create(config) {
        const c = config;
        let importService;

        return {
            langs: c.langs,
            _importDialog: null,
            _curNotebook: null,
            _inited: false,

            getMsg: function (txt, data) {
                return Api.getMsg(txt, 'plugin.' + c.key, data);
            },

            init: function () {
                const me = this;
                me._inited = true;
                $('body').append(tpl(c));
                me._importDialog = $('#' + c.ids.dialog);
                me._importDialog.find('.lang').each(function () {
                    $(this).text(me.getMsg($.trim($(this).text())));
                });

                $('#' + c.ids.choose).click(function () {
                    Api.gui.dialog.showOpenDialog(Api.gui.getCurrentWindow(), {
                        properties: ['openFile', 'multiSelections'],
                        filters: [{ name: c.filterName, extensions: [c.ext] }]
                    }).then(function (re) {
                        if (re.canceled !== false || re.filePaths.length < 1) {
                            return;
                        }
                        me.importFiles(re.filePaths);
                    }, function (err) {
                        alert(err);
                    });
                });
            },

            importFiles: function (paths) {
                const me = this;
                if (!paths) {
                    return;
                }
                const notebookId = me._curNotebook.NotebookId;
                let n = 0;
                me.clear();
                if (!importService) {
                    importService = nodeRequire(c.serviceModule);
                }
                importService[c.importMethod](notebookId, paths,
                    function () {
                        setTimeout(function () {
                            $('#' + c.ids.msg + ' .allImport').html(me.getMsg('Done! %s notes imported!', n));
                        }, 500);
                    },
                    function (ok, filename) {
                        const key = ok ? 'Import file: %s Success!' : c.failKey;
                        $('#' + c.ids.msg + ' .curImportFile').html(me.getMsg(key, filename));
                    },
                    function (note) {
                        if (!note) {
                            return;
                        }
                        n++;
                        $('#' + c.ids.msg + ' .curImportNote').html(me.getMsg('Import: %s Success!', note.Title));
                        note.IsNew = false;
                        Note.addSync([note]);
                    }
                );
            },

            clear: function () {
                $('#' + c.ids.msg + ' .curImportFile').html("");
                $('#' + c.ids.msg + ' .curImportNote').html("");
                $('#' + c.ids.msg + ' .allImport').html('');
            },

            open: function (notebook) {
                const me = this;
                if (!notebook) {
                    return;
                }
                if (!me._inited) {
                    me.init();
                }
                me.clear();
                $('#' + c.ids.notebook).html(notebook.Title);
                me._curNotebook = notebook;
                me._importDialog.modal('show');
            },

            onOpen: function () {
                const me = this;
                Api.addImportMenu({
                    label: Api.getMsg('plugin.' + c.key + '.' + c.labelKey),
                    click: function (notebook) {
                        me.open(notebook);
                    }
                });
            },
            onOpenAfter: function () {},
            onClose: function () {}
        };
    }

    return {create: create};
});
