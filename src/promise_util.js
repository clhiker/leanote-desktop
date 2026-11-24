module.exports = function p(obj, method, ...args) {
    return new Promise((resolve, reject) => {
        obj[method](...args, (err, ret) => err ? reject(err) : resolve(ret));
    });
};
