var fs = require('fs');
var crypto = require('crypto');
var needle = require('needle');
var path = require('path');

var db = require('./db');
var dbClient = require('./db_client');
var Evt = require('./evt');
var User = require('./user');
var Common = require('./common');
const p = require('./promise_util');
var Images = dbClient.images;
var Attachs = db.attachs;
var Web = require('./web');

// timeout 0无限等待, 60,000 1分钟
needle.defaults({
	timeout: 60000,
	rejectUnauthorized: false
});

function log(o) {
	console.trace(o);
}
/*
type File struct {
	FileId         bson.ObjectId `bson:"_id,omitempty"` //
	UserId         bson.ObjectId `bson:"UserId"`
	AlbumId        bson.ObjectId `bson:"AlbumId"`
	Name           string        `Name`  // file name
	Title          string        `Title` // file name or user defined for search
	Size           int64         `Size`  // file size (byte)
	Type           string        `Type`  // file type, "" = image, "doc" = word
	Path           string        `Path`  // the file path
	IsDefaultAlbum bool          `IsDefaultAlbum`
	CreatedTime    time.Time     `CreatedTime`
	FromFileId bson.ObjectId `bson:"FromFileId,omitempty"` // copy from fileId, for collaboration
}

*/

// 文件服务
var File = {
	// 将base64字符串写入文件中, 为导入笔记
	writeBase64: function(data, isImage, type, fileTitle, callback) {
		var me = this;
      	var filename = Common.uuid() + '.' + type;
      	if(isImage) {
      		var basePath = User.getCurUserImagesPath();
      		
      	} else {
      		var basePath = User.getCurUserAttachsPath();
      	}
      	var filePath = basePath + '/' + filename;

      	// test
		// return callback && callback({FileId: Common.objectId(), IsImage: true});

      	// return;
      	try {
		var bf = Buffer.from(data, 'base64');
			var err = fs.writeFileSync(filePath, bf);
			if(err) {
				return callback(false);
			}

			// 得到文件的hash
			var hash = crypto.createHash('md5');
			hash.setEncoding('hex');
			hash.write(bf);
			hash.end();
			var fileHash = hash.read();

			if(isImage) {
				me._addImage(Common.objectId(), filePath, function(newImg) {
					newImg.IsImage = true;
					newImg.hash = fileHash;
					callback && callback(newImg);
				});
			} else {
				me._addAttach(filePath, fileTitle, function(attach) {
					attach.hash = fileHash;
					callback && callback(attach);
				});
			}
		} catch(e) {
			console.log("error!!!");
			console.error(e);
		}
	},

	copyFile: function(originPath, isImage, callback) {
		var me = this;
      	var basePath;
      	if(isImage) {
      		basePath = User.getCurUserImagesPath();
      	} else {
      		basePath = User.getCurUserAttachsPath();
      	}

      	var filePathAttr = Common.splitFile(originPath);
		var fileId = Common.objectId();
		var newFilename = fileId + '_html_' + '.' + filePathAttr.ext;
		var newFilePath = basePath + '/' + newFilename;

      	Common.copyFile(originPath, newFilePath, function(ret) {
			if(ret) {
				if(isImage) {
					me._addImage(fileId, newFilePath, function(newImg) {
						newImg.IsImage = true;
						callback(newImg);
					});
				} else {
					me._addAttach(newFilePath, '', function(attach) {
						callback(attach);
					});
				}
			} else {
				callback(false);
			}
		});
	},

	getFileBase64AndMd5: function(filePath) {
		try {
			// read binary data
		    var bitmap = fs.readFileSync(filePath);
		    if (!bitmap) {
		    	return '';
		    }
		    var base64 =  Buffer.from(bitmap).toString('base64');

		    var hash = crypto.createHash('md5');
			hash.setEncoding('hex');
			hash.write(bitmap);
			hash.end();
			var md5 = hash.read();

			return {base64: base64, md5: md5}

		} catch(e) {
			return '';
		}
	},

	mines: {
	    "gif": "image/gif",
	    "jpeg": "image/jpeg",
	    "jpg": "image/jpeg",
	    "png": "image/png",
	    
	    "css": "text/css",
	    "html": "text/html",
	    "ico": "image/x-icon",
	    "js": "text/javascript",
	    "json": "application/json",
	    "pdf": "application/pdf",
	    "svg": "image/svg+xml",
	    "swf": "application/x-shockwave-flash",
	    "tiff": "image/tiff",
	    "txt": "text/plain",
	    "wav": "audio/x-wav",
	    "wma": "audio/x-ms-wma",
	    "wmv": "video/x-ms-wmv",
	    "xml": "text/xml"
	},

	getFileType: function (ext) {
		if (!ext) {
			return;
		}

		ext = ext.toLowerCase();
		var type = this.mines[ext];
		if (type) {
			return type;
		}
		return ext;
	},

	_addAttach: function(filePath, fileTitle, callback) {
		try {
			var fileStat = fs.statSync(filePath);
		} catch(e) {
			callback(false);
			return;
		}
		var paths = filePath.split(Common.getPathSep()); // windows的filePath不同
		var name = paths[paths.length-1];
		// Web.alertWeb(name);
		var names = name.split('.');
		var ext = names[names.length-1];
		var attach = {
			FileId: Common.objectId(),
			ServerFileId: '',
			Path: filePath,
			NoteId: '',
			Name: name,
			UserId: User.getCurActiveUserId(),
			Title: fileTitle,
			IsDirty: true, // 先添加的肯定是dirty, 什么时候不是dirty ? sync 和 send changes后
			Type: ext,
			Size: fileStat && fileStat.size,
			IsDirty: true, // 本地是新添加的, ServerFileId = 0
			CreatedTime: new Date()
		};
		db.attachs.insert(attach);
		callback && callback(attach);
	},

	// data在web端获取到, 在nodejs端会有错误!!
	pasteImage2: function(data, callback) {
		var me = this;
		data = data.replace(/^data:image\/\w+;base64,/, "");
      	// log(User.getCurUserImagesPath());
      	var filename = Common.uuid() + '.png';
      	var filePath = User.getCurUserImagesPath() + '/' + filename;
      	console.log(filePath);
      	// return;
		fs.writeFile(filePath, Buffer.from(data, 'base64'), function(err) {
			if(err) {
				console.log(err);
				return;
			}
			// return;
			// 保存
			// var relativePath = User.getCurUserImagesAppPath() + '/' + filename;
			// 保存到数据库中
			me._addImage(Common.objectId(), filePath, function(newImg) {
				callback && callback(Evt.getImageLocalUrl(newImg.FileId));
			});
		}); 
	},
	// FileReaderWeb 是 web上的FileReader, 可能与nodejs这个有冲突

	// path是相对于项目路径
	addImage: function(path, callback) {
		var me = this;
		var absolutePath = Evt.getBasePath() + '/' + path;
		me._addImage(Common.objectId(), absolutePath, callback);
	},

	_addImage: function(fileId, absolutePath, callback, isForce) {
		// var absolutePath = Evt.getBasePath() + '/' + path;
		// 得到文件大小
		var stat = fs.statSync(absolutePath);
		var paths = absolutePath.split('/');
		var name = paths[paths.length-1];
		var names = name.split('.');
		var ext = names[names.length-1];
		var image = {
			FileId: fileId,
			ServerFileId: '',
			Path: absolutePath,
			Name: name,
			UserId: User.getCurActiveUserId(),
			Title: name,
			Type: ext,
			Size: stat && stat.size,
			IsDirty: true, // 本地是新添加的
			CreatedTime: new Date()
		};
		if(isForce) {
			image.ServerFileId = fileId;
		}
		dbClient.images.insert(image, function(err, doc) {
			console.log(err);
			console.log(doc);
			if(err) {
				callback && callback(false);
			} else {
				callback && callback(doc);
			}
		})
	},

	// 从服务器上把文件download下来后
	// 这里的fileId是serverFileId, 本地的FileId也保存为该值
	addImageForce: function(fileId, path, callback) {
		var me = this;
		// 先删除之, 可能是本地有记录, 但是文件没了
		dbClient.images.remove({FileId: fileId}, function() { 
			me._addImage(fileId, path, callback, true);
		});
	},

	// 获取图片本地路径
	// 通过FileId可ServerFileId来查找
	// 因为图片的链接 有可能是本地添加的, 又有可能是远程的
	// 如果是远程的, FileId == ServerFileId, 是一样的, 所以不要Or
	getImageLocalPath: function(fileId, callback) {
		// dbClient.images.findOne({$or: {FileId: fileId}, {ServerFileId: fileId}}, function(err, doc) {
		dbClient.images.findOne({FileId: fileId}, function(err, doc) {
			if(!err && doc && doc.Path) { // FileLocalPath是相对于项目的路径
				callback(true, doc.Path);
			} else {
				callback(false, false);
			}
		});
	},

	getImageInfo: function(fileId, callback) {
		dbClient.images.findOne({FileId: fileId}, function(err, doc) {
			if(!err && doc && doc.Path) {
				callback(true, doc);
			} else {
				callback(false, false);
			}
		});
	},

	getAttachInfo: function(fileId, callback) {
		db.attachs.findOne({FileId: fileId}, function(err, doc) {
			if(!err && doc && doc.Path) {
				callback(true, doc);
			} else {
				callback(false, false);
			}
		});
	},
	
	// 得到fileIds所有的images, 为了发送到服务器上
	getAllImages: function(fileIds, callback) {
		var me = this;
		dbClient.images.find({$or:[{FileId: {$in: fileIds}}, {ServerFileId: {$in: fileIds}}]}, function(err, images) {
			if(err || !images) {
				return callback(false);
			}
			callback(images);
		});
	},

	// 笔记添加/修改后会有LocalFileId <=> FileId映射
	// 这个只对image有用
	updateImageForce: function(files) {
		if(!files) {
			// callback && callback(false);
			return;
		}
		for(var i in files) {
			var file = files[i];
			if(file.IsAttach) {
				continue;
			}
			if(!file.FileId || !file.LocalFileId) {
				continue;
			}
			dbClient.images.update({FileId: file.LocalFileId}, {$set: {ServerFileId: file.FileId, IsDirty: false}});
		}
	},

	// tinymce 或 mceeditor上传图片
	// callback({FileId: "xx"})
	uploadImage: function(imagePath, callback) {
		var me = this;
		// 读取文件, 查看是否是图片
		var filePathAttr = Common.splitFile(imagePath);
		var ext = filePathAttr.ext;
		if(!Common.isImageExt(ext)) {
			return callback(false, 'Please select a image');
		}
		var fileId = Common.objectId();
		// 复制到图片文件夹
		filePathAttr.nameNotExt = fileId + '_cp_';
		var newFilename = fileId + '.' + ext;
		var newFilePath = User.getCurUserImagesPath() + '/' + newFilename;
		// 复制之, 并写入到数据库中
		Common.copyFile(imagePath, newFilePath, function(ret) {
			if(ret) {
				me._addImage(fileId, newFilePath, callback);
			} else {
				callback(false);
			}
		});
	},

	// 处理用户图片
	getImage: async function(fileId, callback) {
		if (!fileId) {
			return callback && callback(false);
		}

		const Api = require('./api');
		const getImageFromApi = async () => {
			const fileLocalPath = await new Promise(resolve => Api.getImage(fileId, resolve));
			if (!fileLocalPath) {
				console.log("cann't get server's image" + fileId);
				return false;
			}
			await new Promise(resolve => this.addImageForce(fileId, fileLocalPath, resolve));
			return fileLocalPath;
		};

		const local = await new Promise(resolve => {
			this.getImageLocalPath(fileId, (has, fileLocalPath) => resolve({has, fileLocalPath}));
		});
		if (local.has && local.fileLocalPath) {
			const exists = await new Promise(resolve => {
				fs.access(local.fileLocalPath, fs.constants.F_OK, err => resolve(!err));
			});
			if (exists) {
				return callback && callback(local.fileLocalPath);
			}
		}
		callback && callback(await getImageFromApi());
	},

	// 下载, 复制一份文件
	download: function(srcPath, toPath, callback) {
		var srcIsExists = fs.existsSync(srcPath);
		if(!srcIsExists) {
			return callback(false, 'File Not Exists');
		}
		// console.log(srcPath);
		// console.log(toPath);
		var toIsExists = fs.existsSync(toPath);
		function cp() {
			Common.copyFile(srcPath, toPath, function(ok) {
				callback && callback(ok);
			});
		}
		if(toIsExists) {
			fs.unlink(toPath, function(error) {
				if(!error) {
					cp();
				} else {
					callback && callback(false, 'The Target File Cannot Overwrite');
				}
			});
		} else {
			cp();
		}
	},

	// 附件操作
	addAttach: function(filePaths, noteId, callback) {
		if(!noteId || !filePaths || filePaths.length == 0) {
			return callback && callback(false);
		}
		// filePaths = filePaths.split(';');
		// 复制每一个文件, 保存到数据库中
		var targets = [];
		for(var i in filePaths) {
			var filePath = filePaths[i];
			var fileStat = fs.statSync(filePath);
			var paths = filePath.split(Common.getPathSep()); // windows的filePath不同
			var name = paths[paths.length-1];
			// Web.alertWeb(name);
			var names = name.split('.');
			var ext = names[names.length-1];

			var rename = Common.uuid() + "." + ext;
			var distPath = User.getCurUserAttachsPath() + '/' + rename;
			var readable = fs.createReadStream(filePath);
	        // 创建写入流
	        var writable = fs.createWriteStream(distPath);   
	        // 通过管道来传输流
	        readable.pipe(writable);
			var attach = {
				FileId: Common.objectId(),
				ServerFileId: '',
				Path: distPath,
				NoteId: noteId,
				Name: rename,
				UserId: User.getCurActiveUserId(),
				Title: name,
				IsDirty: true, // 先添加的肯定是dirty, 什么时候不是dirty ? sync 和 send changes后
				Type: ext,
				Size: fileStat && fileStat.size,
				IsDirty: true, // 本地是新添加的, ServerFileId = 0
				CreatedTime: new Date()
			};
			db.attachs.insert(attach);
			targets.push(attach);
		}

		callback && callback(targets);
	},

	// 下载图片, 本地的, 或外站的
	downloadImg: async function(src, callback) {
		// 本地的
		if (src.indexOf('http://127.0.0.1') != -1 || src.indexOf('leanote://') != -1) {
			const ret = /fileId=([a-zA-Z0-9]{24})/.exec(src);
			if (!ret || ret.length !== 2) {
				return callback();
			}
			return callback(await new Promise(resolve => this.getImage(ret[1], resolve)));
		}

		// 本地地址
		if (src.indexOf('file:') === 0 || /^[c-z]:/i.test(src)) {
			if (src.indexOf('file://') >= 0) {
				src = src.substr('file://'.length);
				if (!src) {
					return callback();
				}
			}
			// windows下的 把最前一个'/'去掉
			if (src.indexOf(':') >= 0 && src[0] == '/') {
				src = src.substr(1);
			}
			const strArr = src.split('.');
			const type = strArr.length > 1 ? strArr.pop() : 'png';
			const imagePathAll = User.getCurUserImagesPath() + '/' + Common.uuid() + '.' + type;
			try {
				await fs.promises.copyFile(src, imagePathAll);
				callback(imagePathAll);
			} catch (e) {
				callback();
			}
			return;
		}

		needle.defaults({
			timeout: 60000,
			rejectUnauthorized: src.indexOf('https://leanote.com') === 0
		});
		const resp = await p(needle, 'get', src).catch(() => null);
		if (!resp || resp.statusCode != 200) {
			return callback(false);
		}
		// 返回的是字符串, 肯定是403之类的
		if (typeof resp.body === 'string') {
			return callback(false);
		}
		const typeStr = resp.headers['content-type'];
		const typeArr = typeStr ? typeStr.split('/') : [];
		const type = typeArr.length > 1 ? typeArr[1] : 'png';
		const imagePathAll = User.getCurUserImagesPath() + '/' + Common.uuid() + '.' + type;
		try {
			await fs.promises.writeFile(imagePathAll, resp.body);
			callback(imagePathAll);
		} catch (e) {
			callback(false);
		}
	},

	// 复制外站图片
	copyOtherSiteImage: async function(src, callback) {
		const filePath = await new Promise(resolve => this.downloadImg(src, resolve));
		if (!filePath) {
			return callback(false);
		}
		const file = await new Promise(resolve => this._addImage(Common.objectId(), filePath, resolve));
		callback(file ? Evt.getImageLocalUrl(file.FileId) : false);
	}
};

module.exports = File; 
