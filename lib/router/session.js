/**
 * @author nanda221
 * @date   2012.12.19
 * @use    session to hold state.
 */

function Session(nick) {
	if (nick.length > 50) {
		return;
	}
	if (!/^[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+$/.test(nick)) {
		return;
	}
	
	this.nick = nick;
	this.id = Math.floor(Math.random() * 1e10).toString();
	this.timestamp = new Date();
}

Session.prototype.poke = function() {
	this.timestamp = new Date();
};

function SessionCenter(){
    this.sessionTimeout = 60000;
    this.sessions = {};
}

_extend(SessionCenter.prototype, {
    createSession: function(nick) {
        var session = new Session(nick);
        if (!session) {
            return;
        }

        if(this.isSessionAlive(nick)){
            return;
        }

        this.sessions[session.id] = session;
//        session.since = this.appendMessage(nick, "join");

        return session;
    },

    isSessionAlive: function(nick){
        var nick = nick.toLowerCase();
        for (var i in this.sessions) {
            if (this.sessions[i].nick && this.sessions[i].nick.toLowerCase() === nick) {
                return this.sessions[i];
            }
        }
        return false;
    },

    destroySession: function(id) {
        if (!id || !this.sessions[id]) {
            return false;
        }
        var obj = this.sessions[id];
        delete this.sessions[id];
        return obj;
    },

    expireOldSessions: function() {
        var now = new Date();
        for (var session in this.sessions) {
            if (now - this.sessions[session].timestamp > this.sessionTimeout) {
                this.destroySession(session);
            }
        }
    }
})


function _extend(obj, props) {
    for (var prop in props) {
        obj[prop] = props[prop];
    }
}

exports.SessionCenter = new SessionCenter();
