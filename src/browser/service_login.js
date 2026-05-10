// dir base on note.html

var electron = require('electron')

var Common = require('./src/common');

var Evt = require('./src/evt');
var app = require('@electron/remote').app; // .require('app');
var basePath = app.getPath('appData') + '/leanote'; // /Users/life/Library/Application Support/Leanote'; // require('nw.gui').App.dataPath;
Evt.setDataBasePath(basePath);

// 所有service, 与数据库打交道
var Service = {
	userService: require('./src/user'),
	apiService: require('./src/api'),
};

var db = require('./src/db');
db.initGlobal();

// 全局变量
var ApiService = Service.apiService;
var UserService = Service.userService;
var EvtService = require('./src/evt');
var CommonService = Common;

var gui = require('./src/gui');