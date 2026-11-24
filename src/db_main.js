var Datastore = require('nedb');
var path = require('path');
var Evt = require('./evt_main');

var db = {};

// dbPath是用户的dbPath
db.init = function (curUser, dbPath, dataBasePath) {
    var me = this;
    var dbNames = [
        'images', 
        /*
        'users', 'notebooks', 'notes', 'tags', 'attachs', 'noteHistories', 'g'*/
        ];
    for(var i in dbNames) {
        var name = dbNames[i];
        var baseDBPath = dbPath;

        var dbFilepath = path.join(baseDBPath, name + '.db');
        (function (name) {
            var autoload = true;
            db[name] = new Datastore(
                {filename: dbFilepath, autoload: autoload, onload: function () {
                console.log(name + ' is loaded [main]');
            }});
        })(name);
    }

    db._inited = true;

    // 保存起来
    Evt.init(curUser, dbPath, dataBasePath);

    console.log('db inited [main]');
};

/**
 * 执行
 * @param  {[type]}   m        [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
db.exec = function(m, callback) {
    console.log('main db called');

    if (!this._inited) {
        callback({token: m.token, err: new Error(), ret: false});
        return;
    }
    if (m.params && typeof m.params === 'string') {
        m.params = JSON.parse(m.params);
    }

    const done = (err, ret) => callback({token: m.token, err, ret});
    const run = async () => {
        if (m.method === 'find') {
            const {query, sorter} = m.params;
            const ret = await new Promise((resolve, reject) => {
                const cursor = db[m.dbname].find(query);
                (sorter ? cursor.sort(sorter) : cursor).exec((err, r) => err ? reject(err) : resolve(r));
            });
            return done(null, ret);
        }
        if (m.method === 'update') {
            const {query, sets, options} = m.params;
            const ret = await new Promise((resolve, reject) => {
                db[m.dbname].update(query, sets, options, (err, r) => err ? reject(err) : resolve(r));
            });
            return done(null, ret);
        }
        const ret = await new Promise((resolve, reject) => {
            db[m.dbname][m.method](m.params, (err, r) => err ? reject(err) : resolve(r));
        });
        done(null, ret);
    };
    run().catch(e => done(e, undefined));
};;

module.exports = db;
