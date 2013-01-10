/**
 * @author nanda221
 * @date   2012.12.14
 * @use    static source switch、mapping、read　etc.
 */

var http = require('http'),
    fs = require('fs'),
    util = require('util'),
    url = require('url'),
    mime = require('./mime'),
    router = require('../router');

function StaticFileMapper(){
    this.staticMap = {};
}

StaticFileMapper.prototype.switch = function(localDir, webDir){
    var self = this,
        ldArray = (util.isArray(localDir)) ? localDir : [localDir];
    //遍历
    ldArray.forEach(function(ele){
        //because of passing a file but not a directory to fs.readdirSync will cause an exception,add the logic below
        if(!fs.statSync(ele).isDirectory()){
            //set web-method to map
            self.staticMap[webDir] = _loadHandler(localDir);
        }
        else{
            //todo add exception catch
            var arr = fs.readdirSync(ele);
            arr.forEach(function(file) {
                var local = ele + '/' + file,
                    web = webDir + '/' + file;
                if (fs.statSync(local).isDirectory()) {
                    self.switch(local, web, null);
                } else {
                    //set web-method to map
                    self.staticMap[web] = _loadHandler(local);
                }
            });
        }
    });

};

StaticFileMapper.prototype.load = function(path, req, res, callback){
    if(!this.staticMap[path]){
        util.puts('file:' + path + ' is not static, try mapping dynamic...');
        callback && callback();
    }
    else{
        this.staticMap[path](req, res);
    }
}

//private　function,return the mime type of given file path
function _getMimeType (path) {
    var index = path.lastIndexOf('.'),
        postfix = index < 0 ? '' : path.substring(index);
    return mime.lookupExtension(postfix);
}

/*
    @load the static source file
    @return the function that will write file content to response
    @the callback mode fully use the closure feature, and avoid execute the file loading twice.
 */

_loadHandler = function(path){
    var body, headers,
        content_type = _getMimeType(path),
        encoding = (content_type.slice(0,4) === 'text' ? 'utf8' : 'binary');

    //util.puts('prehandle the file ' + path);
    function loadResponseData(callback) {
        if (body && headers) {
            callback();
            return;
        }

        //util.puts('loading ' + path + '...');
        fs.readFile(path, encoding, function (err, data) {
            if (err) {
                util.puts('Error loading ' + path);
            } else {
                body = data;
                headers = [ [ 'Content-Type'   , content_type ]
                    , [ 'Content-Length' , body.length ]
                ];
                headers.push(['Cache-Control', 'public']);

                //util.puts('static file ' + path + ' loaded');
                callback();
            }
        });
    }

    return function (req, res) {
        loadResponseData(function () {
            res.writeHead(200, headers);
            res.write(body, encoding);
            res.end();
        });
    };
};

exports.init = function(){
    return new StaticFileMapper();
}