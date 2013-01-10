/**
 * @author nanda221
 * @date   2012.12.18
 * @use    act as a router, and manage lifecycle of modules.
 */

var http = require('http'),
    fs = require('fs'),
    util = require('util'),
    url = require('url'),
    Channel = require('./channel').Channel;

function Router(){
    this.handlerMap = {}
    //this.channels = [];
}

Router.prototype.load = function(path, req, res, callback){
    //analyze the url
    var prefix = /^\/\w+/.exec(path);

    if(prefix && this.handlerMap[prefix[0]]){
        this.handlerMap[prefix[0]](req, res);
    }
    else{
        util.puts("file:" + path + ' has no method to handle it.');
        callback && callback();
    }
}

Router.prototype.register = function(path, method){
    this.handlerMap[path] = method;
}

//add new channel obj and register to Router
Router.prototype.addChannel = function(configs){
    var channel = new Channel(configs);
    if(channel){
        this.register(configs.basePath, function(){
            channel.handle.apply(channel, Array.prototype.slice.call(arguments));
        });
    }
    else{
        util.puts('fail to add Channel with the config: ' + configs);
    }
}

exports.init = function(){
    return new Router();
}