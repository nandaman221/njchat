/**
 * @author nanda221
 * @date   2012.12.14
 * @use    act as a server,and just server,routing things are in router dir.
 */

var http = require('http'),
    fs = require('fs'),
    util = require('util'),
    url = require('url'),
    mime = require('./mime'),
    staticFileMapper = require('./staticFileMapper').init(),
    router = require('../router').init(),
    server = exports;

server.init = function(req, res){
    var config = {
            localDir:[__dirname.slice(0, __dirname.indexOf('/lib')) + '/static'],
            webDir:'/web'
        },
        instance;

    //负责处理http请求的方法
    function onRequest(req, res) {
        //默认只处理这两种http请求方法
        if (req.method === "GET" || req.method === "HEAD") {

            res.simpleText = function (code, body) {
                res.writeHead(code, [ ["Content-Type", "text/plain"]
                    , ["Content-Length", body.length]
                ]);
                res.write(body);
                res.end();
            };

            res.simpleJSON = function (code, obj) {
                var body = JSON.stringify(obj);
                res.writeHead(code, [ ["Content-Type", "text/json"]
                    , ["Content-Length", body.length]
                ]);
                res.write(body);
                res.end();
            };

            path = url.parse(req.url).pathname;
            //load the static resource first
            staticFileMapper.load(path, req, res, function(){
                //or do the dynamic mapping
                router.load((path.indexOf(config.webDir) === 0) ? path.slice(config.webDir.length) : path, req, res);
            });
        }
    }

    instance = http.createServer(onRequest);
    router.addChannel({basePath:'/chat'});

    return {
        listen: function(port, host) {
            //TODO finish the switch function
            staticFileMapper.switch(config.localDir, config.webDir);
            instance.listen(port, host);
            util.puts('listen ' + (host || '127.0.0.1') + ':' + port);
        },
        addStaticFiles: function(localDir, webDir){
            staticFileMapper.switch(localDir, webDir || config.webDir);
        }
    };
}

function _notFound(req, res) {
    var NOT_FOUND = "Not Found\n";
    res.writeHead(404, [
        ["Content-Type", "text/plain"],
        ["Content-Length", NOT_FOUND.length]
    ]);
    res.write(NOT_FOUND);
    res.end();
}