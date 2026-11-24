define(['../shared/import-flow'], function (Flow) {
    return Flow.create({
        key: 'import_leanote',
        labelKey: 'importLeanote',
        serviceModule: './public/plugins/import_leanote/import',
        importMethod: 'importFromLeanote',
        filterName: 'Leanote',
        ext: 'leanote',
        accept: '.enex',
        chooseText: 'Choose Leanote files(.leanote)',
        failKey: 'Import file: %s Failure, is leanote file ?',
        ids: {
            dialog: 'importLeanoteDialog',
            notebook: 'importDialogNotebookLeanote',
            choose: 'chooseLeanoteFile',
            msg: 'importLeanoteMsg',
            input: 'importLeanoteInput',
            tab: 'leanoteTab'
        },
        langs: {
            'en-us': {
                'importLeanote': 'Import Leanote',
            },
            'de-de': {
                'importLeanote': 'Leanote Datei importieren',
                'Choose Leanote files(.leanote)': 'Leanote Dateien (.leanote) auswählen',
                'Close': "Schliessen",
                'Import to': "Importiere in Notizbuch",
                "Done! %s notes imported!": "Abgeschlossen! Es wurden %s Notizen importiert!",
                "Import file: %s Success!": "Datei importieren: %s erfolgreich!",
                "Import file: %s Failure, is leanote file ?": "Datei importieren: %s fehlgeschlagen! Ist das eine Leanote Datei?",
                "Import: %s Success!": "Import: %s erfolgreich!"
            },
            'zh-cn': {
                'importLeanote': '导入Leanote',
                'Choose Leanote files(.leanote)': '选择Leanote文件(.leanote)',
                'Close': "关闭",
                'Import to': "导入至",
                "Done! %s notes imported!": "完成, 成功导入 %s 个笔记!",
                "Import file: %s Success!": "文件 %s 导入成功!",
                "Import file: %s Failure, is leanote file ?": "文件 %s 导入失败! 是Leanote文件?",
                "Import: %s Success!": "导入笔记: %s 成功!"
            },
            'zh-hk': {
                'importLeanote': '導入Leanote',
                'Choose Leanote files(.leanote)': '選擇Leanote文件(.leanote)',
                'Close': "關閉",
                "Import to": "導入至",
                "Done! %s notes imported!": "完成, 成功導入 %s 個筆記!",
                "Import file: %s Success!": "文件 %s 導入成功!",
                "Import file: %s Failure, is leanote file ?": "文件 %s 導入失敗! 是Leanote文件?",
                "Import: %s Success!": "導入筆記: %s 成功!"
            }
        }
    });
});
