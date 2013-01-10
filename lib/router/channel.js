/**
 * @author nanda221
 * @date   2012.12.19
 * @use    module:channel, and many execution
 */

var http = require('http'),
    fs = require('fs'),
    util = require('util'),
    url = require('url'),
    qs = require("querystring"),
    EventEmitter = require('events').EventEmitter,
    SessionCenter = require('./session').SessionCenter;

function Channel(options) {
//    EventEmitter.call(this);
    if (!options || !options.basePath) {
        return false;
    }

    this.basePath = options.basePath;
    this.handlerMap = {
        '/join' : this.join,
        '/part' : this.part,
        '/send' : this.send,
        '/recv' : this.receive,
        '/who'  : this.who
    }

    this.messageBacklog = parseInt(options.messageBacklog) || 200;
    this.sessionTimeout = SessionCenter.sessionTimeout = (parseInt(options.sessionTimeout) || 60) * 1000;

    //the number of current message(begin from 1 rather than 0)
    this.nextMessageId = 0;
    //the message Array
    this.messages = [];
    this.callbacks = [];

    var channel = this;
    setInterval(function() {
        channel.flushCallbacks();
        SessionCenter.expireOldSessions();
    }, 1000);

}
//util.inherits(Channel, EventEmitter);

_extend(Channel.prototype, {
    handle: function(req, res){
        //analyze the url
        var urlPath = url.parse(req.url).pathname,
            relativeUrlPath = urlPath.slice(urlPath.indexOf(this.basePath) + this.basePath.length),
            prefix = /^\/\w+/.exec(relativeUrlPath);

        if(prefix && this.handlerMap[prefix[0]]){
            this.handlerMap[prefix[0]].call(this, req, res);
        }
        else{
            util.puts(relativeUrlPath + ' has no method to handle in channel.');
        }
    },
    join: function(req, res){
        var query = qs.parse(url.parse(req.url).query),
            nick = query.nick,
            action = query.action,
            session;

        if (!nick) {
            res.simpleJSON(400, { error: "bad nick." });
            return;
        }
        //如果是状态查询
        if(action === 'state'){
            session =  SessionCenter.isSessionAlive(nick);
            if(session){
                res.simpleJSON(200, { id: session.id, nick: nick, since: session.since });
            }
            else{
                res.simpleJSON(400, {error: 'session expired'});
            }
            return;
        }
        session = SessionCenter.createSession(nick);

        if (!session) {
            res.simpleJSON(400, { error: "nick in use." });
            return;
        }
        else{
            var message = new Message();
            message.type = 'join';
            message.nick = nick;
            session.since = this.appendMessage(message);
        }

        //to receive the system msg of self join, session.since - 1
        res.simpleJSON(200, { id: session.id, nick: nick, since: session.since - 1});
    },
    part: function(req, res){
        var id = qs.parse(url.parse(req.url).query).id;

        var session = SessionCenter.destroySession(id);

        if(session != null){
            var message = new Message();
            message.type = 'part';
            message.nick = session.nick;
            this.appendMessage(message);
            res.simpleJSON(200, { id: id });
        }
        else{
            res.simpleJSON(400, { error: "part failed." });
        }
    },
    send: function(req, res){
        var query = qs.parse(url.parse(req.url).query),
            text = query.text,
            session = SessionCenter.sessions[query.id];

        if (!session) {
            res.simpleJSON(400, { error: "No such session id." });
            return;
        }

        if (!text || !text.length) {
            res.simpleJSON(400, { error: "Must supply text parameter." });
            return;
        }
        session.poke();

        var message = new Message();
        message.type = 'msg';
        message.nick = session.nick;
        message.text = text;

        var id = this.appendMessage(message);
        res.simpleJSON(200, { id: id });
    },
    appendMessage: function(message){
        var id = ++this.nextMessageId;

        message.id = id;
        message.timestamp = (new Date()).getTime();
        this.messages.push(message);
        //this.emit(type, message);

        while (this.callbacks.length > 0) {
            this.callbacks.shift().callback([message]);
        }

        while (this.messages.length > this.messageBacklog) {
            this.messages.shift();
        }

        return id;
    },
    who: function(req, res){
        var nicks = [];
        for (var id in SessionCenter.sessions) {
            nicks.push(SessionCenter.sessions[id].nick);
        }
        res.simpleJSON(200, { nicks: nicks });
    },
    receive: function(req, res){
        var query = qs.parse(url.parse(req.url).query),
            since = parseInt(query.since, 10),
            session = SessionCenter.sessions[query.id],
            channel = this;

        if (!session) {
            res.simpleJSON(400, { error: "No such session id." });
            return;
        }

        if (isNaN(since)) {
            res.simpleJSON(400, { error: "Must supply since parameter." });
            return;
        }

        //reset the session's timeout
        session.poke();
        this._query(since, function(messages) {
            session.poke();
            res.simpleJSON(200, { messages: messages });
        });
    },
    //use internal, not open to web request yet.
    _query: function(since, callback){
        var matching = [],
            length = this.messages.length;
        for (var i = 0; i < length; i++) {
            if (this.messages[i].id > since) {
                matching = this.messages.slice(i);
                break;
            }
        }

        if (matching.length) {
            callback(matching);
        } else {
            this.callbacks.push({
                timestamp: new Date(),
                callback: callback
            });
        }
    },
    //定期清除快要过期的回调（执行后清除）
    flushCallbacks: function() {
        var now = new Date();
        //清除的时间点是《已过四分之三预设过期时间》
        while (this.callbacks.length && now - this.callbacks[0].timestamp > this.sessionTimeout * 0.75) {
            //执行并清除
            this.callbacks.shift().callback([]);
        }
    },
    expireOldSessions: function() {
        var now = new Date();
        for (var session in this.sessions) {
            if (now - this.sessions[session].timestamp > this.sessionTimeout) {
                this.destroySession(session);
            }
        }
    }

});

function Message(){
    this.id = 0;
    this.nick = '';
    this.type = '';
    this.text = '';
    this.timestamp = null;
}

function _extend(obj, props) {
    for (var prop in props) {
        obj[prop] = props[prop];
    }
}

exports.Channel = Channel;