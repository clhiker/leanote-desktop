define(['../shared/import-flow'], function (Flow) {
    return Flow.create({
        key: 'import_html',
        labelKey: 'importHTML',
        serviceModule: './public/plugins/import_html/import',
        importMethod: 'importFromHTML',
        filterName: 'HTML',
        ext: 'html',
        accept: '.html',
        chooseText: 'Choose HTML files(.html)',
        failKey: 'Import file: %s Failure, is html file ?',
        ids: {
            dialog: 'importHTMLDialog',
            notebook: 'importDialogNotebookHTML',
            choose: 'chooseHTMLFile',
            msg: 'importHTMLMsg',
            input: 'importHTMLInput',
            tab: 'htmlTab'
        },
        langs: {
            'en-us': {
                'importHTML': 'Import HTML',
            },
            'de-de': {
                'importHTML': 'HTML Datei importieren',
                'Choose HTML files(.html)': 'HTML Dateien (.html) auswählen',
                'Close': "Schliessen",
                'Import to': "Importiere in Notizbuch",
                "Done! %s notes imported!": "Abgeschlossen! Es wurden %s Notizen importiert!",
                "Import file: %s Success!": "Datei importieren: %s erfolgreich!",
                "Import file: %s Failure, is html file ?": "Datei importieren: %s fehlgeschlagen! Ist das eine HTML Datei?",
                "Import: %s Success!": "Import: %s erfolgreich!"
            },
            'zh-cn': {
                'importHTML': '导入HTML/为知笔记',
                'Choose HTML files(.html)': '选择HTML文件(.html)',
                'Close': "关闭",
                'Import to': "导入至",
                "Done! %s notes imported!": "完成, 成功导入 %s 个笔记!",
                "Import file: %s Success!": "文件 %s 导入成功!",
                "Import file: %s Failure, is html file ?": "文件 %s 导入失败! 是HTML文件?",
                "Import: %s Success!": "导入笔记: %s 成功!"
            },
            'zh-hk': {
                'importHTML': '導入HTML',
                'Choose HTML files(.html)': '選擇HTML文件(.html)',
                'Close': "關閉",
                "Import to": "導入至",
                "Done! %s notes imported!": "完成, 成功導入 %s 個筆記!",
                "Import file: %s Success!": "文件 %s 導入成功!",
                "Import file: %s Failure, is html file ?": "文件 %s 導入失敗! 是HTML文件?",
                "Import: %s Success!": "導入筆記: %s 成功!"
            }
        }
    });
});
