/**
 * 导出Leanote插件
 * @author  life life@leanote.com
 * 导出的格式为json, 后缀名为 .leanote

 {
	exportDate: '2015-10-12 12:00:00',
	app: 'leanote.desktop.app.mac',
	appVersion: '1.0',
	notes: [
		{
			title: 'life',
			content: 'laldfadf', // 图片, 附件链接为 leanote://file/getImage?fileId=xxxx, leanote://file/getAttach?fileId=3232323
			tags: [1,2,3],
			isMarkdown: true,
			author: 'leanote', // 作者, 没用
			createdTime: '2015-10-12 12:00:00',
			updatedTime: '2015-10-12 12:00:00',
			files: [
				{fileId: '', base64: '', md5: '', type: 'png', 'isAttach': false, createdTime: '2031-12-31 12:12:32'}
				{fileId: '', base64: '', md5: '', type: 'png', 'isAttach': false, createdTime: '2031-12-31 12:12:32'}
			]
		}
	]
 }

 * 
 */
define(['../shared/export-flow'], function(Flow) {
	let async; //  = require('async');

	//===========
	// start

	return {
		langs: {
			'en-us': {
				'export': 'Export Leanote',
				'Exporting': 'Exporting',
				'Exporting: ': 'Exporting: ',
				'exportSuccess': 'Leanote saved successful!',
				'exportFailure': 'Leanote saved failure!',
				'notExists': 'Please sync your note to ther server firslty.'
			},
			'de-de': {
				'export': 'Als Leanote exportieren',
				'Exporting': 'Exportiere',
				'Exporting: ': 'Exportiere: ',
				'exportSuccess': 'Leanote erfolgreich gespeichert!',
				'exportFailure': 'Leanote speichern fehlgeschlagen!',
				'notExists': 'Bitte Notizen zuerst mit dem Server synchronisieren.'
			},
			'zh-cn': {
				'export': '导出Leanote',
				'Exporting': '正在导出',
				'Exporting: ': '正在导出: ',
				'exportSuccess': 'Leanote导出成功!',
				'exportFailure': 'Leanote导出失败!'
			},
			'zh-hk': {
				'export': '導出Leanote',
				'Exporting': '正在導出',
				'Exporting: ': '正在導出: ',
				'exportSuccess': 'Leanote導出成功!',
				'exportFailure': 'Leanote導出失敗!'
			}
		},

		_inited: false,
		init: function() {
			const me = this;
			if (me._inited) {
				return;
			}

			async = require('async');

			me._inited = true;
		},

		fixContent: function (content) {
			return Api.Resanitize.sanitizeNoteBody(content);
		},

		getLeanoteTime: function(t) {
			// 20151026T033928Z
			// 2015 10 26 T 03 39 28 Z
			// console.log(t);
			if (!t) {
				t = new Date();
			}
			if (typeof t != 'object' || !('getTime' in t)) {
				try {
					t = new Date(t);
				}
				catch(e) {
					t = new Date();
				}
			}
			return t.format("yyyy-MM-dd hh:mm:ss");
		},
		
		render: function(note, callback) {
			const me = this;
			const appVersion = Api.getCurVersion() || {version: 'unknown'};
			const info = {
				exportDate: me.getLeanoteTime(),
				app: 'leanote.desktop.app.' + process.platform,
				appVersion: appVersion.version,
				apiVersion: '0.1',
				notes: []
			};
			me.fixFiles(note, function (content, files) {
				// 非markdown才需要这样, 补全html标签
				if (!note.IsMarkdown) {
					content = $('<div>' + content + '</div>').html();
				}

				const filesArr = [];
				files || (files = {});
				for (let fileId in files) {
					if (files.hasOwnProperty(fileId)) {
						files[fileId].fileId = fileId;
						filesArr.push(files[fileId]);
					}
				}

				const noteInfo = {
					title: note.Title,
					content: !note.IsMarkdown ? me.fixContent(content) : content,
					tags: note.Tags,
					author: Api.userService.email || Api.userService.username || '',
					isMarkdown: note.IsMarkdown,
					createdTime: me.getLeanoteTime(note.CreatedTime),
					updatedTime: me.getLeanoteTime(note.UpdatedTime),
					files: filesArr
				};
				info.notes.push(noteInfo);
				callback(JSON.stringify(info, null, 2));
				/*
				enml.ENMLOfHTML(content, function(err, ENML) {
					if (err) {
						info.content = content;
					}
					else {
						info.content = ENML;
					}

					if (note.IsMarkdown) {
						info.content = '<pre>' + info.content + '</pre>';
					}

					callback(me.renderTpl(tpl, info, keys));
				});
				*/
			});
		},

		findAllImages: function (note) {
			const content = note.Content;
			const allMatchs = [];

			// markdown下
			// [](http://localhost://fileId=32);
			if (note.IsMarkdown) {
				var reg = new RegExp('!\\[([^\\]]*?)\\]\\(' + Api.evtService.getImageLocalUrlPrefix() + '\\?fileId=([0-9a-zA-Z]{24})\\)', 'g');
				var matches = reg.exec(content);
				while(matches) {
				    var all = matches[0];
					const title = matches[1]; // img与src之间
				    var fileId = matches[2];
				    allMatchs.push({
				    	fileId: fileId,
				    	title: title,
				    	all: all
				    });
				    // 下一个
				    matches = reg.exec(content);
				}
			}
			else {
				var reg = new RegExp('<img([^>]*?)src=["\']?' + Api.evtService.getImageLocalUrlPrefix() + '\\?fileId=([0-9a-zA-Z]{24})["\']?(.*?)>', 'g');
				var matches = reg.exec(content);
				while(matches) {
				    var all = matches[0];
					const pre = matches[1]; // img与src之间
				    var fileId = matches[2];
					const back = matches[3]; // src与>之间
				    allMatchs.push({
				    	fileId: fileId,
				    	pre: pre,
				    	back: back,
				    	all: all
				    });
				    // 下一个
				    matches = reg.exec(content);
				}
			}

			return allMatchs;
		},

		findAllAttachs: function (note) {
			const content = note.Content;

			const allMatchs = [];
			// markdown下
			// ![](http://localhost://fileId=32);
			if (note.IsMarkdown) {
				var reg = new RegExp('\\[([^\\]]*?)\\]\\(' + Api.evtService.getAttachLocalUrlPrefix() + '\\?fileId=([0-9a-zA-Z]{24})\\)', 'g');
				var matches = reg.exec(content);
				while(matches) {
				    var all = matches[0];
				    var title = matches[1]; // img与src之间
				    var fileId = matches[2];
				    allMatchs.push({
				    	fileId: fileId,
				    	title: title,
				    	all: all,
				    	isAttach: true
				    });
				    // 下一个
				    matches = reg.exec(content);
				}
			}
			else {
				var reg = new RegExp('<a([^>]*?)href=["\']?' + Api.evtService.getAttachLocalUrlPrefix() + '\\?fileId=([0-9a-zA-Z]{24})["\']?(.*?)>([^<]*)</a>', 'g');
				var matches = reg.exec(content);

				while(matches) {
				    var all = matches[0];
					const pre = matches[1]; // a 与href之间
				    var fileId = matches[2];
					const back = matches[3]; // href与>之间
				    var title = matches[4];

				    allMatchs.push({
				    	fileId: fileId,
				    	title: title,
				    	pre: pre,
				    	back: back,
				    	isAttach: true,
				    	all: all
				    });
				    // 下一个
				    matches = reg.exec(content);
				}
			}
			return allMatchs;
		},

		fixFiles: function (note, callback) {
			const me = this;

			let content = note.Content;

			const allImages = me.findAllImages(note) || [];
			const allAttachs = me.findAllAttachs(note) || [];

			const allMatchs = allImages.concat(allAttachs);

			if (allMatchs.length === 0) {
				callback(content, []);
				return;
			}

			const files = {}; // fileId => {}

			function replaceContent () {
				for (let i = 0; i < allMatchs.length; ++i) {
					const eachMatch = allMatchs[i];
					const fileInfo = files[eachMatch.fileId];

					let link;
					if (!fileInfo) {
						link = '';
					}
					else {
						if (note.IsMarkdown) {
							var href;
							if (!eachMatch.isAttach) {
								href = 'leanote://file/getImage?fileId=' + eachMatch.fileId;
								link = '![' + eachMatch.title + '](' + href + ')';
							}
							else {
								href = 'leanote://file/getAttach?fileId=' + eachMatch.fileId;
								link = '[' + eachMatch.title + '](' + href + ')';
							}
						}
						else {
							if (!eachMatch.isAttach) {
								var href = 'leanote://file/getImage?fileId=' + eachMatch.fileId;
								link = '<img ' + eachMatch.pre + 'src="' + href + '"' + eachMatch.back + '>';
							}
							else {
								var href = 'leanote://file/getAttach?fileId=' + eachMatch.fileId;
								link = '<a ' + eachMatch.pre + 'href="' + href + '"' + eachMatch.back + '>' + eachMatch.title + '</a>';
							}
						}
					}

					content = content.replace(eachMatch.all, link);
				}
			}

			// 附件
			const attachs = note.Attachs || [];
			for (var i = 0; i < attachs.length; ++i) {
				const attach = attachs[i];
				var base64AndMd5 = Api.fileService.getFileBase64AndMd5(attach.Path);
				if (base64AndMd5) {
					files[attach.FileId] = {
						base64: base64AndMd5.base64,
						md5: base64AndMd5.md5,
						type: attach.Type,
						title: attach.Title,
						createdTime: me.getLeanoteTime(attach.UpdatedTime || attach.CreatedTime),
						isAttach: true
					}
				}
			}

			// 得到图片资源
			const fileIdFixed = {};
			async.eachSeries(allImages, function(eachMatch, cb) {
				const fileId = eachMatch.fileId;
				if (fileIdFixed[fileId]) {
			    	cb();
			    	return;
			    }

			    Api.fileService.getImageInfo(fileId, function(err, doc) {
					fileIdFixed[fileId] = true;
					if(doc) {
						const base64AndMd5 = Api.fileService.getFileBase64AndMd5(doc.Path);
						if (base64AndMd5) {
							files[doc.FileId] = {
								base64: base64AndMd5.base64,
								md5: base64AndMd5.md5,
								type: doc.Type,
								title: doc.Title,
								createdTime: me.getLeanoteTime(doc.UpdatedTime || doc.CreatedTime),
							}
						}
						cb();
					}
					else {
						cb();
					}
				});

			}, function () {
				replaceContent();
				callback(content, files);
			});
		},

		//--------------

		loadingIsClosed: false,

				exportLeanoteForNotebook: function (notebookId) {
		    Flow.exportForNotebook(this, notebookId, 'plugin.export_leanote.Exporting', 'plugin.export_leanote.exportSuccess', '_exportLeanote');
		},

				exportLeanote: function (noteIds) {
		    Flow.exportNotes(this, noteIds, 'plugin.export_leanote.Exporting', 'plugin.export_leanote.exportSuccess', '_exportLeanote');
		},

		_exportLeanote: function(note, path, callback, i, total) {
			const me = this;
			if(!note) {
				return;
			}

			if (me.loadingIsClosed) {
				callback();
				return;
			}

			setTimeout(function () {
				Api.loading.setMsg(Api.getMsg('plugin.export_leanote.Exporting: ') + (note.Title || getMsg('Untitled')));
				Api.loading.setProgressRate(i + '/' + total);
			}, 100);

			let name = note.Title ? note.Title + '.leanote' : getMsg('Untitled') + '.leanote';
			name = Flow.fixFilename(name);

			const targetPath = path + Api.commonService.getPathSep() + name;

			// 将路径和名字区分开
			const pathInfo = Api.commonService.splitFile(targetPath);
			pathInfo.nameNotExt = Flow.fixFilename(pathInfo.nameNotExt); // 重新修正一次
			const nameNotExt = pathInfo.nameNotExt;
			pathInfo.nameNotExtRaw = pathInfo.nameNotExt;

			// 得到可用文件的绝对路径
			Flow.uniqueFile(pathInfo, 1, function(absLeanoteFilePath) {
				me.render(note, function (content) {
					Api.commonService.writeFile(absLeanoteFilePath, content);
					callback();
				});
			});
		},

		// 打开前要执行的
		onOpen: function() {
			const me = this;
			Flow.registerExportMenu(me, 'plugin.export_leanote.export',
				noteIds => me.exportLeanote(noteIds),
				notebookId => me.exportLeanoteForNotebook(notebookId));
		},
		// 打开后
		onOpenAfter: function() {
		},
		// 关闭时需要运行的
		onClose: function() {
		}
	};
});
