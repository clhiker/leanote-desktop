define(['../shared/import-flow'], function (Flow) {
    return Flow.create({
        key: 'import_evernote',
        labelKey: 'importEvernote',
        serviceModule: './public/plugins/import_evernote/import',
        importMethod: 'importFromEvernote',
        filterName: 'Evernote',
        ext: 'enex',
        accept: '.enex',
        chooseText: 'Choose Evernote files(.enex)',
        failKey: 'Import file: %s Failure, is evernote file ?',
        ids: {
            dialog: 'importEvernoteDialog',
            notebook: 'importDialogNotebookEvernote',
            choose: 'chooseEvernoteFile',
            msg: 'importEvernoteMsg',
            input: 'importEvernoteInput',
            tab: 'evernoteTab'
        },
        langs: {
            'en-us': {
                'importEvernote': 'Import Evernote',
            },
            'de-de': {
                'importEvernote': 'Evernote Datei importieren',
                'Choose Evernote files(.enex)': 'Evernote Dateien (.enex) auswählen',
                'Close': "Schliessen",
                'Import to': "Importiere in Notizbuch",
                "Done! %s notes imported!": "Abgeschlossen! Es wurden %s Notizen importiert!",
                "Import file: %s Success!": "Datei importieren: %s erfolgreich!",
                "Import file: %s Failure, is evernote file ?": "Datei importieren: %s fehlgeschlagen! Ist das eine Evernote Datei?",
                "Import: %s Success!": "Import: %s erfolgreich!"
            },
            'zh-cn': {
                'importEvernote': '导入Evernote',
                'Choose Evernote files(.enex)': '选择Evernote文件(.enex)',
                'Close': "关闭",
                'Import to': "导入至",
                "Done! %s notes imported!": "完成, 成功导入 %s 个笔记!",
                "Import file: %s Success!": "文件 %s 导入成功!",
                "Import file: %s Failure, is evernote file ?": "文件 %s 导入失败! 是Evernote文件?",
                "Import: %s Success!": "导入笔记: %s 成功!"
            },
            'zh-hk': {
                'importEvernote': '導入Evernote',
                'Choose Evernote files(.enex)': '選擇Evernote文件(.enex)',
                'Close': "關閉",
                "Import to": "導入至",
                "Done! %s notes imported!": "完成, 成功導入 %s 個筆記!",
                "Import file: %s Success!": "文件 %s 導入成功!",
                "Import file: %s Failure, is evernote file ?": "文件 %s 導入失敗! 是Evernote文件?",
                "Import: %s Success!": "導入筆記: %s 成功!"
            }
        }
    });
});
