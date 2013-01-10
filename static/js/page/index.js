(function($) {

    var Private = {
        channel: null,
        colors: ["green", "orange", "yellow", "red", "fuschia", "blue"]
    };

    var _proto = {
        init:function(){
            if(this.preCondition()){
                this.execute();
            }
        },
        //执行init方法的前置条件
        preCondition:function(){
            return true;
        },
        execute:function(){
        }
    };

    var Basic = {
        init:function(){
            for(var i in this.Parts){
                $.extend({}, _proto, this.Parts[i]).init();
            }
        }
    };
    parts = (Basic.Parts = {});

    parts.handleLogin = {
        execute:function(){
            var self = this,
                login = $("#login"),
                msgInput = $('#message');

            function _loginError(error) {
                login.addClass("error")
                    .find("label").text(error + " Please choose another:")
                    .end().find("input").focus();
            }

            function _loginSuccess(nick){
                $('body').removeClass('login');
                msgInput.focus();
                self.setCookie('nick', nick);
            }

            //探测cookie，校验是否已经有未过期的登陆账号
            self.hasLogin();

            login.submit(function() {
                var nick = $.trim($("#nick").val());

                //前台校验，包括非空和非法字符判断
                if (!nick.length || !/^[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+$/.test(nick)) {
                    _loginError("Invalid Nickname.");
                    return false;
                }
                //json请求，若通过后台校验，触发后续加入频道操作，否则打回前台，展示错误原因
                Private.channel.join(nick, {
                    success: function() {
                        _loginSuccess(nick);
                    },
                    error: function() {
                        _loginError("Nickname in use.");
                    }
                });

                return false;
            });
            login.find("input").focus();

            //给用已经登陆账号来登陆的行动按钮添加事件
            $('#activenick').click(function(e){
                e.preventDefault();
                _loginSuccess($(this).find('span').html());
            })

            //页面关闭触发退出
            $(window).unload(function() {
                Private.channel.part();
            });
        },
        hasLogin:function(){
            var nick = this.getCookie('nick');
            if(nick != null){
                Private.channel.lastJoin(nick, {
                    success: function(callback) {
                        $('#activenick').click(callback)
                            .find('span').html(nick)
                            .end().show();
                    }
                });
            }
        },
        setCookie:function(name, value, day){
            var Days = day || 1,
                exp = new Date();
            exp.setTime(exp.getTime() + Days*24*60*60*1000);
            document.cookie = name + "=" + encodeURI(value) + ";expires=" + exp.toGMTString();
        },
        getCookie:function(name){
            var arr = document.cookie.match(new RegExp("(^| )"+name+"=([^;]*)(;|$)"));
            return (arr != null) ? decodeURI(arr[2]) : null;
        },
        delCookie:function(name){
            var exp = new Date();
                cval = this.getCookie(name);
            exp.setTime(exp.getTime() - 1);
            if(cval != null){
                document.cookie= name + "="+cval+";expires="+exp.toGMTString();
            }
        },
        preCondition:function(){
            //暂时不提供多聊天室功能，此处硬编码参数
            if(!Private.channel)
                Private.channel = new Channel('/chat');
            return $('#login').length > 0;
        }
    };

    //处理channel对象的自定义事件,目前的事件类型：msg，join，part
    parts.handleChannelEvent = {
        execute:function(){
            var self = this;
            //监听channel的登陆事件
            $(Private.channel).bind('join part msg', function(event, message) {
                //对话框显示登陆信息
                self.render(message);
            });
            //监听在线用户列表获取事件
            $(Private.channel).bind('who', function(event, nick){
                self.handleUserList({nick: nick, type: 'join'});
            });
        },
        render:function(message){
            var msgbox = $('#msgbox'),
                text,
                rowclass;
            if(!message){
                return;
            }
            switch(message.type){
                case 'join':
                    rowclass = 'system-msg';
                    text = 'joined the room';
                    //右侧登陆列表添加头像
                    this.handleUserList(message);
                    break;
                case 'part':
                    rowclass = 'system-msg';
                    text = 'left the room';
                    //右侧登陆列表删除头像
                    this.handleUserList(message);
                    break;
                case 'msg':
                    rowclass = 'user-msg';
                    text = message.text;
                    break;
                default :
                    return;
            }
            $('<div class="' + rowclass + '">').html('<span class="chat-nick">' + message.nick + '</span>' +
                text +
                '<span class="chat-time">' + this.formatTime(message.timestamp) + '</span>')
                .appendTo(msgbox);

        },
        formatTime:function(timestamp){
            var date = new Date(timestamp),
                hours = date.getHours(),
                minutes = date.getMinutes(),
                ampm = "AM";

            if (hours > 12) {
                hours -= 12;
                ampm = "PM";
            }

            if (minutes < 10) {
                minutes = "0" + minutes;
            }

            return hours + ":" + minutes + " " + ampm;
        },
        handleUserList:function(message){
            var operation = false,
                nick = message.nick,
                con = $('#users'),
                nickli  = $('<li>', {
                    class: Private.colors[0],
                    text: nick
                });

            //换换颜色
            Private.colors.push(Private.colors.shift());

            con.find('li').each(function(i, el) {
                switch(message.type){
                    case 'join':
                        if (nick == this.innerHTML) {
                            operation = true;
                            return false;
                        }
                        if (nick < this.innerHTML) {
                            operation = true;
                            nickli.insertBefore(this);
                            return false;
                        }
                        break;
                    case 'part':
                        if (nick == this.innerHTML) {
                            $(this).remove();
                            return;
                        }
                    default:
                        return;
                }

            });
            if (!operation && message.type == 'join') {
                con.append(nickli);
            }
        },
        preCondition:function(){
            //暂时不提供多聊天室功能，此处硬编码参数
            if(!Private.channel)
                Private.channel = new Channel('/chat');
            return true;
        }
    };

    //handle interactive messaging
    parts.handleMsgEvent = {
        execute:function(){
            var self = this,
                msgInput = $('#message');

            $('#entry').submit(function(e){
                var msg = $.trim(msgInput.val());

                //不为空，则发送文字
                if (msg.length > 0) {
                    Private.channel.send(msg);
                }
                msgInput.val('').focus();

                return false;
            });
            //增加页面title消息提示功能
            this.addMsgNotifyOnPageTitle();

        },
        addMsgNotifyOnPageTitle:function(){
            var title = document.title,
                focused = true,
                unread = 0;

            $(window).blur(function() {
                focused = false;
            }).focus(function() {
                focused = true;
                unread = 0;
                document.title = title;
            });
            $(Private.channel).bind('msg', function(event, message) {
                if (!focused) {
                    unread++;
                    document.title = '(' + unread + ') ' + title;
                }
            });
        },
        preCondition:function(){
            //暂时不提供多聊天室功能，此处硬编码参数
            if(!Private.channel)
                Private.channel = new Channel('/chat');
            return true;
        }
    }

    $(function(){
        Basic.init();
    });


/*
var title = document.title,
	colors  = ["green", "orange", "yellow", "red", "fuschia", "blue"],
	channel = nodeChat.connect("/chat"),
	log,
	message;

// TODO: handle connectionerror

$(function() {
	log = $("#chat-log");
	message = $("#message");
	
	// Add a button that can be easily styled
	$("<a></a>", {
		id: "submit",
		text: "Send",
		href: "#",
		click: function(event) {
			event.preventDefault();
			$(this).closest("form").submit();
		}
	})
	.appendTo("#entry fieldset");
	
	// Add a message indicator when a nickname is clicked
	$("#users").delegate("li", "click", function() {
		message
			.val($(this).text() + ": " + message.val())
			.focus();
	});
});


// another user left the channel
// - add to the chat log
.bind("part", function(event, message) {
	var time = formatTime(message.timestamp),
		row = $("<div></div>")
			.addClass("chat-msg chat-system-msg");
	
	$("<span></span>")
		.addClass("chat-time")
		.text(time)
		.appendTo(row);
	
	$("<span></span>")
		.addClass("chat-nick")
		.text(message.nick)
		.appendTo(row);
	
	$("<span></span>")
		.addClass("chat-text")
		.text("left the room")
		.appendTo(row);
	
	row.appendTo(log);
})

// Auto scroll list to bottom
.bind("join part msg", function() {
	// auto scroll if we're within 50 pixels of the bottom
	if (log.scrollTop() + 50 >= log[0].scrollHeight - log.height()) {
		window.setTimeout(function() {
			log.scrollTop(log[0].scrollHeight);
		}, 10);
	}
});

// update the page title to show if there are unread messages
$(function() {
	var focused = true,
		unread = 0;
	
	$(window)
		.blur(function() {
			focused = false;
		})
		.focus(function() {
			focused = true;
			unread = 0;
			document.title = title;
		});
	
	$(channel).bind("msg", function(event, message) {
		if (!focused) {
			unread++;
			document.title = "(" + unread + ") " + title;
		}
	});
});

// notify the chat server that we're leaving if we close the window
$(window).unload(function() {
	channel.part();
});

*/
})(jQuery);
