// ==UserScript==
// @name         2chCatalogSort
// @namespace    http://tampermonkey.net/
// @version      0.11
// @description  Сортировка тредов в каталоге https://2ch.hk/b/catalog.html по убыванию кол-ва картинок
// @author       IIuCl-0JLbKa
// @match        https://2ch.hk/*/catalog.html
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';
	
	//$(document).ready(function() {
		// Добавить вариант в список фильтраций
		var p = document.createElement("option");
		p.value = "files";
		p.innerText="По файлам";
		document.getElementsByName("filter")[0].appendChild(p);
	//});
	
	// Функция постоения каталога
	// Catalog.getdata
	Catalog.oldGetData = Catalog.getdata;
	
	// Подмена существующей функции
	Catalog.getdata = function(callback, filter) {
		if (filter == 'num') {
			var url = '/' + board + '/catalog_num.json';
		} else {
			var url = '/' + board + '/catalog.json';
		}

		$.getJSON(url, function(data) {
			Catalog.cdata = [];
			$.each(data.threads, function(index, thread) {
				Catalog.cdata.push(thread)
			});
			
			// Добавленная часть, для сортировки
			if(filter == "files") {
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
			}
		}).then(function() {
			Catalog.onloadsearch();
		});
	}
	
	// Добавление слушателя изменения фильтра
	$('#js-filter').on('change', (e)=>{
		// Какой фильтр уже есть
		var curValue = $('#js-filter').val();
		// Эти два игнорируем, т.к. для них есть обработчик
		if (curValue == 'num' || curValue == 'standart') {
			return;
		}
		Store.set('other.catalog.filter', curValue);
		Catalog.getdata(Catalog.onloadsearch, curValue);
	});
	
	Catalog.getdata(Catalog.onloadsearch, Store.get('other.catalog.filter', 'standart'));
})();