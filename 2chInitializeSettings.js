// ==UserScript==
// @name		 2chInitializeSettings
// @namespace	 http://tampermonkey.net/
// @version		 0.11
// @description	 Выставление заданных настроек если они вовсе не заданы
// @author		 IIuCl-0JLbKa
// @match		 https://2ch.hk/*
// @icon		 data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant		 none
// ==/UserScript==

(function() {
    'use strict';
	
	// Включение автообновления
    var bRefresh = Store.get('thread.autorefresh');
    if(bRefresh == undefined) {
        Store.set('thread.autorefresh', true);
    }
	
	// Выставление громкости
    var nVolume = Store.get('other.webm_vol');
    if(nVolume == undefined) {
        Store.set('other.webm_vol', 0.1);
    }
})();