/**
 * @author nanda221
 * @date   2012.12.14
 * @use    act as a server,and just server,routing things are in router dir.
 */

var server = require('./lib/server');

//启动服务，哦也
var instance = server.init();
instance.addStaticFiles(__dirname + '/static/index.html', '/web');
instance.listen('8002');