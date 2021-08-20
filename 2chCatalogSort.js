// ==UserScript==
// @name         2chCatalogSort
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Сортировка тредов в каталоге https://2ch.hk/b/catalog.html по убыванию кол-ва картинок
// @author       IIuCl-0JLbKa
// @match        https://2ch.hk/*/catalog.html
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var url = '/' + board + '/catalog.json';
    $.getJSON(
        url,
        function(data){
            Catalog.cdata = [];
            $.each(data.threads, function(index, thread) {
                Catalog.cdata.push(thread)
            });
            for (var i = 0; i < Catalog.cdata.length-1; i++) {
                var maxInx = i;
                var cur = Catalog.cdata[i].files_count;
                // Поиск максимального среди элементов после "этого"
                for (var j = i+1; j < Catalog.cdata.length; j++) {
                    var temp = Catalog.cdata[j].files_count;
                    if(temp > cur) {
                        cur = temp;
                        maxInx = j;
                    }
                }
                // Ставим на текущее место максимальное
                if(maxInx != i) {
                    var temp = Catalog.cdata[i];
                    Catalog.cdata[i] = Catalog.cdata[maxInx];
                    Catalog.cdata[maxInx] = temp;
                }
            }
        })
        .then(function() {Catalog.onloadsearch();});
})();