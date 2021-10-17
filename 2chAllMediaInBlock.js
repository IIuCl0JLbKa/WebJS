// ==UserScript==
// @name		 2chAllMediaInBlock
// @namespace	 http://tampermonkey.net/
// @version		 0.13
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
	
	document.myExtensions = new Array(); // Массив с расширениями
	document.myStyleBlock = null;		 // Элемент со стилями
	document.switchShowMyMedia = null;	 // Функция показа/скрытия блоков медиа
	document.switchShowMyTypes = null;	 // Функция показа/скрытия медиа по расширениям
	document.switchShowDuplicates = null;// Функция показа/скрытия дублей медиа // TODO Сделать!!
	
	var md5List = new Array();			 // Массив с контрольными суммами всех медиа
	
	// @description  Функция добавления новых пунктов в панель фильтра
	// @param {Node}	elemFilter	- элемент в который добавлять новый тип
	// @param {String}	funcExecut	- функция которую выполнять
	// @param {String}	className	- название класса для чекбокса
	// @param {String}	name		- отображаемое на панели название
	function myAddToFilter(elemFilter, funcExecut, className, name) {
		
		// Создание чекбокса
		var elemCheck = document.createElement("input");
		elemCheck.type = "checkbox";
		elemCheck.defaultChecked = true;
		elemCheck.setAttribute('onclick', funcExecut);
		elemCheck.className = className;
		
		elemFilter.appendChild(elemCheck);			// Добавление чекбокса
		elemFilter.innerHTML += ' ' + name + ' ';	// Добавление подписи
	}
	// @description  Функция добавления новых расширений в панель фильтра
	// @param {String}	extension	- тип который добавлять
	// @param {Node}	elemFilter	- элемент в который добавлять новый тип
	function myExtensionAdd(extension, elemFilter) {
		
		if(elemFilter) {
			var elemFilter = [elemFilter];
		} else {
			// Поиск элемента вставки
			var elemFilter = document.getElementsByClassName("myFilter");
		}
		for(var i = 0; i < elemFilter.length; i++) {
			myAddToFilter(elemFilter[i],
				'document.switchShowMyTypes("' + extension + '", this.checked)',
				"my" + extension,
				extension);
		}
		
		// Добавление стиля, для скрытия всех медиа с данным расширением
		document.myStyleBlock.innerText += ".my-" + extension + "{display:}";
	}
	// @description  Функция добавления новых файлов
	// @param {Array<Node>}	myMediaArray - массив элементов медиа
	// @param {Node}		myElement	 - элемент в который добавлять новый блок
	// @param {Boolean}		isSetup	 	 - это начальная настройка?
	function myMediaAdd(myMediaArray, myElement, isSetup) {
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
			var numberThread = 0;							// Номер треда
			try {
				numberThread = myImg.src.split("thumb/")[1].split("/")[0];
			} catch(e) {
				console.log("Error: '" + e + "' in " + myImg.src);
			}
			// Получение расширения файла
			if(myImg.dataset.src == null) {
				var extension = "other";
			} else {
				var extension  = myImg.dataset.src.substring(myImg.dataset.src.lastIndexOf(".") + 1);
				if(extension == myImg.dataset.src) extension = "other";
			}
			extension = extension.toUpperCase();
			var numberPost = myImg.dataset.md5.split("-")[0]; // Номер поста
			var сheckSum   = myImg.dataset.md5.split("-")[1]; // Контрольная сумма
			
			// Добавление нового расширения
			if(document.myExtensions.indexOf(extension) == -1) {
				document.myExtensions.push(extension);
				if(!isSetup) {
					myExtensionAdd(extension);
				}
			}
			
			// Добавление информации для упрощения поиска
			myBox.setAttribute("thread", numberThread);
			myBox.setAttribute("post",	 numberPost);
			myBox.setAttribute("md5",	 сheckSum);
			myBox.className += " my-" + extension;	// Дополнительный класс для фильтрации по расширениям
			
			// Проверка дубликатов
			if(md5List.indexOf(сheckSum) >= 0) {
				myBox.className += " myDuplicate";
			} else {
				md5List.push(сheckSum);
			}
			
			// Добавить в общий котёл
			myElement.appendChild(myBox);
		}
	}
	// @description  Функуия смены отображения (Оригинала/Блоков медиа)
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
	// @description  Функуия смены отображения определенных типов медиа
	// @param {String}	extension	- расширение
	// @param {Boolean}	isActive	- отображать ли
	document.switchShowMyTypes = function(extension, isActive) {
		
		var displayValue = isActive?'':'none';
		// Поиск стиля для нужного расширения
		var myAllStyles = document.myStyleBlock.sheet.rules;
		for(var i = 0; i < myAllStyles.length; i++) {
			if(myAllStyles[i].selectorText == (".my-" + extension)) {
				// Проставление нужного значения
				myAllStyles[i].style["display"] = displayValue;
				break;
			}
		}
		// Синхронизация чекбоксов
		var elemChecks = document.getElementsByClassName("my" + extension);
		for(var i = 0; i < elemChecks.length; i++) {
			elemChecks[i].checked = isActive;
		}
	}
	// @description  Функуия смены отображения дубликатов медиа
	// @param {Boolean}	isActive	- отображать ли
	document.switchShowDuplicates = function(isActive) {
		
		var displayValue = isActive?'':'none';
		// Поиск стиля для дубликатов
		var myAllStyles = document.myStyleBlock.sheet.rules;
		for(var i = 0; i < myAllStyles.length; i++) {
			if(myAllStyles[i].selectorText == (".myDuplicate")) {
				// Проставление нужного значения
				myAllStyles[i].style["display"] = displayValue;
				break;
			}
		}
		// Синхронизация чекбоксов
		var elemChecks = document.getElementsByClassName("myCheckDuplicate");
		for(var i = 0; i < elemChecks.length; i++) {
			elemChecks[i].checked = isActive;
		}
	}
	
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
	myStyleBlock.id = "myStyle";
	document.myStyleBlock = myStyleBlock;
	
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
	
	// Находит блок со всеми постами
	var myThread = document.getElementById("posts-form");
	
	// Встраивание в страницу
	myThread.parentElement.insertBefore(myEl, myThread.nextSibling);			// Все блоки
	myThread.parentElement.insertBefore(myStyleBlock, myThread.nextSibling);	// Стиль
	
	// Поиск панели навигации
	var aNavigateBlock = document.getElementsByClassName("thread-nav__stats");
	
	for(var i = 0; i < aNavigateBlock.length; i++) {
		
		// Генерация кнопки переключения отображения
		var myButton = document.createElement("button");
		myButton.setAttribute('onclick', "document.switchShowMyMedia()");
		myButton.className = "mediaButton";
		myButton.innerHTML = "Блоки медиа";
		// Блок с чекбоксами
		var myFilter = document.createElement("span");
		myFilter.className = "myFilter";
		myFilter.style["display"] = "inline-block";
		
		// Добавление фильтра дубликатов
		myAddToFilter(myFilter,
					'document.switchShowDuplicates(this.checked)',
					"myCheckDuplicate",
					"Дубликаты");
		
		// Добавление в панель кнопки
		aNavigateBlock[i].appendChild(myButton);
		aNavigateBlock[i].appendChild(myFilter);
	}
	// Добавление стиля для дублей
	document.myStyleBlock.innerText += ".myDuplicate{display:}";
	// Добавление всех расширений при настройке
	for(var i = 0; i < document.myExtensions.length; i++) {
		myExtensionAdd(document.myExtensions[i]);
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