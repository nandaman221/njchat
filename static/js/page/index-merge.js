/*merge start*/
(function() {
    ImportJavscript = {
        url: function(url) {
            document.write("<script type=\"text/javascript\" src=\"" + url + "\"></scr" + "ipt>");
        }
    }
})();
/*merge end*/

ImportJavscript.url("js/global/jquery-1.8.3.min.js");
ImportJavscript.url("js/module/channel.js");
ImportJavscript.url("js/page/index.js");