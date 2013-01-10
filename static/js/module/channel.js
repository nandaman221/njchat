(function($) {

    var Private = {
        serverUrl: '/web'
    }

    function Channel(basePath) {
        this.basePath = basePath;
    }

    //变量和方法分开放在多个extend方法体中，是为了提高语义性，做语义上的“高内聚”，实际效果和写在一起没有区别。
    $.extend(Channel.prototype, {
        id: null,
        lastMessageId: 0,
        pollingErrors: 0,

        //统一的json请求格式方法，参数一为代表请求类型的相对路径，第二个参数为ajax请求参数对象
        request: function(url, options) {
            var channel = this;
            $.ajax($.extend({
                url: Private.serverUrl + this.basePath + url,
                cache: false,
                dataType: "json"
            }, options));
        },

        //轮询获取展示的信息
        poll: function() {
            //TODO handle the connectionerror event
            if (this.pollingErrors > 2) {
                $(this).triggerHandler("connectionerror");
                return;
            }
            var channel = this;

            //请求服务器端的最新信息
            //参数id为当前登陆用户的sessionId
            //参数since代表当前本地最新信息编号，最新的信息从这个点开始获取
            this.request("/recv", {
                data: {
                    id: this.id,
                    since: this.lastMessageId
                },
                success: function(data) {
                    if (data) {
                        channel.handlePoll(data);
                    } else {
                        channel.handlePollError();
                    }
                },
                error: function(){channel.handlePollError();}
            });
        },

        handlePoll: function(data) {
            this.pollingErrors = 0;
            var channel = this;
            if (data && data.messages) {
                $.each(data.messages, function(i, message) {
                    channel.lastMessageId = Math.max(channel.lastMessageId, message.id);
                    $(channel).triggerHandler(message.type, message);
                });
            }
            this.poll();
        },

        handlePollError: function() {
            var self = this;
            this.pollingErrors++;
            setTimeout(function(){self.poll();}, 10*1000);
        }
    });

    $.extend(Channel.prototype, {
        join: function(nick, options) {
            var channel = this;
            this.request("/join", {
                data: {
                    nick: nick
                },
                success: function(data) {
                    if (!data) {
                        (options.error || $.noop)();
                        return;
                    }

                    channel.id = data.id;
                    channel.lastMessageId = data.since || 0;

                    //服务器端获取在线用户列表
                    channel.who();

                    //获取msg
                    channel.poll();

                    (options.success || $.noop)();
                },
                error: options.error || $.noop
            });
        },

        //上次登陆状态是否仍有效的查询
        lastJoin: function(nick, options){
            var channel = this;
            this.request("/join", {
                data: {
                    nick: nick,
                    action: 'state'
                },
                success: function(data) {
                    if (!data) {
                        (options.error || $.noop)();
                        return;
                    }

                    (options.success || $.noop)(function(){
                        //提供一个如果用历史nick登陆时需要做的事情的回调
                        channel.id = data.id;
                        channel.lastMessageId = data.since || 0;

                        //服务器端获取在线用户列表
                        channel.who();

                        //获取msg
                        channel.poll();
                    });
                },
                error: options.error || $.noop
            });
        },

        part: function() {
            if (!this.id) { return; }
            this.request("/part", {
                data: { id: this.id }
            });
        },

        send: function(msg) {
            if (!this.id) { return; }
            this.request("/send", {
                data: {
                    id: this.id,
                    text: msg
                }
            });
        },

        who: function(callback) {
            var channel = this;

            if (!this.id) { return; }
            this.request("/who", {
                success: function(data) {
                    $.each(data.nicks, function(i, nick) {
                        $(channel).triggerHandler('who', nick);
                    });
                }
            });
        }
    });

window.Channel = Channel;
})(jQuery);
