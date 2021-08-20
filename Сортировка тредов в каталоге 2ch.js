// Сортировка тредов в каталоге https://2ch.hk/b/catalog.html
// По убыванию кол-ва картинок
var needRate = 6.0;
var tredList = document.getElementsByClassName("wrapper-gallery ctlg")[0];
var allTred = tredList.children;

function getNumberInText(text) {
	
	return Number(text.split(":")[1]);
}

for(var i = 0; i < allTred.length; i++) {
	try {
		// Получение блока треда
		var cur = allTred[i];
		// Получение блока с информацией
		var info = cur.getElementsByClassName("ctlg__meta")[0];
		// Получение блока с текстом (2й дочерний)
		info = info.children[1];
		// Получение текста
		info = info.innerText.split("/");
		
		var numPost = getNumberInText(info[0]);
		var numFiles = getNumberInText(info[1]);
		
		console.log("{" + numPost + ", " + numFiles + "}");
	} catch(e) {
		console.log("ERROR[" + i + "] " + e);
	}
}

document.getElementsByClassName("ctlg__thread")[0].getElementsByTagName("ctlg__meta")
document.getElementsByClassName("ctlg__thread")[0].getElementsByClassName("ctlg__meta")[0].children[1].innerText.split("/")[0].split(":")[1]

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
			
document.