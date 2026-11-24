var db = require('./db');
var Common = require('./common');
var User = require('./user');
var Web = require('./web');
const p = require('./promise_util');
// var Tags = db.tags;
/*
TagId
ServerTagId
Title
Usn
IsDirty
CreatedTime
UpdatedTime
Count 笔记数

*/
// 笔记本服务
var Tag = {

	// 添加或更新标签
	addOrUpdateTag: async function(title, callback, isForce, usn) {
		const userId = User.getCurActiveUserId();
		const tag = await p(db.tags, 'findOne', {UserId: userId, Tag: title}).catch(() => null);
		if (tag) {
			// 已存的, 不更新IsDirty
			await p(db.tags, 'update', {UserId: userId, Tag: title}, {$set: {UpdatedTime: new Date(), LocalIsDelete: false, IsDirty: true}}).catch(() => {});
			console.log('已存在tag ' + title);
			return callback && callback(tag);
		}
		const date = new Date();
		try {
			const doc = await p(db.tags, 'insert', {
				TagId: Common.objectId(),
				UserId: userId,
				Tag: title,
				IsDirty: !isForce, // 新添加的
				Usn: usn, // 在isForce == true时用, 服务器添加过来的
				Count: 1,
				LocalIsDelete: false,
				CreatedTime: date,
				UpdatedTime: date
			});
			callback && callback(doc);
		} catch (e) {
			callback && callback({Ok: false, Inserted: false});
		}
	},

	getTags: async function(callback) {
		try {
			const tags = await p(db.tags, 'find', {UserId: User.getCurActiveUserId(), LocalIsDelete: false});
			tags.sort((a, b) => a.UpdatedTime < b.UpdatedTime);
			callback && callback(tags);
		} catch (e) {
			callback && callback(false);
		}
	},

	// 删除标签, 更新为LocaleIsDelete = true
	deleteTag: function(title, callback, isForce, isFullSync) {
		title += '';
		var me = this;
		db.tags.update({UserId: User.getCurActiveUserId(), Tag: title}, {$set: {LocalIsDelete: true, IsDirty: !isForce, UpdatedTime: new Date()}}, function() {
		});

		// 不是fullSync才更新笔记的标签, 防止fullSync时还有一批IsDirty的
		if (!isFullSync) {
			// 删除笔记内的tag
			var Note = require('./note');
			Note.updateNoteToDeleteTag(title, function(updates) {
				callback && callback(updates);
			});
		} else {
			console.log('	isFullSync not need updateNoteToDeleteTag');
			callback && callback({});
		}
	},

	deleteLocalTag: function (title) {
		console.log('	deleteLocalTag', title)
		db.tags.remove({Tag: title});
	},

	// 更新标签的数量, 在彻底删除笔记时调用
	updateTagCount: function(title, count) {
		userId = User.getCurActiveUserId();
		// 更新Tag's Count
		db.tags.update({UserId: userId, Tag: title}, {$set: {Count: count}});
		// 更新web
		Web.updateTagCount({Tag: title, Count: count});
	},

	getTag: async function(title, callback) {
		try {
			const tag = await p(db.tags, 'findOne', {UserId: User.getCurActiveUserId(), Tag: title});
			callback && callback(tag || false);
		} catch (e) {
			callback && callback(false);
		}
	},


	// 服务器上更新过来, 已经存在了
	setNotDirty: function(title) {
		var me  = this;
		var userId = User.getCurActiveUserId();
		db.tags.update({UserId: userId, Tag: title}, {$set: {IsDirty: false, UpdatedTime: new Date()}}, function() {
		});
	},

	// 更新过来的, 本地有了, 要设置usn, 因为删除的时候要用
	setNotDirtyAndUsn: function(title, usn) {
		var me  = this;
		var userId = User.getCurActiveUserId();
		db.tags.update({UserId: userId, Tag: title}, {$set: {IsDirty: false, Usn: usn, UpdatedTime: new Date()}}, function() {
		});
	},

	// send changes to server
	getDirtyTags: async function(callback) {
		try {
			const tags = await p(db.tags, 'find', {UserId: User.getCurActiveUserId(), IsDirty: true});
			callback && callback(tags || false);
		} catch (e) {
			callback && callback(false);
		}
	},
};
module.exports = Tag;