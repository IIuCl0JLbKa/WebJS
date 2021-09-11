// ==UserScript==
// @name		 2chAllMediaInBlock
// @namespace	 http://tampermonkey.net/
// @version		 0.1
// @description	 Выставляет все файлы на странице для удобного просмотра
// @author		 IIuCl-0JLbKa
// @match		 https://2ch.hk/*/res/*
// @icon		 data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant		 none
// ==/UserScript==

(function() {
	'use strict';
	
	////////////////////////////////////////////////////////////
	// Блоки медиа
	////////////////////////////////////////////////////////////
	
	// @description  Функция добавления новых файлов
	// @param {Array<Node>}	myMediaArray - массив элементов медиа
	// @param {Node}		myElement	 - элемент в который добавлять новый блок
	function myMediaAdd(myMediaArray, myElement) {
		// Проходимся по всем медиа
		for(var i = 0; i < myMediaArray.length; i++) {
			
			// Создает новый элемент для медиа
			var myBox = document.createElement("div");
			myBox.className = "myFile";						// Класс (для применения стилей)
			myBox.innerHTML = myMediaArray[i].innerHTML;	// Копирование содержимого
			
			// Убираем класс, для отмены стиля
			var myLinkImg = myBox.children[1];
			myLinkImg.className = "";
			
			// Берём данные поста
			var myImg = myLinkImg.children[0];				// блок <img> т.е. сама картинка
			var myThreadNumber = 0;							// Номер треда
			try {
				myThreadNumber = myImg.src.split("thumb/")[1].split("/")[0];
			} catch(e) {
				console.log("Error: '" + e + "' in " + myImg.src);
			}
			var myPost		= myImg.dataset.md5.split("-")[0]; // Номер поста
			var myCheckSumm = myImg.dataset.md5.split("-")[1]; // Контрольная сумма
			
			// Добавление информации для упрощения поиска
			myBox.setAttribute("thread", myThreadNumber);
			myBox.setAttribute("post",	 myPost);
			myBox.setAttribute("md5",	 myCheckSumm);
			
			// Добавить в общий котёл
			myElement.appendChild(myBox);
		}
	}
	
	// Создает новый элемент в котором будут все файлы
	var myEl = document.createElement("div");
	myEl.className = "myAllMedia";					 // Название класса для удобного поиска элемента
	myEl.style.overflow = "auto";					 // Отображение следующего элемента с новой строки
	myEl.style.display = "none";					 // Отключение отображения
	myEl.style["flex-flow"] = "wrap";				 // Перенос на новую строку при окончании экрана
	myEl.style["justify-content"] = "space-between"; // Для красивого выравнивания
	
	// Получение всех файлов на странице
	var myAllMedia = document.getElementsByClassName("post__image");
	// Добавление их в новый элемент
	myMediaAdd(myAllMedia, myEl);
	
	// Стиль каждого блока с файлом
	var myStyleBlock = document.createElement("style");
	myStyleBlock.innerHTML =
		".myFile{" +
		"background-color:lightgray" +
		";border-radius:4px" +
		";margin:5px" +
		";padding:10px" +
		";text-align:center" +
		";overflow:hidden" +
		"}";
	
	// Находит блок со всеми постами
	var myThread = document.getElementById("posts-form");
	
	// Встраивание в страницу
	myThread.parentElement.insertBefore(myEl, myThread.nextSibling);			// Все блоки
	myThread.parentElement.insertBefore(myStyleBlock, myThread.nextSibling);	// Стиль
	//myThread.outerHTML += myStyleBlock.outerHTML + myEl.outerHTML; // Стиль и Все блоки
	
	// Функуия смены отображения (Оригинала/Блоков медиа)
	document.switchShowMyMedia = function() {
		// Поиск блока с медиа блоками
		var myMediaElem = document.getElementsByClassName("myAllMedia")[0];
		if(!myMediaElem) return;
		
		// Поиск блока со всеми постами
		var myThread = document.getElementById("posts-form");
		
		var bActivate = (myMediaElem.getAttribute("activate") == "true");
		if(bActivate) {
			// Отображение оригинала
			myThread.style.display = "";
			myMediaElem.style.display = "none";
		} else {
			// Отображение блоков медиа
			myThread.style.display = "none";
			myMediaElem.style.display = "flex";
		}
		myMediaElem.setAttribute("activate", !bActivate);
	}
	
	// Поиск панели навигации
	var aNavigateBlock = document.getElementsByClassName("thread-nav__stats");
	
	for(var i = 0; i < aNavigateBlock.length; i++) {
		
		// Генерация кнопки переключения отображения
		var myButton = document.createElement("button");
		myButton.setAttribute('onclick', "document.switchShowMyMedia()");
		myButton.className = "mediaButton";
		myButton.innerHTML = "Блоки медиа";
		
		// Добавление в панель кнопки
		aNavigateBlock[i].appendChild(myButton);
	}
	
	// Проставление флага просмотра (Отключено в связи обновлением 2ch)
	/*MExpandMedia.oldOpen = MExpandMedia.open;
	
	MExpandMedia.open = function(targetEl) {
		
		this.oldOpen(targetEl);
		
		var myEl = document.getElementsByClassName("myAllMedia")[0];
		if(!myEl) return; // Если его нет - сваливаем
		
		// Проход по всем дочерним елемента с медиа
		for(var j = 0; j < myEl.children.length; j++) {
			var myBlock = myEl.children[j];
			if(targetEl.dataset['md5'].split('-')[1] == myBlock.getAttribute("md5")) {
				
				myBlock.style["background-color"] = "bisque";	// Проставление цвета
				myBlock.setAttribute("alreadyView", true);		// Проставление флага
			}
		}
	}*/
	
	////////////////////////////////////////////////////////////
	// Изменение обновления
	////////////////////////////////////////////////////////////
	
	// Сохранение текущей функции обновления
	PostF.oldUpdatePosts = PostF.updatePosts;
	
	// Инъекция своего кода после текущей функции обновления
	PostF.updatePosts = function(myCallback) {
		
		var that = this;
		// Запуск старой функции со своим дополнением
		this.oldUpdatePosts(function(myData) {
			
			// Для сохранения того что было
			myCallback(myData);
			
			// Свой код:
			if(!myData.data && !myData.deleted) return; // Если нет новой информации - сваливаем
			
			// Поиск элемента со всеми файлами
			var myEl = document.getElementsByClassName("myAllMedia")[0];
			if(!myEl) return; // Если его нет - сваливаем

			// Удаленные посты
			if(myData.deleted) {
				
				var myIsDeletedMedia = false;
				
				// Выделить изображение которое удалили и проставить флаг
				// Проход по удаленному
				for(var i = 0; i < myData.deleted.length; i++) {
					// Проход по всем дочерним елемента с медиа
					for(var j = 0; j < myEl.children.length; j++) {
						var myBlock = myEl.children[j];
						if(myBlock.getAttribute("post") == myData.deleted[i]) {
							
							myBlock.style["background-color"] = "darkred";	// Проставление цвета
							myBlock.setAttribute("deleted", true);			// Проставление флага
							myIsDeletedMedia = true;
						}
					}
				}
				if(myIsDeletedMedia) {
					// Отображение что есть удаленные
					var mediaButton = document.getElementsByClassName("mediaButton");
					for(var i = 0; i < mediaButton.length; i++) {
						mediaButton[i].style["background-color"] = "darkred";
					}
				}
			}

			// Добавленые посты
			if(myData.data) {
				
				// Проход по добавленому
				for(var i = 0; i < myData.data.length; i++) {

					// Создается элемент для удобного поиска в нём
					var myNewData = document.createElement("div");
					myNewData.innerHTML = that._generatePostBody(myData.data[i]);

					// Поиск новых файлов
					var myAllMedia = myNewData.getElementsByClassName("post__image");

					myMediaAdd(myAllMedia, myEl);
				}
			}
		});
	}
	
	// Отключение увеличения таймера
	MAutoUpdate.setNewTimeout = function() {}
})();