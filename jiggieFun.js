/** User
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {string} color
 * @property {number} heldPieces
 */

/** 
 * @typedef {Object} Group
 * @property {number} id
 * @property {number[]} ids
 * @property {number[]} indices
 * @property {number} set
 * @property {number} x
 * @property {number} y
 * @property {number} angle
 * @property {number} targetAngle
 * @property {boolean} dragged
 * @property {number} w
 * @property {number} h
 * @property {User} user
 * @property {number} rot
 * @property {boolean} locked
 * @property {boolean} selected
 * @property {boolean} selectedByOther
 * @property {number} startX
 * @property {number} startY
 * @property {any[]} pieces
 */

(function(windowref, documentref) {
	const CMD_TYPE = Object.freeze({
		PICK: 0x1,
		MOVE: 0x2,
		DROP: 0x3,
		SELECT: 0x4,
		DESELECT: 0x5,
		MERGE: 0x6,
		ROTATE: 0x7,
		LOCK: 0x8,
		UNLOCK: 0x9,
		STEAL: 0xA,
		HEARTBEAT: 0xB,
	});
	var r = 5;

	function reportErrorFetch(e) {
		r-- <= 0 || "undefined" != typeof fetch && fetch(`/report-error?error=${encodeURIComponent(e)}&room=${globalThis.ROOM_NAME}"&t=${Date.now()}`);
	}
	windowref.onerror = function(e, t, r, a, i) {
		reportErrorFetch(`${e}\n${i && i.stack}`);
	};

	windowref.onunhandledrejection = function(e) {
		var t = e.reason;
		reportErrorFetch("[rejection] ".concat(t && t.message, "\n").concat(t && t.stack));
	};
	var userAgent = navigator.userAgent;
	var isiPadOrMac = /iPad/.test(userAgent) || !!(/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 2);
	var isIphone = /iPhone/.test(userAgent);
	var isIos = isiPadOrMac || isIphone;

	isIos && documentref.body.classList.add("is-ios");

	let receivedHeartBeat = false;
	var l = 1.5;
	var seed = 123;
	var roomdef = {};
	var localsetclone = [];
	let records = [];
	var viewsVar = [];
	var savedname = loadFromLocalStorage("name") || "";
	var savedcolor = loadFromLocalStorage("color") || (function pickARandomColor() {
		const validColors = documentref.querySelectorAll('#user-form [name="color"]');
		return validColors.length ? validColors[Math.floor(Math.random() * validColors.length)].getAttribute("value") : "#ff5bb6";
	})();
	var savedbgcol = loadFromLocalStorage("bg") || "#222222";
	var piecePickMode = loadFromLocalStorage("pick") || "hold";
	var hideusers = "y" === loadFromLocalStorage("hideusers");
	var hidechat = "y" === loadFromLocalStorage("hidechat");
	const nameTags = nameTagsModule(documentref, documentref.getElementById("nametags") ?? /**@type {HTMLElement}*/ (documentref.getElementById("canvas").insertAdjacentElement("afterend", (() => {
		const e = documentref.createElement("div");
		e.id = "nametags";
		return e;
	})())));
	var hidenametags = "y" === loadFromLocalStorage("hidenametags");
	nameTags.enabled = !hidenametags;
	var mutesound = "y" === loadFromLocalStorage("mutesounds");
	var imblind = "y" === loadFromLocalStorage("imblind");
	var mutejuke = "y" === loadFromLocalStorage("mutejuke");
	var jukevol = clamp(loadFloatSetting("jukevol", 1), 0, 1);
	var bgcolorasnum = toRgbaNum(savedbgcol);
	var playerID = 0;
	var previewVisible = false;
	var R = 0;
	var previewScale = clamp(loadFloatSetting("preview-scale", 1), .5, 4);
	var k = performance.now();
	var scaledViewWidth = 0;
	var scaledViewHeight = 0;
	var isTouchEnabled = false;
	var pageClickX = 0;
	var pageClickY = 0;
	var releasedGroups = void 0;
	var tmpbuffer = new Uint8Array(1024);
	var tmpbufferview = new DataView(tmpbuffer.buffer);
	var firstTextureLoadFinished = true;
	var z = true;
	var useGPURenderer = isIos || "cpu" !== loadFromLocalStorage("renderer");
	var I = [];
	var ddMenuCloseFns = [];
	var setPieces = [];

	/**@type {Group[]} */
	var roomdefGroups = [];
	/**@type {Group[]} */
	var transformedboard = [];
	var roomUsers = [];
	var H = 0;
	var G = 0;
	var boardWidth = 0;
	var boardHeight = 0;
	var maxpiecewidth = 0;
	var maxpieceheight = 0;
	var webSocket = void 0;
	var isConnected = false;
	var Q = true;
	var Z = 0;
	var viewX = 0;
	var viewY = 0;
	var viewScale = 1;
	var borderOpacity = 1;
	let discTexture;
	const dlBox = getElementById('download-box');

	if (dlBox)
		dlBox.onclick = (ev) => {
			for (let set of roomdef.sets) {
				const url = "/assets/pictures/" + set.image;
				const dltag = documentref.createElement('a');
				dltag.download = set.image;
				dltag.href = url;
				dltag.click();
			}
		};

	if (loadFromLocalStorage("viewRoom") === globalThis.ROOM_NAME) {
		viewX = loadFloatSetting("viewX", 0);
		viewY = loadFloatSetting("viewY", 0);
		viewScale = loadFloatSetting("viewScale", 1);
	}

	var isPanning = false;
	var prePanViewX = 0;
	var prePanViewY = 0;
	var edgePanX = 0;
	var edgePanY = 0;
	var canvasClickX = 0;
	var canvasClickY = 0;
	var panStartPosX = 0;
	var panStartPosY = 0;
	var touch1X = 0;
	var touch1Y = 0;
	var groups__unknown = [];
	var ge = false;
	var pe = false;
	var isBoxSelecting = false;
	var selectionRectangleX0 = 10;
	var selectionRectangleY0 = 10;
	var selectionRectangleWidth = 100;
	var selectionRectangleHeight = 100;
	try {
		viewsVar = JSON.parse(loadFromLocalStorage("views") || "[]");
	} catch (e) {
		console.error(e);
	}
	var startHelpElement = getElementById("start-help-message");
	if (!loadFromLocalStorage("help-dismissed")) {
		startHelpElement.style.display = "block";
		addClickHandlers(getElementById("close-help-button"), (function() {
			startHelpElement.style.display = "none";
			setLocalStorage("help-dismissed", "yes");
		}));
	};

	if (globalThis.ROOM_NAME && globalThis.ROOM_SECRET)
		setLocalStorage("secret:".concat(globalThis.ROOM_NAME), globalThis.ROOM_SECRET);
	var usersElement = getElementById("users");
	var chatElement = getElementById("chat");
	var roomFormElement = /**@type {HTMLFormElement}*/ (getElementById("room-form"));
	addMouseHandlers(roomFormElement);
	var secretforthisroom = loadFromLocalStorage("secret:".concat(globalThis.ROOM_NAME));
	if (secretforthisroom) {
		var roomSettingsElement = getElementById("room-settings");
		roomSettingsElement.style.display = "block";

		addClickHandlers(roomSettingsElement, (function() {
			roomFormElement.style.display = "flex";
			roomFormElement.scrollTop = 0;
			roomFormElement.preview.checked = !!roomdef.hidePreview;
			roomFormElement.nomultiselect.checked = !!roomdef.nomultiselect;
			roomFormElement.nolockunlock.checked = !!roomdef.nolockunlock;

			roomFormElement.norectselect.checked = !!roomdef.norectselect;
		}));

		addClickHandlers(getElementById("room-form-button"), (function() {
			roomFormElement.style.display = "none";
		}));

		var unkickAllButton = /**@type {HTMLButtonElement}*/ (getElementById("unkickall-button"));
		addClickHandlers(unkickAllButton, (function() {
			sendToWS({
				type: "unkickall",
				secret: secretforthisroom
			});
			unkickAllButton.innerText = "cleared block list";
			unkickAllButton.disabled = true;
			setTimeout((function() {
				unkickAllButton.innerText = "unblock all blocked users";
				unkickAllButton.disabled = false;
			}), 5e3);
		}));

		attachEvents(roomFormElement, "submit", (function(e) {
			e.preventDefault();
			roomFormElement.style.display = "none";
			sendToWS({
				type: "options",
				secret: secretforthisroom,
				hidePreview: roomFormElement.preview.checked,
				nomultiselect: roomFormElement.nomultiselect.checked,
				nolockunlock: roomFormElement.nolockunlock.checked,
				norectselect: roomFormElement.norectselect?.checked
			});
		}));
	}

	function canMultiselect() {
		return !roomdef.nomultiselect || !!secretforthisroom;
	}

	function canRectselect() {
		return canMultiselect() && !roomdef.norectselect || !!secretforthisroom;
	}

	function canLock() {
		return !roomdef.nolockunlock || !!secretforthisroom;
	}
	var previewBoxElement = getElementById("preview-box");
	var previewButtonsElement = getElementById("preview-buttons");

	addClickHandlers(getElementById("preview-zoom-in"), (function() {
		setLocalStorage("preview-scale", previewScale = Math.min(1.2 * previewScale, 5));
		firstTextureLoadFinished = true;
	}));

	addClickHandlers(getElementById("preview-zoom-out"), (function() {
		setLocalStorage("preview-scale", previewScale = Math.max(.8 * previewScale, .2));
		firstTextureLoadFinished = true;
	}));

	var previewNextElement = getElementById("preview-next");

	function Pe() {
		closeDdMenus();

		if (!roomdef.hidePreview) {
			previewVisible = !previewVisible;
			previewButtonsElement.style.display = previewVisible ? "block" : "none";
		};
		firstTextureLoadFinished = true;
	}

	function initDropdownMenu(container, onOpenFn) {
		var toggleButton = container.querySelector(".dropdown-toggle");
		var menu = container.querySelector(".dropdown-menu");
		var isOpen = false;

		function toggle() {
			isOpen || closeDdMenus(), isOpen = !isOpen, menu.style.display = isOpen ? "block" : "none", isOpen ? (onOpenFn && onOpenFn(), container.classList.add("open")) : container.classList.remove("open");
		}
		addClickHandlers(toggleButton, toggle);
		addClickHandlers(menu, toggle);
		ddMenuCloseFns.push((function() {
			return isOpen && toggle();
		}));
	}

	function closeDdMenus() {
		ddMenuCloseFns.forEach((function(e) {
			return e();
		}));
	}

	addClickHandlers(previewNextElement, (function() {
		localsetclone.length > 1 && (R = (R + 1) % localsetclone.length, firstTextureLoadFinished = true);
	}));

	addClickHandlers(getElementById("preview-button"), Pe);

	initDropdownMenu(getElementById("menu"), (function() {
		startHelpElement.style.display = "none";
		setLocalStorage("help-dismissed", "yes");
	}));

	initDropdownMenu(getElementById("locked-box"));

	var lockedBoxElem = getElementById("locked-box");
	var lockedCountElem = getElementById("locked-count");

	function refreshLockedDisplay() {
		for (var e = 0, t = 0, r = roomdefGroups; t < r.length; t++) {
			r[t].locked && e++;
		}
		lockedCountElem.textContent = "" + e;
		lockedBoxElem.style.display = e ? "block" : "none";
	}

	addClickHandlers(getElementById("unlock-all"), (function() {
		var e = roomdefGroups.filter((function(e) {
			return e.locked;
		}));
		if (e.length && canLock()) {
			e.forEach((function(e) {
				return e.locked = false;
			}));
			selectCommand(9, e);
			playsound(locksound);
			refreshLockedDisplay();
		}
	}));
	var helpFormElem = getElementById("help-form");
	addMouseHandlers(helpFormElem);

	addClickHandlers(getElementById("show-help"), (function() {
		helpFormElem.style.display = "flex";
		helpFormElem.scrollTop = 0;
	}));

	addClickHandlers(getElementById("help-form-button"), (function() {
		return helpFormElem.style.display = "none";
	}));

	if ("share" in navigator) {
		var shareLink = getElementById("share-link");
		shareLink.style.display = "block", addClickHandlers(shareLink, (function() {
			var e = navigator.share({
				title: documentref.title,
				url: location.href
			});
			e && e.catch && e.catch((function() {}));
		}));
	}
	var userFormElem = /**@type {HTMLFormElement}*/ (getElementById("user-form"));

	addMouseHandlers(userFormElem);
	addClickHandlers(getElementById("chat-button"), (function() {
		"block" === chatInputElem.style.display ? hide() : reveal();
	}));

	var chatInputElem = /**@type {HTMLInputElement}*/ (getElementById("chat-input"));
	var chatLogElem = getElementById("chat-log");
	var chatMessagesElem = getElementById("chat-messages");

	function clearChatElems() {
		for (; chatMessagesElem.lastElementChild;)
			chatMessagesElem.removeChild(chatMessagesElem.lastElementChild);
	}

	attachEvents(chatLogElem, ["wheel", "touchstart", "touchmove", "touchend"], (function(e) {
		e.target !== chatLogElem && e.target !== chatMessagesElem && e.stopPropagation();
	}));

	attachEvents(chatInputElem, "keydown", (function(e) {
		13 === e.keyCode ? ("/clear" === chatInputElem.value ? clearChatElems() : chatInputElem.value && sendToWS({
			type: "chat",
			message: chatInputElem.value
		}), hide(), setTimeout((function() {
			return chatLogElem.scrollTop = 1e6;
		}))) : 27 === e.keyCode && hide();
	}));

	addClickHandlers(getElementById("clear-chat"), clearChatElems);
	addMouseHandlers(chatInputElem);

	var pieceBoxElem = getElementById("pieceBox");
	var pieceCountElem = getElementById("pieceCount");
	var loadingBoxElem = getElementById("loading");
	var loadingTextElem = getElementById("loading-text");
	var newRoomSameImgBtn = /**@type {HTMLAnchorElement}*/ (getElementById("new-room-same-image"));
	var canvaselem = /**@type {HTMLCanvasElement}*/ (getElementById("canvas"));

	canvaselem.width = windowref.innerWidth;
	canvaselem.height = windowref.innerHeight;

	var cpuDrawingCtx2d = void 0;
	var audioContext = void 0;
	var clicksound = void 0;
	var chatsound = void 0;
	var locksound = void 0;
	var completesound = void 0;

	function preloadsoundeffects() {
		try {
			var loadRemoteFile = function(fileName, successCb) {
				var path = "/assets/".concat(fileName, ".").concat(webmSupported ? "webm" : "mp3"),
					arrBuffer = new XMLHttpRequest;
				arrBuffer.open("GET", path, true), arrBuffer.responseType = "arraybuffer", arrBuffer.onload = function() {
					return audioContext.decodeAudioData(arrBuffer.response, successCb, (function(e) {
						return console.error(e);
					}));
				}, arrBuffer.send();
			};
			if (audioContext) return;
			var webmSupported = (new Audio).canPlayType("audio/webm");

			// @ts-ignore
			var audioctx = windowref.AudioContext || windowref.webkitAudioContext;

			if (!("decodeAudioData" in (audioContext = new audioctx))) return;
			loadRemoteFile("click", (function(e) {
				var t = playsound(clicksound = e);
				t && t.disconnect();
			}));

			loadRemoteFile("chat", (function(e) {
				return chatsound = e;
			}));

			loadRemoteFile("lock", (function(e) {
				return locksound = e;
			}));

			loadRemoteFile("complete", (function(e) {
				return completesound = e;
			}));

		} catch (e) {}
	}

	function playsound(audioBuff, volume) {
		if (audioContext && "createBufferSource" in audioContext && !mutesound) {
			var bufferSrc = audioContext.createBufferSource();
			if (bufferSrc.buffer = audioBuff, volume) {
				var gainNode = audioContext.createGain();
				gainNode.gain.value = volume;
				gainNode.connect(audioContext.destination);
				bufferSrc.connect(gainNode);
			} else bufferSrc.connect(audioContext.destination);
			return bufferSrc.start(0), bufferSrc;
		}
	}
	var gpucontext;
	var gpucontextoptions = {
		alpha: false,
		antialias: false,
		desynchronized: true,
		preserveDrawingBuffer: true
	};
	var ct = false;

	if (useGPURenderer) {
		gpucontext = /**@type {WebGL2RenderingContext}*/ (canvaselem.getContext("webgl2", gpucontextoptions));
		ct = !!gpucontext;
		(gpucontext = gpucontext || /**@type {WebGLRenderingContext}*/ (canvaselem.getContext("webgl", gpucontextoptions) || canvaselem.getContext("experimental-webgl", gpucontextoptions))) && gpucontext.pixelStorei(gpucontext.UNPACK_ALIGNMENT, 1);
	};

	if (!gpucontext) {
		useGPURenderer = false;
		cpuDrawingCtx2d = canvaselem.getContext("2d");
	};
	var initialMatrix = new Float32Array([111, 0, 0, 0, 0, 222, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]);
	var jigshader = useGPURenderer && createShaderProgram({
		vertex: `
            precision mediump float;
            attribute vec2 position;
        attribute vec4 texCoord;
        attribute vec4 vertexColor;

        uniform mat4 transform;
        uniform vec2 shadowOffset;

        varying vec4 vTexCoord;
        varying vec2 vColor;
        varying vec2 vShadowOffset;

        void main() {
            vTexCoord = texCoord;
            vColor = vertexColor.xy;

            float angle = -vertexColor.z;
            float cosa = cos(angle);
            float sina = sin(angle);
            vec2 s = shadowOffset;
            vShadowOffset = vec2(
            cosa * s.x - sina * s.y,
            sina * s.x + cosa * s.y
            );

            gl_Position = transform * vec4(position, 0, 1);
        }

  `,
		fragment: `
        precision mediump float;

        uniform sampler2D sampler1;
        uniform sampler2D sampler2;
        uniform sampler2D sampler3;
      
        uniform float viewScale;
        uniform vec2 shadowSpread;
        uniform vec4 highlightColor;
        uniform float borderOpacity;
      
        varying vec4 vTexCoord;
        varying vec2 vColor;
        varying vec2 vShadowOffset;
      
        void main() {
          vec4 image = texture2D(sampler1, vTexCoord.xy);
          vec4 mask = texture2D(sampler2, vTexCoord.zw);
          vec4 mask2 = texture2D(sampler2, vTexCoord.zw, 1.0 * viewScale);
          if (borderOpacity > 0.5)
              image.rgb *=  min((mask.a * 0.33 + mask2.a * 0.66) + (1.0 - viewScale) * 0.1, 1.0);
          image *= mask.a * vColor.x;
      
          if ((vColor.x + vColor.y) == 0.0) {
            if (mask.a == 1.0) {
              gl_FragColor = vec4(0);
              return;
            }
      
            vec2 sd = shadowSpread * 0.2;
            float a1 = texture2D(sampler2, vTexCoord.zw + vec2(0, -sd.y)).a;
            float a2 = texture2D(sampler2, vTexCoord.zw + vec2(sd.x, 0)).a;
            float a3 = texture2D(sampler2, vTexCoord.zw + vec2(0, sd.y)).a;
            float a4 = texture2D(sampler2, vTexCoord.zw + vec2(-sd.x, 0)).a;
            float b1 = texture2D(sampler2, vTexCoord.zw + vec2(-sd.x, -sd.y)).a * 0.75;
            float b2 = texture2D(sampler2, vTexCoord.zw + vec2(sd.x, sd.y)).a * 0.75;
            float b3 = texture2D(sampler2, vTexCoord.zw + vec2(-sd.x, sd.y)).a * 0.75;
            float b4 = texture2D(sampler2, vTexCoord.zw + vec2(sd.x, -sd.y)).a * 0.75;
            gl_FragColor = highlightColor * max(mask.a, max(max(max(a1, a2), max(a3, a4)), max(max(b1, b2), max(b3, b4))));
            return;
          }
      
          float shadow = 0.0;
      
          if (mask.a != 1.0 && vColor.y > 0.0) {
            shadow = texture2D(sampler3, vTexCoord.zw + vShadowOffset).r * vColor.y * (1.0 - image.a);
          }
      
          gl_FragColor = vec4(0, 0, 0, shadow) + image;
        }
        `
	});

	var spriteShader = useGPURenderer && createShaderProgram({
		vertex: `
        attribute vec2 position;
        attribute vec4 texCoord;
      
        uniform mat4 transform;
        varying vec4 vTexCoord;
      
        void main() {
          vTexCoord = texCoord;
          gl_Position = transform * vec4(position, 0, 1);
        }`,
		fragment: `
        precision mediump float;

        uniform sampler2D sampler1;

        varying vec4 vTexCoord;

        void main() {
            gl_FragColor = texture2D(sampler1, vTexCoord.xy);
        }
        `
	});

	var boardShader = useGPURenderer && createShaderProgram({
		vertex: `
        attribute vec2 position;
        attribute vec4 texCoord;
        attribute vec4 vertexColor;
      
        uniform mat4 transform;
        varying vec4 vColor;
      
        void main() {
          vColor = vertexColor;
          gl_Position = transform * vec4(position, 0, 1);
        }
      `,
		fragment: `
        precision mediump float;

        varying vec4 vColor;

        void main() {
            gl_FragColor = vColor;
        }`
	});

	var shader4 = useGPURenderer && createShaderProgram({
		vertex: `
        attribute vec2 position;
        attribute vec4 texCoord;
      
        varying vec2 vTexCoord;
      
        void main() {
          vTexCoord = texCoord.xy;
          gl_Position = vec4(position, 0, 1);
        }`,
		fragment: `
        precision mediump float;

        uniform sampler2D sampler1;
        
        uniform vec2 shadowOffset;
        uniform vec2 shadowSpread;

        varying vec2 vTexCoord;

        void main() {
            vec2 shadowOff = vTexCoord - shadowOffset;
            vec2 sd = shadowSpread;
            vec2 sd2 = shadowSpread * 2.0;
            float bias = 1.0;

            float shadow = 0.0;

            shadow += texture2D(sampler1, shadowOff, bias).a * 0.15018315018315018;

            shadow += texture2D(sampler1, shadowOff + vec2(0, -sd.y), bias).a * 0.0952380;
            shadow += texture2D(sampler1, shadowOff + vec2(sd.x, 0), bias).a * 0.0952380;
            shadow += texture2D(sampler1, shadowOff + vec2(0, sd.y), bias).a * 0.0952380;
            shadow += texture2D(sampler1, shadowOff + vec2(-sd.x, 0), bias).a * 0.0952380;

            shadow += texture2D(sampler1, shadowOff + vec2(-sd.x, -sd.y), bias).a * 0.0586080;
            shadow += texture2D(sampler1, shadowOff + vec2(sd.x, sd.y), bias).a * 0.0586080;
            shadow += texture2D(sampler1, shadowOff + vec2(-sd.x, sd.y), bias).a * 0.0586080;
            shadow += texture2D(sampler1, shadowOff + vec2(sd.x, -sd.y), bias).a * 0.0586080;

            shadow += texture2D(sampler1, shadowOff + vec2(0, -sd2.y), bias).a * 0.0256410;
            shadow += texture2D(sampler1, shadowOff + vec2(sd2.x, 0), bias).a * 0.0256410;
            shadow += texture2D(sampler1, shadowOff + vec2(0, sd2.y), bias).a * 0.0256410;
            shadow += texture2D(sampler1, shadowOff + vec2(-sd2.x, 0), bias).a * 0.0256410;

            shadow += texture2D(sampler1, shadowOff + vec2(-sd2.x, -sd.y), bias).a * 0.01465201;
            shadow += texture2D(sampler1, shadowOff + vec2(sd2.x, sd.y), bias).a * 0.01465201;
            shadow += texture2D(sampler1, shadowOff + vec2(-sd2.x, sd.y), bias).a * 0.01465201;
            shadow += texture2D(sampler1, shadowOff + vec2(sd2.x, -sd.y), bias).a * 0.01465201;
            shadow += texture2D(sampler1, shadowOff + vec2(-sd.x, -sd2.y), bias).a * 0.01465201;
            shadow += texture2D(sampler1, shadowOff + vec2(sd.x, sd2.y), bias).a * 0.01465201;
            shadow += texture2D(sampler1, shadowOff + vec2(-sd.x, sd2.y), bias).a * 0.01465201;
            shadow += texture2D(sampler1, shadowOff + vec2(sd.x, -sd2.y), bias).a * 0.01465201;

            shadow += texture2D(sampler1, shadowOff + vec2(-sd2.x, -sd2.y), bias).a * 0.00366300;
            shadow += texture2D(sampler1, shadowOff + vec2(sd2.x, sd2.y), bias).a * 0.00366300;
            shadow += texture2D(sampler1, shadowOff + vec2(-sd2.x, sd2.y), bias).a * 0.00366300;
            shadow += texture2D(sampler1, shadowOff + vec2(sd2.x, -sd2.y), bias).a * 0.00366300;
            gl_FragColor = vec4(shadow);
        }`
	});

	var gt = useGPURenderer && function() {
		for (var e = 8192, t = new Float32Array(327680), r = new Uint16Array(49152), n = 0, a = 0; n < r.length; a = a + 4 | 0) {
			r[n++] = a + 0 | 0;
			r[n++] = a + 1 | 0;
			r[n++] = a + 2 | 0;
			r[n++] = a + 0 | 0;
			r[n++] = a + 2 | 0;
			r[n++] = a + 3 | 0;
		}
		var i = gpucontext.createBuffer();
		gpucontext.bindBuffer(gpucontext.ELEMENT_ARRAY_BUFFER, i);
		gpucontext.bufferData(gpucontext.ELEMENT_ARRAY_BUFFER, r, gpucontext.STATIC_DRAW);
		gpucontext.bindBuffer(gpucontext.ELEMENT_ARRAY_BUFFER, null);

		return {
			vertices: t,
			indexBuffer: i,
			buffers: [],
			currentBuffer: 0,
			index: 0,
			count: 0,
			capacity: e
		};
	}();

	var realImage = null;
	var maskTexture = null;
	var xt = null;
	var currentFrameBuffer = null;
	var yt = [l, l, l, l];
	var previousSelecter = void 0;
	var transformMat2d = new Float32Array([1, 0, 0, 1, 0, 0]);
	var Et = 0;
	var Rt = 0;
	var Ct = void 0;
	var cpucanvas = createElemWithClass("canvas");
	var cpudrawingcontext = cpucanvas.getContext("2d");
	var actualBoardCanvas = !useGPURenderer && createElemWithClass("canvas");
	var boardInnerDrawingContext = actualBoardCanvas && actualBoardCanvas.getContext("2d");
	var cpucanvas3 = !useGPURenderer && createElemWithClass("canvas");
	var boardOuterDrawingContext = cpucanvas3 && cpucanvas3.getContext("2d");
	var possibletransparentbgcol = "white";

	function clampOOBView(pos, boardSize, windowSize, maxOOB) {
		var occlusion = boardSize - windowSize / viewScale,
			newPos = -(occlusion + maxOOB);
		return newPos > maxOOB ? -occlusion / 2 : clamp(pos, newPos, maxOOB);
	}

	function updateRoomView() {
		var maxOOB = Math.max(500, Math.ceil(.5 * (windowref.innerWidth - boardWidth * viewScale) / viewScale));
		viewX = clampOOBView(viewX, boardWidth, windowref.innerWidth, maxOOB);
		viewY = clampOOBView(viewY, boardHeight, windowref.innerHeight, maxOOB);
		setLocalStorage("viewRoom", globalThis.ROOM_NAME);
		setLocalStorage("viewX", viewX);
		setLocalStorage("viewY", viewY);
		setLocalStorage("viewScale", viewScale);
	}

	function syncUserFormState() {
		userFormElem.style.display = "flex";
		userFormElem.scrollTop = 0;
		userFormElem.userName.value = savedname;
		userFormElem.color.value = savedcolor;
		userFormElem.bg.value = savedbgcol;
		userFormElem.hideusers.checked = hideusers;
		userFormElem.hidechat.checked = hidechat;
		userFormElem.hidenametags.checked = hidenametags;
		userFormElem.mutesounds.checked = mutesound;
		userFormElem.imblind.checked = imblind;
		userFormElem.elements["click"].value = "click" === piecePickMode ? "click" : "hold";
		userFormElem.renderer.value = useGPURenderer ? "gpu" : "cpu";
	}

	function syncChatUserUiState() {
		usersElement.style.display = hideusers ? "none" : "block";
		chatElement.style.display = hidechat ? "none" : "block";
		nameTags.enabled = !hidenametags;
	}

	function startLogin() {
		if (userFormElem.userName.value) {
			userFormElem.style.display = "none";
			setLocalStorage("name", savedname = userFormElem.userName.value);
			setLocalStorage("color", savedcolor = userFormElem.color.value);
			setLocalStorage("bg", savedbgcol = userFormElem.bg.value);
			setLocalStorage("hideusers", (hideusers = userFormElem.hideusers.checked) ? "y" : "");
			setLocalStorage("hidechat", (hidechat = userFormElem.hidechat.checked) ? "y" : "");
			setLocalStorage("hidenametags", (hidenametags = userFormElem.hidenametags.checked) ? "y" : "");
			setLocalStorage("mutesounds", (mutesound = userFormElem.mutesounds.checked) ? "y" : "");
			setLocalStorage("imblind", (imblind = userFormElem.imblind.checked) ? "y" : "");
			setLocalStorage("pick", piecePickMode = userFormElem.elements["click"].value);
			setLocalStorage("renderer", userFormElem.renderer.value);
			bgcolorasnum = toRgbaNum(savedbgcol);
			if (useGPURenderer !== ("gpu" === userFormElem.renderer.value)) location.reload();

			isConnected && webSocket ? sendToWS({
				type: "user",
				name: savedname,
				color: savedcolor,
				room: globalThis.ROOM_NAME,
				secret: secretforthisroom
			}) : initConnection(), firstTextureLoadFinished = z = true, syncChatUserUiState();
			// not sure of the operator precedence between comma and ternary
		}
	}

	function startMusicAt(timeStarted, mid) {
		if (!roomdef.juke)
			return;
		let inaud = /** @type {HTMLAudioElement} */ (documentref.getElementById("jukeelem"));
		inaud.src = `/assets/pictures/${mid}.webm`;
		inaud.addEventListener("loadedmetadata", async () => {
			inaud.currentTime = (Date.now() - timeStarted) / 1000;
			try {
				await inaud.play();
			} catch (error) {
				if (!mutejuke) {
					["mousedown", "touchstart"].forEach(e => documentref.addEventListener(e, () => {
						inaud.play();
						inaud.currentTime = (Date.now() - timeStarted) / 1000;
					}, {
						once: true
					}));
				}
			}
		}, {
			once: true
		});
	}

	function executeDrawingCommands(e) {
		if (e.count) {
			if (e.buffers.length <= e.currentBuffer) {
				var t = gpucontext.createBuffer();
				gpucontext.bindBuffer(gpucontext.ARRAY_BUFFER, t);
				gpucontext.bufferData(gpucontext.ARRAY_BUFFER, e.vertices.byteLength, gpucontext.DYNAMIC_DRAW);
				e.buffers.push(t);
			}
			gpucontext.bindBuffer(gpucontext.ARRAY_BUFFER, e.buffers[e.currentBuffer]);
			gpucontext.bindBuffer(gpucontext.ELEMENT_ARRAY_BUFFER, e.indexBuffer);
			gpucontext.bufferSubData(gpucontext.ARRAY_BUFFER, 0, e.vertices.subarray(0, e.index));
			gpucontext.enableVertexAttribArray(0);
			gpucontext.enableVertexAttribArray(1);
			gpucontext.enableVertexAttribArray(2);
			gpucontext.vertexAttribPointer(0, 2, gpucontext.FLOAT, false, 40, 0);
			gpucontext.vertexAttribPointer(1, 4, gpucontext.FLOAT, false, 40, 8);
			gpucontext.vertexAttribPointer(2, 4, gpucontext.FLOAT, false, 40, 24);
			gpucontext.drawElements(gpucontext.TRIANGLES, 6 * e.count, gpucontext.UNSIGNED_SHORT, 0);
			gpucontext.bindBuffer(gpucontext.ARRAY_BUFFER, null);
			gpucontext.bindBuffer(gpucontext.ELEMENT_ARRAY_BUFFER, null);
			e.index = 0;
			e.count = 0;
			e.currentBuffer++;
		}
	}

	function setupVertex(verts, idx, x, y, u, v, o, s, red, green, blue, alpha) {
		verts[idx + 0 | 0] = x * transformMat2d[0] + y * transformMat2d[2] + transformMat2d[4];
		verts[idx + 1 | 0] = x * transformMat2d[1] + y * transformMat2d[3] + transformMat2d[5];
		verts[idx + 2 | 0] = u; // texture coordinates
		verts[idx + 3 | 0] = v;
		verts[idx + 4 | 0] = o;
		verts[idx + 5 | 0] = s;
		verts[idx + 6 | 0] = red;
		verts[idx + 7 | 0] = green;
		verts[idx + 8 | 0] = blue;
		verts[idx + 9 | 0] = alpha;
	}

	function setupVertexBuffer(graphicbuff, viewx, viewy, n, a, uvs0, uvt0, s, l, c, u, d, h, bgcolred, bgcolgreen, bgcolblue, bgcolalpha) {
		if (graphicbuff.count >= graphicbuff.capacity)
			executeDrawingCommands(graphicbuff);
		var vertices = graphicbuff.vertices;
		var index = graphicbuff.index;
		var w = viewx + n;
		var y = viewy + a;
		var T = uvs0 + s;
		var b = uvt0 + l;
		var E = c + d;
		var R = u + h;

		setupVertex(vertices, index + 0 | 0, viewx, viewy, uvs0, uvt0, c, u, bgcolred, bgcolgreen, bgcolblue, bgcolalpha);
		setupVertex(vertices, index + 10 | 0, w, viewy, T, uvt0, E, u, bgcolred, bgcolgreen, bgcolblue, bgcolalpha);
		setupVertex(vertices, index + 20 | 0, w, y, T, b, E, R, bgcolred, bgcolgreen, bgcolblue, bgcolalpha);
		setupVertex(vertices, index + 30 | 0, viewx, y, uvs0, b, c, R, bgcolred, bgcolgreen, bgcolblue, bgcolalpha);

		graphicbuff.count++;
		graphicbuff.index += 40;
	}

	function changeZoom(newViewX, newViewY, newViewScale) {
		var oldViewX = viewX;
		var oldViewY = viewY;
		var oldViewScale = viewScale;
		var deltaX = canvasClickX / viewScale - viewX;
		var deltaY = canvasClickY / viewScale - viewY;
		viewX = newViewX;
		viewY = newViewY;
		viewScale = newViewScale;
		updateRoomView();
		canvasClickX = (deltaX + viewX) * viewScale;
		canvasClickY = (deltaY + viewY) * viewScale;
		dragMove(pageClickX, pageClickY, true);
		firstTextureLoadFinished = z = z || oldViewX !== viewX || oldViewY !== viewY || oldViewScale !== viewScale;
	}

	function setZoom2(e__viewScale, t, r) {
		changeZoom(
			viewX + (t / e__viewScale - t / viewScale),
			viewY + (r / e__viewScale - r / viewScale),
			e__viewScale);
	}

	function zoomTo100() {
		changeZoom(
			-(boardWidth - windowref.innerWidth) / 2,
			-(boardHeight - windowref.innerHeight) / 2,
			1);
	}

	function moveCamera(t, r) {
		changeZoom(
			1 === t ? maxpiecewidth : 2 === t ? -boardWidth / 2 + windowref.innerWidth / (2 * viewScale) : -boardWidth + windowref.innerWidth / viewScale - maxpiecewidth,
			1 === r ? maxpieceheight : 2 === r ? -boardHeight / 2 + windowref.innerHeight / (2 * viewScale) : -boardHeight + windowref.innerHeight / viewScale - maxpieceheight,
			viewScale);
	}

	function setZoom(scale) {
		for (var w = 0, h = 0, i = 0, sets = localsetclone; i < sets.length; i++) {
			var set = sets[i];
			w += set.width;
			h += set.height;
		}
		const maxv = imblind ? 2 : 1;
		return clamp(scale, Math.min(.1, windowref.innerWidth / (1.5 * w), windowref.innerHeight / (1.5 * h)), maxv);
	}
	requestAnimationFrame((function doRender(timeStamp) {
		requestAnimationFrame(doRender);
		var r = performance.now();
		0;
		if ((canvaselem.width === windowref.innerWidth && canvaselem.height === windowref.innerHeight) == false) {
			canvaselem.width = windowref.innerWidth;
			canvaselem.height = windowref.innerHeight;
			firstTextureLoadFinished = true;
		};

		if (!useGPURenderer) {
			if ((canvaselem.width === actualBoardCanvas.width && canvaselem.height === actualBoardCanvas.height) == false) {
				actualBoardCanvas.width = canvaselem.width;
				actualBoardCanvas.height = canvaselem.height;
				z = true;
			}
		}

		if (edgePanX || edgePanY) {
			changeZoom(viewX + edgePanX * (r - k) * 1, viewY + edgePanY * (r - k) * 1, viewScale);
		}

		var n = r - k;
		k = r;
		if (roomdef.rotation)
			for (var a = 0, i = roomdefGroups; a < i.length; a++) {
				var o = i[a];
				if (o.angle !== o.targetAngle) {
					Vr(o);
					var s = .01 * n;
					o.angle < o.targetAngle ? o.angle = Math.min(o.angle + s, o.targetAngle) : o.angle = Math.max(o.angle - s, o.targetAngle), firstTextureLoadFinished = true, Vr(o);
				}
			}
		scaledViewWidth = windowref.innerWidth / viewScale;
		scaledViewHeight = windowref.innerHeight / viewScale;
		if (useGPURenderer) {
			if (gt.currentBuffer = 0, !firstTextureLoadFinished) {
				// @ts-ignore
				if (windowref.chrome) {
					gpucontext.enable(gpucontext.SCISSOR_TEST);
					gpucontext.scissor(0, 0, 1, 1);
					gpucontext.activeTexture(gpucontext.TEXTURE0);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, realImage);
					gpucontext.activeTexture(gpucontext.TEXTURE1);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, maskTexture);
					gpucontext.activeTexture(gpucontext.TEXTURE2);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, xt);
					gpucontext.useProgram(jigshader.program);
					setupVertexBuffer(gt, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
					executeDrawingCommands(gt);
					gpucontext.activeTexture(gpucontext.TEXTURE2);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
					gpucontext.activeTexture(gpucontext.TEXTURE1);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
					gpucontext.activeTexture(gpucontext.TEXTURE0);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
					gpucontext.disable(gpucontext.SCISSOR_TEST);
				}
			}
			initialMatrix[0] = viewScale * (2 / gpucontext.drawingBufferWidth);
			initialMatrix[5] = viewScale * (-2 / gpucontext.drawingBufferHeight);
			gpucontext.viewport(0, 0, gpucontext.drawingBufferWidth, gpucontext.drawingBufferHeight);
			gpucontext.clearColor(.1, .1, .1, 1), gpucontext.clear(gpucontext.COLOR_BUFFER_BIT);
			gpucontext.enable(gpucontext.BLEND);
			gpucontext.blendEquation(gpucontext.FUNC_ADD);
			gpucontext.blendFunc(gpucontext.ONE, gpucontext.ONE_MINUS_SRC_ALPHA);
			gpucontext.useProgram(boardShader.program);
			gpucontext.uniformMatrix4fv(boardShader.uniforms.transform, false, initialMatrix);
			setupVertexBuffer(gt, viewX, viewY, boardWidth, boardHeight, 0, 0, 0, 0, 0, 0, 0, 0, bgcolorasnum[0], bgcolorasnum[1], bgcolorasnum[2], 1);
			// draws the background color
			executeDrawingCommands(gt);
			gpucontext.activeTexture(gpucontext.TEXTURE0);
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, realImage);
			gpucontext.activeTexture(gpucontext.TEXTURE1);
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, maskTexture);
			gpucontext.activeTexture(gpucontext.TEXTURE2);
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, xt);
			gpucontext.useProgram(jigshader.program);
			gpucontext.uniformMatrix4fv(jigshader.uniforms.transform, false, initialMatrix);
			gpucontext.uniform1f(jigshader.uniforms.viewScale, viewScale);
			gpucontext.uniform2f(jigshader.uniforms.shadowOffset, -3 / H, -3 / G);
			gpucontext.uniform2f(jigshader.uniforms.shadowSpread, 10 / H, 10 / G);
			gpucontext.uniform1f(jigshader.uniforms.borderOpacity, borderOpacity);
			updateUniformColor(jigshader.uniforms.highlightColor, previousSelecter = yt);

			if (true) {
				for (var l = 0, c = roomdefGroups; l < c.length; l++) {
					var u = c[l];
					u.dragged || updateGroup(u);
				}
				for (var f = 0, v = groups__unknown; f < v.length; f++) {
					updateGroup(v[f]);
				}
				transformMat2d[0] = 1;
				transformMat2d[1] = 0;
				transformMat2d[2] = 0;
				transformMat2d[3] = 1;
				transformMat2d[4] = 0;
				transformMat2d[5] = 0;
                my_drawNear(); // MyEdit
				// draws the piece textures??
				executeDrawingCommands(gt);
			} else {
				gpucontext.useProgram(spriteShader.program);
				gpucontext.uniformMatrix4fv(spriteShader.uniforms.transform, false, initialMatrix);
				for (const group of roomdefGroups) {
					const {
						tx = 0, ty = 0, tw = 1, th = 1
					} = roomdef.sets[group.set];
					setupVertexBuffer(gt,
						group.x - group.w / 2 + viewX,
						group.y - group.h / 2 + viewY,
						group.w,
						group.h,
						tx, ty, tw, th, 0, 0, 0, 0, 0, 0, 0, 0);
				}
				executeDrawingCommands(gt);
			}
			gpucontext.activeTexture(gpucontext.TEXTURE2);
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
			gpucontext.activeTexture(gpucontext.TEXTURE1);
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
			if (previewVisible && !roomdef.hidePreview) {
				gpucontext.useProgram(spriteShader.program);
				gpucontext.uniformMatrix4fv(spriteShader.uniforms.transform, false, initialMatrix);
				for (var g = Math.min(600, windowref.innerHeight / 2), m = previewScale / viewScale, x = 0, w = R, y = R + localsetclone.length; w < y; w++) {
					var b = localsetclone[w % localsetclone.length],
						prevWid = b.width,
						prevHeigh = b.height,
						U = b.tx,
						X = b.ty,
						O = b.tw,
						P = b.th,
						N = g * (prevWid / prevHeigh);
					setupVertexBuffer(gt, 10 / viewScale + x, 40 / viewScale, N * m, g * m, U, X, O, P, 0, 0, 0, 0, 0, 0, 0, 0), x += N * m + 10 / viewScale;
				}
				// draws the preview
				executeDrawingCommands(gt);
			}
			if (records.length > 0 && discTexture) {
				gpucontext.activeTexture(gpucontext.TEXTURE0);
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, discTexture);
				gpucontext.useProgram(spriteShader.program);
				gpucontext.uniformMatrix4fv(spriteShader.uniforms.transform, false, initialMatrix);
				for (let rec of records) {
					setupVertexBuffer(gt,
						rec.pos[0] + viewX - 32,
						rec.pos[1] + viewY - 32,
						64,
						64,
						0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0);
				}
				// draws the records
				executeDrawingCommands(gt);
			}
			gpucontext.activeTexture(gpucontext.TEXTURE0);
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
			if (isBoxSelecting && selectionRectangleWidth && selectionRectangleHeight) {
				gpucontext.useProgram(boardShader.program);
				gpucontext.uniformMatrix4fv(boardShader.uniforms.transform, false, initialMatrix);
				var Y = .2;
				setupVertexBuffer(gt,
					selectionRectangleX0 + viewX, selectionRectangleY0 + viewY,
					selectionRectangleWidth, selectionRectangleHeight,
					0, 0, 0, 0, 0, 0, 0, 0, Y, Y, Y, Y);
				// draws the selection rectangle
				executeDrawingCommands(gt);
			}
		} else {
			// cpu rendering
			if (!firstTextureLoadFinished) return;
			z && (I.length = 0, I.push({
				x: 0,
				y: 0,
				w: canvaselem.width,
				h: canvaselem.height
			}));
			for (var B = 0; B < I.length; B++) {
				var W = I[B];
				cpucanvas3.width = W.w;
				cpucanvas3.height = W.h;
				boardOuterDrawingContext.fillStyle = "#191919";
				// draws out of bounds
				boardOuterDrawingContext.fillRect(0, 0, W.w, W.h);
				boardOuterDrawingContext.save();
				boardOuterDrawingContext.translate(-W.x, -W.y);
				boardOuterDrawingContext.scale(viewScale, viewScale);
				boardOuterDrawingContext.fillStyle = savedbgcol;
				// draws the background color
				boardOuterDrawingContext.fillRect(viewX, viewY, boardWidth, boardHeight);
				boardOuterDrawingContext.lineWidth = 5;
				boardOuterDrawingContext.strokeStyle = possibletransparentbgcol = "white";
				var q = W.x / viewScale,
					j = W.y / viewScale,
					J = q + W.w / viewScale,
					$ = j + W.h / viewScale;
				for (var Q = 0, Z = roomdefGroups; Q < Z.length; Q++) {
					var ne = Z[Q];
					ne.dragged || ne.user || drawPiecesCPU(boardOuterDrawingContext, ne, q, j, J, $);
				}
				boardOuterDrawingContext.restore();
				boardInnerDrawingContext.drawImage(cpucanvas3, W.x, W.y);
			}
			I.length = 0;
			cpuDrawingCtx2d.drawImage(actualBoardCanvas, 0, 0);
			cpuDrawingCtx2d.save();
			cpuDrawingCtx2d.scale(viewScale, viewScale);
			cpuDrawingCtx2d.lineWidth = 5;
			cpuDrawingCtx2d.strokeStyle = possibletransparentbgcol = "white";
			for (var ae = canvaselem.width / viewScale, ie = canvaselem.height / viewScale, le = 0, ce = roomdefGroups; le < ce.length; le++) {
				var ue = ce[le];
				ue.user && drawPiecesCPU(cpuDrawingCtx2d, ue, 0, 0, ae, ie);
			}
			for (var de = 0, he = groups__unknown; de < he.length; de++) {
				var fe = he[de];
				drawPiecesCPU(cpuDrawingCtx2d, fe, 0, 0, ae, ie);
			}
			cpuDrawingCtx2d.restore();
			if (previewVisible && !roomdef.hidePreview && Ct)
				for (var ge = Math.min(600, windowref.innerHeight / 2), pe = previewScale, be = 0, Ee = 0, Re = R, Ce = R + localsetclone.length; Re < Ce; Re++) {
					var ke = localsetclone[Re % localsetclone.length],
						Me = ke.imageWidth,
						_e = ke.imageHeight,
						De = ge * (Me / _e);
					// draws the preview
					cpuDrawingCtx2d.drawImage(Ct, be, 0, Me, _e, 10 + Ee, 40, De * pe, ge * pe);
					be += Me;
					Ee += De * pe + 10;
				}
			isBoxSelecting && selectionRectangleWidth && selectionRectangleHeight && (cpuDrawingCtx2d.save(),
				cpuDrawingCtx2d.fillStyle = "rgba(255, 255, 255, 0.2)",
				cpuDrawingCtx2d.scale(viewScale, viewScale),
				// draws the selection rectangle

				cpuDrawingCtx2d.fillRect(selectionRectangleX0 + viewX, selectionRectangleY0 + viewY, selectionRectangleWidth, selectionRectangleHeight),
				cpuDrawingCtx2d.restore());
		}
		firstTextureLoadFinished = false, z = false;

		nameTags.drawTags(viewX, viewY, viewScale, roomdefGroups);
	}));
	savedname ? initConnection() : syncUserFormState();
	addClickHandlers(getElementById("user-settings"), syncUserFormState);

	syncChatUserUiState();
	attachEvents(userFormElem, "submit", (function(e) {
		e.preventDefault(), startLogin();
	}));

	attachEvents(getElementById("userFormButton"), "click", startLogin);

	attachEvents(windowref, "resize", (function() {
		updateRoomView();
		setTimeout((function() {
			return chatLogElem.scrollTop = 1e6;
		}));
	}));

	attachEvents(windowref, "keydown", (function(t) {
		if (isConnected && !Q && (!t.target || !/^(input|textarea|select|button)$/i.test(t.target.tagName))) {
			if (!t.ctrlKey) switch (t.keyCode) {
				case 13: // Enter
					reveal();
					break;
				case 27: // escape
					helpFormElem.style.display = "none", userFormElem.style.display = "none", roomFormElement.style.display = "none";
					break;
				case 32: // Space
					if (groups__unknown.length || isBoxSelecting) return;
					var selection = roomdefGroups.filter(e => e.selected);
					if (selection.length > 1 && t.target == documentref.body) t.preventDefault();
					if (t.shiftKey && selection.length > 1) {
						const distance = (maxpiecewidth + maxpieceheight) / 4;
						const xs = selection.map(e => e.x);
						const ys = selection.map(e => e.y);
						const bbox = [
							[Math.min(...xs), Math.min(...ys)],
							[Math.max(...xs), Math.max(...ys)],
						];
						const mid = [(bbox[0][0] + bbox[1][0]) * 0.5, (bbox[0][1] + bbox[1][1]) * 0.5];

						for (const s of selection) {
							// direction to center of bounding box;
							const dir = [mid[0] - s.x, mid[1] - s.y];
							const dist = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
							let dirnorm_1o = 1 / dist;
							// if too close, move directly to middle of bbox
							if (Math.abs(dist) < distance) {
								s.x = mid[0];
								s.y = mid[1];
							} else {
								dir[0] *= distance * dirnorm_1o;
								dir[1] *= distance * dirnorm_1o;
								s.x += dir[0];
								s.y += dir[1];
							}
							preventMovementOOB(s); // prevent out of bounds?
							preventOOBRotation(s);
						}

						moveCommand(2, selection), firstTextureLoadFinished = !0;
						break;
					}
					if (selection.length > 1) {
						for (var distance = (maxpiecewidth + maxpieceheight) / 4, pair1 = 0; pair1 < selection.length; pair1++) {
							for (var p1 = selection[pair1], o = 0, s = 0, pair2 = 0; pair2 < selection.length; pair2++) {
								var p2 = selection[pair2];
								if (p2 !== p1) {
									var deltax = p1.x - p2.x,
										deltay = p1.y - p2.y,
										norm = deltax * deltax + deltay * deltay;
									if (norm) {
										var g = 1 / (norm * norm);
										o += deltax * g;
										s += deltay * g;
									}
								}
							}
							0 === o && (o = 2 * (Math.random() - .5)), 0 === s && (s = 2 * (Math.random() - .5));
							var p = Math.sqrt(o * o + s * s) || 1;
							p1.x += o / p * distance;
							p1.y += s / p * distance;
							preventMovementOOB(p1); // prevent out of bounds?
							preventOOBRotation(p1);
						}
						moveCommand(2, selection), firstTextureLoadFinished = true;
					}
					break;
				case 36: // $ //Home key
					zoomTo100();
					break;
				case 35: // # //End Key
					for (var m = 1e6, x = 0, w = 1e6, y = 0, T = 0, b = roomdefGroups; T < b.length; T++) {
						var E = b[T];
						m = Math.min(m, E.x - E.w / 2), x = Math.max(x, E.x + E.w / 2), w = Math.min(w, E.y - E.h / 2), y = Math.max(y, E.y + E.h / 2);
					}
					var R = x - m,
						C = y - w,
						k = setZoom(.9 * Math.min(windowref.innerWidth / R, windowref.innerHeight / C));
					changeZoom(-(m + x) / 2 + windowref.innerWidth / k / 2, -(w + y) / 2 + windowref.innerHeight / k / 2, k);
					break;
				case 46: // . //delete
					clearChatElems();
					break;
				case 65: // A
					moveCamera(1, 2);
					break;
				case 67: // C
					moveCamera(3, 3);
					break;
				case 68: // D
					moveCamera(3, 2);
					break;
				case 69: // E
					moveCamera(3, 1);
					break;
				case 70: // F
				case 71: // G
				case 37: // %
				case 39: // '
					if (roomdef.rotation) {
						var M = groups__unknown;
						if (M.length || (M = roomdefGroups.filter((function(e) {
								return e.selected;
							}))), !M.length) break;
						turn(M, 71 === t.keyCode || 39 === t.keyCode);
					}
					break;
				case 81: // Q
					moveCamera(1, 1);
					break;
				case 82: // R
					Pe();
					break;
				case 83: // S
					moveCamera(2, 2);
					break;
				case 87: // W
					moveCamera(2, 1);
					break;
				case 88: // X
					moveCamera(2, 3);
					break;
				case 90: // Z
					moveCamera(1, 3);
					break;
				case 107: //k
				case 187:
					setZoom2(setZoom(1.2 * viewScale), windowref.innerWidth / 2, windowref.innerHeight / 2);
					break;
				case 109: //m
				case 189:
					setZoom2(setZoom(.8 * viewScale), windowref.innerWidth / 2, windowref.innerHeight / 2);
			}
			if (t.ctrlKey && 90 === t.keyCode && releasedGroups) { //Ctrl+Z
				for (var undoneGroups = [], i = 0, groups = releasedGroups; i < groups.length; i++) {
					var releasedGroup = groups[i],
						group = transformedboard[releasedGroup.id];
					group && !group.user && group.pieces.length === releasedGroup.pieces && group.x === releasedGroup.endX && group.y === releasedGroup.endY && undoneGroups.push({
						id: group.id,
						x: releasedGroup.startX,
						y: releasedGroup.startY
					});
				}
				if (undoneGroups.length) {
					for (var i = 0; i < undoneGroups.length; i++) {
						var undoneGroup = undoneGroups[i],
							group = transformedboard[undoneGroup.id];
						group.x = undoneGroup.x, group.y = undoneGroup.y, preventOOBRotation(group);
					}
					moveCommand(1, undoneGroups), moveCommand(3, undoneGroups), firstTextureLoadFinished = true;
				}
			}
			if (t.keyCode >= 49 && t.keyCode <= 57 || t.keyCode >= 97 && t.keyCode <= 105) {
				t.preventDefault();
				var I = t.keyCode - (t.keyCode >= 97 ? 97 : 49);
				t.ctrlKey ? (viewsVar[I] = {
					x: viewX,
					y: viewY,
					scale: viewScale
				}, setLocalStorage("views", JSON.stringify(viewsVar))) : viewsVar[I] && changeZoom(viewsVar[I].x, viewsVar[I].y, viewsVar[I].scale);
			}
		}
	}));

	attachEvents(windowref, "wheel", (function(e) {
		if (e.deltaY) {
			var t = e.touches ? e.touches[0] : e,
				r = t.pageX,
				n = t.pageY,
				a = e.deltaY > 0 ? .9 : 1.1;
			setZoom2(setZoom(viewScale * a), r, n);
		}
	}));

	var hasSelected = false;

	function tryGetGroupAt(gameX, gameY, ctrlKey, ignoreHeld) {
		for (var i = roomdefGroups.length - 1; i >= 0; i--) {
			var group = roomdefGroups[i];
			if ((ctrlKey || !group.locked) && (posIsInGroup(gameX, gameY, group) && (hasSelected = true, !group.user || ignoreHeld))) return group;
		}
		for (var i = roomdefGroups.length - 1; i >= 0; i--) {
			var group = roomdefGroups[i];
			if ((ctrlKey || !group.locked) && (posIsInGroupSlot(gameX, gameY, group) && (hasSelected = true, !group.user || ignoreHeld))) return group;
		}
	}

	function setMobile() {
		isTouchEnabled || (documentref.body.classList.add("is-mobile"), isTouchEnabled = true);
	}

	attachEvents(canvaselem, ["mousedown", "touchstart"], (function(event) {
		event.preventDefault();
		closeDdMenus();

		if ("touchstart" === event.type)
			setMobile();

		preloadsoundeffects();
		if (!isConnected || Q) return;

		var mButton = event.button || 0;
		if (event.touches && event.touches.length > 1)
			if (groups__unknown.length) {
				var touch2 = getSecondTouch(event.touches, touch1Id);
				if (!touch2) return;
				Jt = true, touch2Id = touch2.identifier, panViewStart(touch2.pageX, touch2.pageY);
			} else isBoxSelecting = false, viewScaleStart = viewScale, touch1Id = event.touches[0].identifier, canvasClickX = touch1X = event.touches[0].pageX, canvasClickY = touch1Y = event.touches[0].pageY, touch2Id = event.touches[1].identifier, panViewStart(event.touches[1].pageX, event.touches[1].pageY);
		else if (0 === mButton) {
			if (!event.touches && "click" === piecePickMode && groups__unknown.length) return void releaseHeldGroups();
			if (event.touches) {
				var touch2 = getSecondTouch(event.touches, touch2Id);
				if (!touch2) return;
				touch1Id = touch2.identifier, canvasClickX = touch2.pageX, canvasClickY = touch2.pageY;
			} else canvasClickX = event.pageX, canvasClickY = event.pageY;
			ge = false, hasSelected = false, pe = false;
			var gameX = canvasClickX / viewScale - viewX,
				gameY = canvasClickY / viewScale - viewY,
				group = tryGetGroupAt(gameX, gameY, event.ctrlKey);
			for (let rec of records) {
				if (getDistance2d(gameX, gameY, ...rec.pos) < 32) {
					recordSolveCommand(rec.id);
				}
			}
			if (group) {
                my_markNear(group, gameX, gameY); // MyEdit
				event.ctrlKey ? canLock() &&
					(group.locked = !group.locked,
						group.selected &&
						(group.selected = false, selectCommand(5, [group])),
						selectCommand(group.locked ? 8 : 9, [group]),
						playsound(locksound), refreshLockedDisplay()) :
					event.shiftKey && canMultiselect() ?
					(group.selected = !group.selected,
						Vr(group),
						selectCommand(group.selected ? 4 : 5, [group])) :
					function(e__group) {
						if (!e__group.locked) {
							if (!e__group.selected) {
								for (var t = [], r = 0, n = roomdefGroups; r < n.length; r++) {
									var a = n[r];
									a.selected && (a.selected = false, t.push(a), Vr(a));
								}
								t.length && (selectCommand(5, t), pe = true);
							}
							if (e__group.selected)
								for (var i = 0, o__groups = roomdefGroups; i < o__groups.length; i++) {
									var s__group = o__groups[i];
									s__group.selected && s__group !== e__group && (s__group.startX = s__group.x, s__group.startY = s__group.y, s__group.dragged = true, groups__unknown.push(s__group));
								}
							e__group.startX = e__group.x, e__group.startY = e__group.y, e__group.dragged = true, groups__unknown.push(e__group);
							for (var l = 0, c = groups__unknown; l < c.length; l++) reorderGroupBySize(c[l]);
							moveCommand(1, groups__unknown), firstTextureLoadFinished = true;
						}
					}(group);
			} else {
				!hasSelected && canRectselect() && (isBoxSelecting = true, selectionRectangleX0 = gameX, selectionRectangleY0 = gameY, selectionRectangleWidth = 0, selectionRectangleHeight = 0);
				if (!canRectselect())
					sendunselected();
			}
		} else 1 !== mButton && 2 !== mButton || panViewStart(event.pageX, event.pageY);
	}));

	attachEvents(windowref, ["mousemove", "touchmove"], (function(e) {
		if (e.touches) {
			var touch1 = getTouchById(e.touches, touch1Id),
				touch2 = getTouchById(e.touches, touch2Id);
			if (isPanning) {
				if (!Jt) {
					if (touch2 && touch1) {
						var x1 = (panStartPosX + touch1X) / 2,
							y1 = (panStartPosY + touch1Y) / 2,
							dist1 = getDistance2d(panStartPosX, panStartPosY, touch1X, touch1Y),
							x2 = (touch1.pageX + touch2.pageX) / 2,
							y2 = (touch1.pageY + touch2.pageY) / 2,
							dist2 = getDistance2d(touch1.pageX, touch1.pageY, touch2.pageX, touch2.pageY),
							scale = setZoom(viewScaleStart * (dist2 / dist1));
						changeZoom(prePanViewX + (x2 / scale - x1 / viewScaleStart), prePanViewY + (y2 / scale - y1 / viewScaleStart), scale);
					}
					return;
				}
				if (touch2) {
					var u = (touch2.pageX - panStartPosX) / viewScale,
						d = (touch2.pageY - panStartPosY) / viewScale;
					changeZoom(prePanViewX + u, prePanViewY + d, viewScale);
				}
			}
			touch1 && dragMove(pageClickX = Math.max(0, touch1.pageX), pageClickY = Math.max(0, touch1.pageY), true);
		} else dragMove(pageClickX = e.pageX, pageClickY = e.pageY);
	}));

	attachEvents(windowref, ["mouseup", "touchend"], (function(e) {
		//e.preventDefault();
		if (e.touches) {
			var t1 = getTouchById(e.touches, touch1Id);
			var t2 = getTouchById(e.touches, touch2Id);
			!isBoxSelecting && !groups__unknown.length || t1 ||
				(releaseHeldGroups(), lr(e.shiftKey), touch1Id = -1),
				isPanning && (Jt && !t2 &&
					(isPanning = false, Jt = false, touch2Id = -1),
					Jt || t2 && t1 || (isPanning = false, t2 = -1, t1 = -1));
		} else {
			var groups, a = e.button,
				i = false,
				o = false,
				s = e.pageX / viewScale - viewX,
				l = e.pageY / viewScale - viewY,
				c = tryGetGroupAt(s, l);
			if (e.ctrlKey || e.shiftKey || (0 !== a || ge || "click" === piecePickMode || e.pageX !== canvasClickX || e.pageY !== canvasClickY ? 2 === a && e.pageX === panStartPosX && e.pageY === panStartPosY && (i = true, o = true, ge = true) : i = true), i) groups__unknown.length && !pe ? groups = groups__unknown : c && c.selected ? groups = roomdefGroups.filter((function(e) {
				return e.selected;
			})) : c && !pe && (groups = [c]), groups && groups.length && turn(groups, o);
			if (0 === a) {
				if ("click" !== piecePickMode && releaseHeldGroups(), lr(e.shiftKey), Date.now() - nr < 300) {
					var u = tryGetGroupAt(s, l, false, true);
					u && u.user && selectCommand(10, [u]);
				}
			} else 1 !== a && 2 !== a || (isPanning = false);
		}
        my_unmarkNear(); // MyEdit
		firstTextureLoadFinished = true, pe = false, nr = Date.now();
	}));

	attachEvents(windowref, "blur", (function() {
		releaseHeldGroups(), isBoxSelecting = false, isPanning = false;
	}));

	attachEvents(windowref, "contextmenu", (function(e) {
		return e.preventDefault();
	}));

	var viewScaleStart = 0;
	var Jt = false;
	var touch1Id = -1;
	var touch2Id = -1;

	function panViewStart(pageX, pageY) {
		isPanning = true, panStartPosX = pageX, panStartPosY = pageY, prePanViewX = viewX, prePanViewY = viewY;
	}

	function getSecondTouch(e__touches, t__ignoredTouch) {
		for (var r = 0; r < e__touches.length; r++)
			if (e__touches[r].identifier !== t__ignoredTouch)
				return e__touches[r];
	}

	function getTouchById(touches, touchId) {
		for (var i = 0; i < touches.length; i++)
			if (touches[i].identifier === touchId)
				return touches[i];
	}

	function getDistance2d(x1, y1, x2, y2) {
		var x = x1 - x2,
			y = y1 - y2;
		return Math.sqrt(x * x + y * y);
	}
	var nr = 0;

	function getEdgePan(pos, edge) {
		return pos <= 1 ? clamp(-pos / 200, 1, 10) : pos >= edge - 1 ? clamp(-(pos - edge) / 200, -10, -1) : 0;
	}

	function preventMovementOOB(e) {
		var t = 1 === e.rot || 3 === e.rot,
			r = t ? e.h : e.w,
			n = t ? e.w : e.h;
		e.x = calcPercent(clamp(e.x, r / 2, boardWidth - r / 2)), e.y = calcPercent(clamp(e.y, n / 2, boardHeight - n / 2));
	}

	function dragMove(pageX, pageY, preventPanning) {
		var gameX = (pageX - canvasClickX) / viewScale,
			gameY = (pageY - canvasClickY) / viewScale;
		if (groups__unknown.length) {
			for (var i = 0, groups = groups__unknown; i < groups.length; i++) {
				var group = groups[i];
				group.x = group.startX + gameX, group.y = group.startY + gameY, preventMovementOOB(group);
			}
			moveCommand(2, groups__unknown), firstTextureLoadFinished = true;
		} else isBoxSelecting && (selectionRectangleWidth = gameX, selectionRectangleHeight = gameY, firstTextureLoadFinished = true);
		preventPanning || (isPanning ? changeZoom(prePanViewX + (pageX - panStartPosX) / viewScale, prePanViewY + (pageY - panStartPosY) / viewScale, viewScale) : (groups__unknown.length || isBoxSelecting) && (edgePanX = getEdgePan(pageX, windowref.innerWidth) / viewScale, edgePanY = getEdgePan(pageY, windowref.innerHeight) / viewScale));
	}

	function releaseHeldGroups() {
		if (groups__unknown.length) {
			for (var e = 0, groups = groups__unknown; e < groups.length; e++) {
				var group = groups[e];
				group.dragged = false;
				preventOOBRotation(group);
				Vr(group);
			}
			moveCommand(3, groups__unknown); // release

			releasedGroups = groups__unknown.map((function(e) {
				return {
					id: e.id,
					pieces: e.pieces.length,
					startX: e.startX,
					startY: e.startY,
					endX: e.x,
					endY: e.y
				};
			}));

			1 === groups__unknown.length && function(droppedgroup) {
				groupsJoined = false;
				var set = localsetclone[droppedgroup.set];
				var cols = set.cols;
				var rows = set.rows;
				for (var i = 0, pieces = droppedgroup.pieces.slice(); i < pieces.length; i++) {
					var piece = pieces[i];
					piece.xi > 0 && (droppedgroup = collisionDetection(droppedgroup, piece, -1, 0));
					piece.yi > 0 && (droppedgroup = collisionDetection(droppedgroup, piece, 0, -1));
					piece.xi < cols - 1 && (droppedgroup = collisionDetection(droppedgroup, piece, 1, 0));
					piece.yi < rows - 1 && (droppedgroup = collisionDetection(droppedgroup, piece, 0, 1));
				}
				reorderGroupBySize(droppedgroup);
				groupsJoined && playsound(clicksound);
				if (groupsJoined && roomdefGroups.length === localsetclone.length) {
					borderOpacity = 0;
					if (dlBox)
						dlBox.style.display = 'inline';
					playsound(completesound);
				};
				return groupsJoined;
			}(groups__unknown[0]) && (releasedGroups = void 0);
			groups__unknown.length = 0;
		}
		edgePanX = edgePanY = 0;
		if (!canMultiselect()) {
			sendunselected();
		}
	}

	function lr(e) {
		if (isBoxSelecting) {
			for (var t = [], r = [], n = 0, a = roomdefGroups; n < a.length; n++) {
				var i = a[n];
				if (!i.user && !i.locked) {
					var o = kr(i, selectionRectangleX0, selectionRectangleY0, selectionRectangleWidth, selectionRectangleHeight);
					e && (o = i.selected || o), i.selected !== o && (i.selected = o, Vr(i), o ? t.push(i) : r.push(i));
				}
			}
			r.length && selectCommand(5, r), t.length && selectCommand(4, t), isBoxSelecting = false;
		}
	}

	function sendunselected() {
		for (var deselected = [], i = 0, groups = roomdefGroups; i < groups.length; i++) {
			var group = groups[i];
			group.selected && (group.selected = false, deselected.push(group));
		}
		deselected.length && selectCommand(5, deselected);
	}

	function seededrandom() {
		var e = 1e4 * Math.sin(seed);
		return seed += 1, e - Math.floor(e);
	}

	function randominterval(e, t) {
		return e + (seededrandom() + seededrandom() + seededrandom() + seededrandom()) / 4 * (t - e);
	}

	let flipflop = (() => {
		let s = false;
		return () => s = !s;
	})();

	function generateNubCoefficients(jitter, prev, fc) {
		let flip = seededrandom() > .5;
		if (roomdef.zigzag) {
			if (prev && !fc) {
				flip = !prev.flip;
			}
		}
		return {
			flip,
			//a: 0, b: 0, c: 0, d: 0, e: 0,
			a: randominterval(-jitter, .9 * jitter),
			b: randominterval(-jitter, .9 * jitter),
			c: randominterval(-jitter, .9 * jitter),
			d: randominterval(-jitter, .9 * jitter),
			e: randominterval(-jitter, .9 * jitter)
		};
	}

	function drawNubPath(ctx, flagB, flagA, width, height, isVertical, isConnectedToBR, shapeDef, tabsize, pointa, pointb, isFirst) {
		var isHorizontal = !isVertical,
			cpLength = isHorizontal ? height : width,
			cpWidth = isHorizontal ? width : height,
			flagC = isHorizontal ? flagA : flagB,
			flagD = isHorizontal ? flagB : flagA,
			bendDirection = shapeDef && shapeDef.flip ? -1 : 1,
			originX = 0 + (isHorizontal ? pointa.y : pointa.x),
			originY = 0 + (isHorizontal ? pointa.x : pointa.y),
			targetX = 1 + (isHorizontal ? pointb.y : pointb.x),
			targetY = 0 + (isHorizontal ? pointb.x : pointb.y);

		function generateControlPoint(paramA, paramB) {
			var r = flagC + paramA;
			return {
				l: cpLength * (r * (targetX - originX) + originX),
				w: cpWidth * (r * (targetY - originY) + (flagD + paramB * bendDirection) + originY)
			};
		}
		var CPorigin = generateControlPoint(0, 0),
			CPend = generateControlPoint(1, 0);
		if (isFirst)
			ctx.moveTo(CPorigin.l, CPorigin.w);
		if (shapeDef) {
			var coefA = shapeDef.a,
				coefB = shapeDef.b,
				coefC = shapeDef.c,
				coefD = shapeDef.d,
				coefE = shapeDef.e,
				cpoint0 = generateControlPoint(.2, coefA),
				cpoint1 = generateControlPoint(.5 + coefB + coefD, -tabsize + coefC),
				cpoint2 = generateControlPoint(.5 - tabsize + coefB, tabsize + coefC),
				cpoint3 = generateControlPoint(.5 - 2 * tabsize + coefB - coefD, 3 * tabsize + coefC),
				cpoint4 = generateControlPoint(.5 + 2 * tabsize + coefB - coefD, 3 * tabsize + coefC),
				cpoint5 = generateControlPoint(.5 + tabsize + coefB, tabsize + coefC),
				cpoint6 = generateControlPoint(.5 + coefB + coefD, -tabsize + coefC),
				cpoint7 = generateControlPoint(.8, coefE);
			if (isVertical) {
				if (isConnectedToBR) {
					ctx.bezierCurveTo(cpoint7.l, cpoint7.w, cpoint6.l, cpoint6.w, cpoint5.l, cpoint5.w);
					ctx.bezierCurveTo(cpoint4.l, cpoint4.w, cpoint3.l, cpoint3.w, cpoint2.l, cpoint2.w);
					ctx.bezierCurveTo(cpoint1.l, cpoint1.w, cpoint0.l, cpoint0.w, CPorigin.l, CPorigin.w);
				} else {
					ctx.bezierCurveTo(cpoint0.l, cpoint0.w, cpoint1.l, cpoint1.w, cpoint2.l, cpoint2.w);
					ctx.bezierCurveTo(cpoint3.l, cpoint3.w, cpoint4.l, cpoint4.w, cpoint5.l, cpoint5.w);
					ctx.bezierCurveTo(cpoint6.l, cpoint6.w, cpoint7.l, cpoint7.w, CPend.l, CPend.w);
				}
			} else {
				if (isConnectedToBR) {
					ctx.bezierCurveTo(cpoint7.w, cpoint7.l, cpoint6.w, cpoint6.l, cpoint5.w, cpoint5.l);
					ctx.bezierCurveTo(cpoint4.w, cpoint4.l, cpoint3.w, cpoint3.l, cpoint2.w, cpoint2.l);
					ctx.bezierCurveTo(cpoint1.w, cpoint1.l, cpoint0.w, cpoint0.l, CPorigin.w, CPorigin.l);
				} else {
					ctx.bezierCurveTo(cpoint0.w, cpoint0.l, cpoint1.w, cpoint1.l, cpoint2.w, cpoint2.l);
					ctx.bezierCurveTo(cpoint3.w, cpoint3.l, cpoint4.w, cpoint4.l, cpoint5.w, cpoint5.l);
					ctx.bezierCurveTo(cpoint6.w, cpoint6.l, cpoint7.w, cpoint7.l, CPend.w, CPend.l);
				}
			}
		} else if (isVertical) {
			if (isConnectedToBR)
				ctx.lineTo(CPorigin.l, CPorigin.w);
			else
				ctx.lineTo(CPend.l, CPend.w);
		} else {
			if (isConnectedToBR)
				ctx.lineTo(CPorigin.w, CPorigin.l);
			else
				ctx.lineTo(CPend.w, CPend.l);
		}
	}

	function drawJigShapePath(ctx, xcoordinate, ycoordinate, pieceBounds) {
		ctx.save();
		ctx.translate(xcoordinate, ycoordinate);

		drawNubPath(ctx, 0, 0, pieceBounds.width, pieceBounds.height, true, false, pieceBounds.top, roomdef.tabSize, pieceBounds.tl, pieceBounds.tr, true);
		drawNubPath(ctx, 1, 0, pieceBounds.width, pieceBounds.height, false, false, pieceBounds.right, roomdef.tabSize, pieceBounds.tr, pieceBounds.br);
		drawNubPath(ctx, 0, 1, pieceBounds.width, pieceBounds.height, true, true, pieceBounds.bottom, roomdef.tabSize, pieceBounds.bl, pieceBounds.br);
		drawNubPath(ctx, 0, 0, pieceBounds.width, pieceBounds.height, false, true, pieceBounds.left, roomdef.tabSize, pieceBounds.tl, pieceBounds.bl);
		ctx.closePath();
		ctx.restore();
	}

	function getRotatedX(rotation, x, y) {
		switch (rotation) {
			case 0:
				return x;
			case 1:
				return -y;
			case 2:
				return -x;
			case 3:
				return y;
			default:
				return 0;
		}
	}

	function getRotatedY(rotation, x, y) {
		switch (rotation) {
			case 0:
				return y;
			case 1:
				return x;
			case 2:
				return -y;
			case 3:
				return -x;
			default:
				return 0;
		}
	}

	function preventOOBRotation(group) {
		for (var i = 0, pieces = group.pieces; i < pieces.length; i++) {
			var piece = pieces[i];
			piece.globalX = group.x + getRotatedX(group.rot, piece.x, piece.y);
			piece.globalY = group.y + getRotatedY(group.rot, piece.x, piece.y);
			piece.rot = group.rot;
		}
	}

	/**
	 * Rotate groups by one turn
	 * @param {Group[]} groups
	 * @param {boolean} clockwise
	 */
	function turn(groups, clockwise) {
		if (!roomdef.rotation) return;
		groups.forEach(group => setGroupRotation(group, (group.rot + (clockwise ? 1 : 3)) % 4));

		const bytes = 3 + 3 * groups.length;
		allocateCommandBuffer(CMD_TYPE.ROTATE, bytes);
		for (let i = 0, offset = 3; i < groups.length; i++, offset += 3) {
			tmpbufferview.setUint16(offset, groups[i].id, true);
			tmpbufferview.setUint8(offset + 2, groups[i].rot);
		}
		uploadCommandBuffer(tmpbuffer.subarray(0, bytes));
	}

	function updateGroupPieces(group) {
		for (var xMin = 1e6, yMin = 1e6, xMax = 0, yMax = 0, i = 0, pieces = group.pieces; i < pieces.length; i++) {
			var piece = pieces[i];
			xMin = Math.min(xMin, piece.xi), yMin = Math.min(yMin, piece.yi), xMax = Math.max(xMax, piece.xi), yMax = Math.max(yMax, piece.yi);
		}
		for (var set = localsetclone[group.set], w = set.pieceWidth, h = set.pieceHeight, xOffset = -(xMax - xMin) * w / 2, yOffset = -(yMax - yMin) * h / 2, i = 0, pieces = group.pieces; i < pieces.length; i++) {
			(piece = pieces[i]).x = (piece.xi - xMin) * w + xOffset, piece.y = (piece.yi - yMin) * h + yOffset;
		}
		group.w = (xMax - xMin + 1) * w, group.h = (yMax - yMin + 1) * h;
	}

	/**@returns {Group} */
	function mergeGroups(groupA, groupB, preferA) {
		for (var xMin = 1e6, yMin = 1e6, xMax = 0, yMax = 0, targetGroup = preferA && groupA.pieces.length > groupB.pieces.length ? groupA : groupB, i = 0, pieces = targetGroup.pieces; i < pieces.length; i++) {
			var piece = pieces[i];
			xMin = Math.min(xMin, piece.xi), yMin = Math.min(yMin, piece.yi), xMax = Math.max(xMax, piece.xi), yMax = Math.max(yMax, piece.yi);
		}
		for (var i = 0, pieces = groupA.pieces; i < pieces.length; i++) {
			var piece = pieces[i];
			groupB.pieces.push(piece);
		}
		var targetW = targetGroup.w,
			targetH = targetGroup.h;
		updateGroupPieces(groupB);
		for (var xMinB = 1e6, yMinB = 1e6, xMaxB = 0, yMaxB = 0, i = 0, b = groupB.pieces; i < b.length; i++) {
			var E = b[i];
			xMinB = Math.min(xMinB, E.xi), yMinB = Math.min(yMinB, E.yi), xMaxB = Math.max(xMaxB, E.xi), yMaxB = Math.max(yMaxB, E.yi);
		}
		var set = localsetclone[groupB.set],
			w = set.pieceWidth,
			h = set.pieceHeight,
			x = -targetW / 2 + (xMinB - xMin) * w + groupB.w / 2,
			y = -targetH / 2 + (yMinB - yMin) * h + groupB.h / 2,
			xOffset = getRotatedX(groupB.rot, x, y),
			yOffset = getRotatedY(groupB.rot, x, y);
		groupB.x = targetGroup.x + xOffset, groupB.y = targetGroup.y + yOffset, preventMovementOOB(groupB), preventOOBRotation(groupB), extractFromArray(roomdefGroups, groupA), Vr(groupA);
		for (var i = 0, ids = groupA.ids; i < ids.length; i++) {
			var id = ids[i];
			groupB.ids.push(id);
		}
		groupB.ids.push(Math.min(groupA.id, groupB.id)), groupB.id = Math.max(groupA.id, groupB.id), groupB.locked = groupA.locked || groupB.locked, groupB.user = void 0, groupB.selectedByOther = false, transformedboard[groupB.id] = groupB;
		for (var i = 0, ids = groupB.ids; i < ids.length; i++) {
			var id = ids[i];
			transformedboard[id] = groupB;
		}
		return updateDonePercent(), groupB;
	}
	var groupsJoined = false;

	function collisionDetection(group, piece, relX, relY) {
		var set = localsetclone[group.set];
		if (set) {
			var neighborPiece = setPieces[group.set][piece.xi + relX + (piece.yi + relY) * set.cols];
			if (-1 === group.pieces.indexOf(neighborPiece) && piece.rot === neighborPiece.rot) {
				var width = relX * set.pieceWidth,
					height = relY * set.pieceHeight,
					x = getRotatedX(piece.rot, width, height),
					y = getRotatedY(piece.rot, width, height);
				const minimumdim = Math.min(neighborPiece.puzzle.width, neighborPiece.puzzle.height) * 0.25;
				if (getDistance2d(neighborPiece.globalX, neighborPiece.globalY, piece.globalX + x, piece.globalY + y) < minimumdim) {
					var neighborGroup = roomdefGroups.find((function(g) {
						return -1 !== g.pieces.indexOf(neighborPiece);
					}));
					if (!neighborGroup) throw new Error("no group");
					if (!neighborGroup.user) {
						var groupId = group.id,
							neighborId = neighborGroup.id;
						groupId !== neighborId && (function(groupId, neighborId, x, y) {
							var bytes = 15;
							allocateCommandBuffer(6, bytes);
							tmpbufferview.setUint16(3, groupId, true);
							tmpbufferview.setUint16(5, neighborId, true);
							tmpbufferview.setFloat32(7, x, true);
							tmpbufferview.setFloat32(11, y, true);
							uploadCommandBuffer(tmpbuffer.subarray(0, bytes));
						}(groupId, neighborId, (group = mergeGroups(group, neighborGroup, groupsJoined)).x, group.y), groupsJoined = true);
					}
				}
			}
		}
		return group;
	}

	function posIsInPiece(x, y, piece) {
		var xMin = piece.x + piece.spriteX,
			yMin = piece.y + piece.spriteY,
			xMax = xMin + piece.spriteW,
			yMax = yMin + piece.spriteH;
		return x > xMin && y > yMin && x < xMax && y < yMax;
	}

	function posIsInGroup(gameX, gameY, group) {
		gameX -= group.x, gameY -= group.y;
		for (var rot = (4 - group.rot) % 4, groupX = getRotatedX(rot, gameX, gameY), groupY = getRotatedY(rot, gameX, gameY), i = 0, pieces = group.pieces; i < pieces.length; i++) {
			var piece = pieces[i];
			if (posIsInPiece(groupX, groupY, piece) && (cpudrawingcontext.beginPath(), drawJigShapePath(cpudrawingcontext, piece.x + piece.puzzleX, piece.y + piece.puzzleY, piece.puzzle), cpudrawingcontext.isPointInPath(groupX, groupY))) return true;
		}
		return false;
	}

	function posIsInGroupSlot(gameX, gameY, group) {
		gameX -= group.x, gameY -= group.y;
		for (var rot = (4 - group.rot) % 4, groupX = getRotatedX(rot, gameX, gameY), groupY = getRotatedY(rot, gameX, gameY), set = localsetclone[group.set], pieceWidth = set.pieceWidth, pieceHeight = set.pieceHeight, i = 0, pieces = group.pieces; i < pieces.length; i++) {
			var piece = pieces[i];
			if (posIsInPiece(groupX, groupY, piece)) {
				var xMin = piece.x + piece.puzzleX - 5,
					yMin = piece.y + piece.puzzleY - 5;
				if (groupX > xMin && groupY > yMin && groupX < xMin + pieceWidth + 10 && groupY < yMin + pieceHeight + 10) return true;
			}
		}
		return false;
	}

	function kr(e, t, r, n, a) {
		n < 0 && (t += n, n = -n), a < 0 && (r += a, a = -a);
		for (var i = 1 === e.rot || 3 === e.rot, o = localsetclone[e.set], s = o.pieceWidth, l = o.pieceHeight, c = i ? l : s, u = i ? s : l, d = 0, f = e.pieces; d < f.length; d++) {
			var v = f[d],
				g = v.globalX + v.puzzleX,
				p = v.globalY + v.puzzleY;
			if (t <= g + c && t + n >= g && r <= p + u && r + a >= p) return true;
		}
		return false;
	}
	var Mr = false,
		_r = false,
		GPUInitFailed = false,
		Ar = [];

	function loadpicture(e, t) {
		var image = new Image;
		image.onload = function() {
			if (Ar[t] = image, Ar.every((function(e) {
					return e;
				}))) try {
				if (GPUInitFailed) return;
				Q = false, loadingBoxElem.style.display = "none", useGPURenderer ? function() {
					Mr = true;
					var e = Ar.length > 1,
						t = Pr(),
						r = t.wCount,
						n = t.hCount;
					Sr(Ar);
					cpucanvas.width = Et;
					cpucanvas.height = Rt;
					cpudrawingcontext.fillStyle = "white";
					cpudrawingcontext.fillRect(0, 0, cpucanvas.width, cpucanvas.height);
					for (var a = 0; a < Ar.length; a++) {
						var i = Ar[a];
						if (e) {
							var o = 8;
							var s = Et / r;
							var l = Rt / n;
							var c = s - o;
							var u = l - o;
							var d = s * (a % 2);
							var h = l * Math.floor(a / 2);
							cpudrawingcontext.drawImage(i, 0, 0, 1, 1, d, h, o / 2, o / 2);
							cpudrawingcontext.drawImage(i, i.width - 1, 0, 1, 1, d + c + o / 2, h, o / 2, o / 2);
							cpudrawingcontext.drawImage(i, 0, i.height - 1, 1, 1, d, h + u + o / 2, o / 2, o / 2);
							cpudrawingcontext.drawImage(i, i.width - 1, i.height - 1, 1, 1, d + c + o / 2, h + u + o / 2, o / 2, o / 2);
							cpudrawingcontext.drawImage(i, 0, 0, 1, i.height, d, h + o / 2, o / 2, u);
							cpudrawingcontext.drawImage(i, i.width - 1, 0, 1, i.height, d + c + o / 2, h + o / 2, o / 2, u);
							cpudrawingcontext.drawImage(i, 0, 0, i.width, 1, d + o / 2, h, c, o / 2);
							cpudrawingcontext.drawImage(i, 0, i.height - 1, i.width, 1, d + o / 2, h + u + o / 2, c, o / 2);
							cpudrawingcontext.drawImage(i, 0, 0, i.width, i.height, d + o / 2, h + o / 2, c, u);
						} else {
							var f = Et / r,
								v = Rt / n,
								g = f * (a % 2),
								p = v * Math.floor(a / 2);
							cpudrawingcontext.drawImage(i, 0, 0, i.width, i.height, g, p, f, v);
						}
					}
					realImage = realImage || createTexture();
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, realImage);
					gpucontext.texImage2D(gpucontext.TEXTURE_2D, 0, gpucontext.RGB, gpucontext.RGB, gpucontext.UNSIGNED_BYTE, cpucanvas);
					gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MAG_FILTER, gpucontext.LINEAR);
					gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MIN_FILTER, gpucontext.LINEAR_MIPMAP_LINEAR);
					gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_S, gpucontext.CLAMP_TO_EDGE);
					gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_T, gpucontext.CLAMP_TO_EDGE);
					gpucontext.generateMipmap(gpucontext.TEXTURE_2D);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
					firstTextureLoadFinished = true;
				}() : initRenderingBackend();
			} catch (e) {
				errorhandler(e);
			}
		}, image.onerror = errorhandler, image.src = e;
	}

	async function loadTexture(asset, magfilter = gpucontext.LINEAR, minfilter = gpucontext.LINEAR_MIPMAP_LINEAR) {
		const url = `/assets/` + asset;
		const image = new Image;
		return new Promise((res, rej) => {
			image.onload = () => {
				const newtexture = createTexture();
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, newtexture);
				gpucontext.texImage2D(gpucontext.TEXTURE_2D, 0, gpucontext.RGBA, gpucontext.RGBA, gpucontext.UNSIGNED_BYTE, image);
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MAG_FILTER, gpucontext.LINEAR);
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MIN_FILTER, gpucontext.LINEAR_MIPMAP_LINEAR);
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_S, gpucontext.CLAMP_TO_EDGE);
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_T, gpucontext.CLAMP_TO_EDGE);
				gpucontext.generateMipmap(gpucontext.TEXTURE_2D);
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);

				res(newtexture);
			};
			image.onerror = rej;
			image.src = url;
		});
	}

	function startLoading() {
		try {
			if (_r) return Q = false, loadingBoxElem.style.display = "none", void initRoomData();
			_r = true, loadingBoxElem.style.display = "block", loadingTextElem.textContent = "Loading...", Mr = false, GPUInitFailed = false, Ar = roomdef.sets.map((function() {}));
			for (var e = 0; e < roomdef.sets.length; e++) loadpicture("/assets/pictures/" + roomdef.sets[e].image, e);
			gpucontext && loadTexture("record.png").then(t => discTexture = t);
			if (useGPURenderer) try {
				initRenderingBackend();
			} catch (e) {
				GPUInitFailed = true, errorhandler(e);
			}
		} catch (e) {
			errorhandler(e);
		}
	}

	function errorhandler(e) {
		console.error(e);
		var t = "Error occurred, reload to continue";
		"NS_ERROR_FAILURE" === e.name && (t = "Error while initializing graphics, try not using a shit browser"), loadingTextElem.textContent = t;
	}

	function Pr() {
		return {
			wCount: roomdef.sets.length > 1 ? 2 : 1,
			hCount: roomdef.sets.length > 2 ? 2 : 1
		};
	}

	function Sr(e) {
		var t = 4096;
		var r = Pr();
		var n = r.wCount;
		var a = r.hCount;
		var i = 0;
		var o = 0;
		for (var s = 0; s < e.length; s++) {
			var l = e[s],
				c = l.width,
				u = l.height;
			i = Math.max(i, c), o = Math.max(o, u);
		}
		if (ct && 1 === e.length) {
			var d = e[0],
				h = d.width,
				f = d.height;
			h < f ? (Rt = Math.min(f, t), Et = Math.round(h * Rt / f)) : (Et = Math.min(h, t), Rt = Math.round(f * Et / h));
		} else Et = Math.min(powoftwo(i * n), t), Rt = Math.min(powoftwo(o * a), t);
	}

	function randomtenth() {
		return randominterval(-.1, .1);
	}

	function rndxtenth() {
		return {
			x: randomtenth(),
			y: 0
		};
	}

	function rndytenth() {
		return {
			x: 0,
			y: randomtenth()
		};
	}

	function initRenderingBackend() {
		localsetclone = roomdef.sets.slice();
		var e = ct || !useGPURenderer,
			r = Pr(),
			n = r.wCount,
			a = r.hCount;
		maxpiecewidth = 0, maxpieceheight = 0;
		for (var maskX = 0, maskY = 0, s = 0, l = 0, c = 0, localsetclone2 = localsetclone; c < localsetclone2.length; c++) {
			var localset = localsetclone2[c],
				v = Math.round(localset.width / localset.cols),
				g = Math.round(localset.height / localset.rows),
				p = Math.round(.4 * Math.min(v, g)),
				m = g + 2 * p,
				x = (v + 2 * p) * localset.cols,
				w = m * localset.rows;
			maxpiecewidth = Math.max(maxpiecewidth, v);
			maxpieceheight = Math.max(maxpieceheight, g);

			if (maskX + x > 16384 && (maskX = 0, (maskY = l) + w > 16384)) throw new Error("Exceeded texture size limit");
			localset.maskX = maskX;
			localset.maskY = maskY;
			localset.pieceWidth = v;
			localset.pieceHeight = g;
			l = Math.max(l, maskY + w);
			s = Math.max(s, maskX + x);
			maskX += x;
		}
		H = e ? s : powoftwo(s);
		G = e ? l : powoftwo(l);
		cpucanvas.width = H;
		cpucanvas.height = G;
		cpudrawingcontext.fillStyle = "white";
		cpudrawingcontext.strokeStyle = useGPURenderer ? "black" : "rgba(0, 0, 0, 0.3)";
		cpudrawingcontext.lineWidth = 1.2;
		setPieces = [];
		localsetclone.length > 1 && Sr(localsetclone.map((function(e) {
			return {
				width: e.imageWidth,
				height: e.imageHeight
			};
		})));
		for (var y = 0, T = localsetclone; y < T.length; y++) {
			var b = T[y],
				E = localsetclone.indexOf(b),
				actualtexture = Ar[E],
				pieceWidth1 = b.pieceWidth,
				pieceHeight1 = b.pieceHeight,
				fourtyPctOfSmallestDim = Math.round(.4 * Math.min(pieceWidth1, pieceHeight1)),
				_ = pieceWidth1 + 2 * fourtyPctOfSmallestDim,
				D = pieceHeight1 + 2 * fourtyPctOfSmallestDim;
			useGPURenderer && localsetclone.length > 1 ? (b.tx = 1 / n * (E % 2) + 4 / Et, b.ty = 1 / a * Math.floor(E / 2) + 4 / Rt, b.tw = 1 / n - 8 / Et, b.th = 1 / a - 8 / Rt) : (b.tx = 1 / n * (E % 2), b.ty = 1 / a * Math.floor(E / 2), b.tw = 1 / n, b.th = 1 / a);
			for (var A = b.tw / b.cols, U = b.th / b.rows, X = A * (_ / pieceWidth1), O = U * (D / pieceHeight1), P = -(X - A) / 2, I = -(O - U) / 2, N = _ / H, L = D / G, B = {
					x: 0,
					y: 0
				}, W = [], K = 0, V = 0, rowindex = 0, $ = 0; rowindex < b.rows; rowindex++)
				for (var columnindex = 0; columnindex < b.cols; columnindex++, $++) {
					var pieceOfPreviousCol = W[columnindex - 1 + rowindex * b.cols];
					var pieceOfPreviousRow = W[columnindex + (rowindex - 1) * b.cols];
					var firstcol = 0 === columnindex;
					var lastcol = columnindex === b.cols - 1;
					var firstrow = 0 === rowindex;
					var lastrow = rowindex === b.rows - 1;
					var rx = randomtenth();
					var ry = randomtenth();
					const baseChance = 0.03;
					//console.log(rx > baseChance, ry> baseChance);
					var edge = !(!firstcol && !lastcol && !firstrow && !lastrow);
					var fakeX = !edge && roomdef.fakeEdge && !lastrow && ((rx) * + +roomdef.fakeEdge) > baseChance;
					var fakeY = !edge && roomdef.fakeEdge && !lastcol && ((ry) * + +roomdef.fakeEdge) > baseChance;
					// if the previous on the same axis was faked, we can't fake the other on the same axis
					if (!edge) {
						if (!pieceOfPreviousRow.puzzle.bottom || rowindex === b.rows - 2)
							fakeY = false;
						if (!pieceOfPreviousCol.puzzle.right || columnindex === b.cols - 2)
							fakeX = false;
						// if the next piece is
					}
					//console.log(((rx + 0.1) * + +roomdef.fakeEdge));
					var sq = roomdef.fakeEdge || roomdef.square;
					var top = firstrow ? void 0 : pieceOfPreviousRow.puzzle.bottom;
					var bottom = (lastrow || fakeY) ? void 0 : generateNubCoefficients(roomdef.jitter, pieceOfPreviousCol?.puzzle?.bottom, firstcol);
					var left = firstcol ? void 0 : pieceOfPreviousCol.puzzle.right;
					var right = (lastcol || fakeX) ? void 0 : generateNubCoefficients(roomdef.jitter, pieceOfPreviousRow?.puzzle?.right);
					var pieceShape = {
							width: pieceWidth1,
							height: pieceHeight1,
							top: top,
							bottom: bottom,
							left: left,
							right: right,
							tl: firstcol ? firstrow ? B : pieceOfPreviousRow.puzzle.bl : pieceOfPreviousCol.puzzle.tr,
							tr: firstrow ? lastcol ? B : (sq ? {
								x: 0,
								y: 0
							} : rndxtenth()) : pieceOfPreviousRow.puzzle.br,
							bl: firstcol ? lastrow ? B : (sq ? {
								x: 0,
								y: 0
							} : rndytenth()) : pieceOfPreviousCol.puzzle.br,
							br: lastcol ? lastrow ? B : (sq ? {
								x: 0,
								y: 0
							} : rndytenth()) : lastrow ? ((sq ? {
								x: 0,
								y: 0
							} : rndxtenth())) : {
								x: sq ? 0 : randomtenth(),
								y: sq ? 0 : randomtenth()
							}
						},
						he = (left && left.flip ? -1 : 1) * (.05 + (left ? .5 * left.c : 0)),
						fe = (right && right.flip ? 1 : -1) * (.05 + (right ? .5 * right.c : 0)),
						ve = (top && top.flip ? -1 : 1) * (.05 + (top ? .5 * top.c : 0)),
						ge = (bottom && bottom.flip ? 1 : -1) * (.05 + (bottom ? .5 * bottom.c : 0));
					he += (pieceShape.tl.x + pieceShape.bl.x) / 2 * .5;
					fe -= (pieceShape.tr.x + pieceShape.br.x) / 2 * .5;
					ve += (pieceShape.tl.y + pieceShape.tr.y) / 2 * .5;
					ge -= (pieceShape.bl.y + pieceShape.br.y) / 2 * .5;
					cpudrawingcontext.save();
					cpudrawingcontext.translate(b.maskX + _ * K, b.maskY + D * V);
					cpudrawingcontext.beginPath();
					drawJigShapePath(cpudrawingcontext, fourtyPctOfSmallestDim, fourtyPctOfSmallestDim, pieceShape);
					cpudrawingcontext.closePath();
					cpudrawingcontext.fill();
					var pe = 0,
						me = 0,
						xe = 1,
						we = 1,
						ye = 0,
						Te = 0,
						be = 0,
						Ee = 0;
					if (useGPURenderer) {
						pe = he;
						me = ve;
						xe = 1 - (he + fe);
						we = 1 - (ve + ge);
						ye = b.tx + (P + A * columnindex + X * pe);
						Te = b.ty + (I + U * rowindex + O * me);
						be = X * xe;
						Ee = O * we;
					} else {
						cpudrawingcontext.globalCompositeOperation = "source-atop";
						var Re = actualtexture.width / b.cols,
							Ce = actualtexture.height / b.rows,
							ke = Math.round(Re * (_ / pieceWidth1)),
							Me = Math.round(Ce * (D / pieceHeight1)),
							_e = ke,
							De = Me,
							Ae = columnindex * Re - Math.round((_e - Re) / 2),
							Ue = rowindex * Ce - Math.round((De - Ce) / 2),
							Xe = 0,
							Oe = 0,
							Pe = _,
							Se = D;
						if (Ae < 0) {
							var ze = _ * -Ae / ke;
							_e += Ae;
							Xe += ze;
							Pe -= ze;
							Ae = 0;
						}
						if (Ae < 0) {
							var Fe = D * -Ue / Me;
							De += Ue;
							Oe += Fe;
							Se -= Fe;
							Ue = 0;
						}
						if (Ae + _e > actualtexture.width) {
							var Ie = actualtexture.width - (Ae + _e);
							_e -= Ie;
							Pe -= _ * Ie / ke;
						}
						if (Ue + De > actualtexture.height) {
							var Ne = actualtexture.height - (Ue + De);
							De -= Ne;
							Se -= D * Ne / Me;
						}
						ye = b.maskX + columnindex * _;
						Te = b.maskY + rowindex * D;
						be = _;
						Ee = D;
						cpudrawingcontext.drawImage(actualtexture, Ae, Ue, _e, De, Xe, Oe, Pe, Se);
						cpudrawingcontext.globalCompositeOperation = "source-over";
					}
					cpudrawingcontext.stroke();
					cpudrawingcontext.restore();
					var Ye = b.maskX / H + N * K + N * pe,
						Le = b.maskY / G + L * V + L * me,
						Be = N * xe,
						We = L * we;
					W.push({
						index: $,
						xi: columnindex,
						yi: rowindex,
						rot: 0,
						x: 0,
						y: 0,
						spriteX: -_ / 2 + _ * pe,
						spriteY: -D / 2 + D * me,
						spriteW: _ * xe,
						spriteH: D * we,
						tx: ye,
						ty: Te,
						tw: be,
						th: Ee,
						tx2: Ye,
						ty2: Le,
						tw2: Be,
						th2: We,
						puzzle: pieceShape,
						puzzleX: -pieceWidth1 / 2,
						puzzleY: -pieceHeight1 / 2,
						globalX: 0,
						globalY: 0
					}), ++K >= b.cols && (K = 0, V++);
				}
			setPieces.push(W);
		}
		if (useGPURenderer) {
			documentref.hidden &&
				cpudrawingcontext.getImageData(0, 0, 1, 1),
				maskTexture = maskTexture || createTexture(),
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, maskTexture),
				gpucontext.texImage2D(gpucontext.TEXTURE_2D, 0, gpucontext.ALPHA, gpucontext.ALPHA, gpucontext.UNSIGNED_BYTE, cpucanvas),
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MAG_FILTER, gpucontext.LINEAR),
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MIN_FILTER, gpucontext.LINEAR_MIPMAP_LINEAR),
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_S, gpucontext.CLAMP_TO_EDGE),
				gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_T, gpucontext.CLAMP_TO_EDGE),
				gpucontext.generateMipmap(gpucontext.TEXTURE_2D);

			var He = Math.round(H / 2),
				Ge = Math.round(G / 2);
			currentFrameBuffer = gpucontext.createFramebuffer();
			xt = xt || createTexture();
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, xt);
			ct ? gpucontext.texImage2D(gpucontext.TEXTURE_2D, 0, gpucontext.R8, He, Ge, 0, gpucontext.RED, gpucontext.UNSIGNED_BYTE, null) :
				gpucontext.texImage2D(gpucontext.TEXTURE_2D, 0, gpucontext.RGBA, He, Ge, 0, gpucontext.RGBA, gpucontext.UNSIGNED_BYTE, null);
			gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MAG_FILTER, gpucontext.LINEAR);
			gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_MIN_FILTER, gpucontext.LINEAR_MIPMAP_LINEAR);
			gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_S, gpucontext.CLAMP_TO_EDGE);
			gpucontext.texParameteri(gpucontext.TEXTURE_2D, gpucontext.TEXTURE_WRAP_T, gpucontext.CLAMP_TO_EDGE);
			gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);

			if (currentFrameBuffer) {
				gpucontext.bindFramebuffer(gpucontext.FRAMEBUFFER, currentFrameBuffer);
				gpucontext.framebufferTexture2D(gpucontext.FRAMEBUFFER, gpucontext.COLOR_ATTACHMENT0, gpucontext.TEXTURE_2D, xt, 0);
				gpucontext.viewport(0, 0, He, Ge);
				gpucontext.clearColor(0, 0, 0, 0);
				gpucontext.clear(gpucontext.COLOR_BUFFER_BIT);
				gpucontext.useProgram(shader4.program);
				gpucontext.uniform2f(shader4.uniforms.shadowOffset, 0, 0);
				gpucontext.uniform2f(shader4.uniforms.shadowSpread, 5 / H, 5 / G);
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, maskTexture);
				setupVertexBuffer(gt, -1, -1, 2, 2, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0);
				executeDrawingCommands(gt);
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
				gpucontext.framebufferTexture2D(gpucontext.FRAMEBUFFER, gpucontext.COLOR_ATTACHMENT0, gpucontext.TEXTURE_2D, null, 0);
				gpucontext.bindFramebuffer(gpucontext.FRAMEBUFFER, null);
				gpucontext.deleteFramebuffer(currentFrameBuffer);
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, xt);
				gpucontext.generateMipmap(gpucontext.TEXTURE_2D);
				gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
			}

			if (!Mr) {
				var Ke = new Uint8Array([220, 220, 220, 255]);
				if (!realImage) {
					realImage = createTexture();
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, realImage);
					gpucontext.texImage2D(gpucontext.TEXTURE_2D, 0, gpucontext.RGB, 1, 1, 0, gpucontext.RGB, gpucontext.UNSIGNED_BYTE, Ke);
					gpucontext.bindTexture(gpucontext.TEXTURE_2D, null);
				}
			}
			cpucanvas.width = 500;
			cpucanvas.height = 500;
		} else {
			var Ve = createElemWithClass("canvas");
			Ve.width = Ar.reduce((function(e, t) {
				return e + t.width;
			}), 0), Ve.height = Ar.reduce((function(e, t) {
				return Math.max(e, t.height);
			}), 0);
			for (var qe = Ve.getContext("2d"), je = 0, Je = 0, $e = 0, Qe = Ar; $e < Qe.length; $e++) {
				var Ze = Qe[$e];
				qe.drawImage(Ze, je, 0), je += Ze.width, localsetclone[Je].imageWidth = Ze.width, localsetclone[Je].imageHeight = Ze.height, Je++;
			}
			Ct = Ve;
		}
		0 === viewX && 0 === viewY && zoomTo100(), firstTextureLoadFinished = z = true, initRoomData();
	}

	function toggleJukeboxMute() {
		const jt = document.getElementById('jukebox-text');
		const aud = /**@type {HTMLAudioElement}*/ (documentref.getElementById("jukeelem"));
		const sl = documentref.getElementById("slidecont");
		if (!mutejuke) {
			jt.textContent = `🔈Click here to unmute.`;
			aud.volume = 0;
		} else {
			jt.textContent = `🔊Click here to mute.`;
			aud.volume = jukevol;
			try {
				aud.play();
			} catch {}
		}

		mutejuke = !mutejuke;
		sl.style.display = !mutejuke ? "block" : "none";
		localStorage['mutejuke'] = mutejuke ? "y" : "";
	}

	document.getElementById("playlistDropdownToggle").addEventListener("click", function(e) {
		const CONTAINER = /**@type {HTMLAnchorElement}*/ (e.target).parentElement;
		const MENU = /**@type {HTMLElement}*/ (CONTAINER.querySelector(".dropdown-menu"));
		if (MENU)
			MENU.style.display = (CONTAINER.classList.toggle("open") ? "flex" : "none");
	});

	function handlePopup(urlinputbtn, urlinput) {
		let popvisible = false;
		const arr = urlinput.querySelector('[data-arrow]');
		return async () => {
			popvisible = !popvisible;
			if (popvisible) {
				const rect = urlinputbtn.getBoundingClientRect();
				const target = [rect.x + rect.width / 2, rect.y + rect.height + 10];
				const prect = urlinput.getBoundingClientRect();
				const ptarget = [prect.x + prect.width / 2, prect.y];
				const diff = target; //[ptarget[0] - target[0], ptarget[1] - target[1]]
				diff[0] -= prect.width / 2;
				//diff[0] -= rect.width / 2;
				urlinput.style.transform = `translate(${diff[0]}px, ${diff[1]}px)`;
				urlinput.setAttribute('data-popper-placement', 'bottom');
				arr.style.transform = `translate(${~~(prect.width / 2)}px, 0px)`;
				urlinput.style.position = "absolute";
				urlinput.style.opacity = '1';
				urlinput.style.pointerEvents = 'all';

			} else {
				urlinput.style.opacity = '0';
				urlinput.style.pointerEvents = 'none';
			}
			urlinput.dispatchEvent(new CustomEvent("visibility", {
				detail: popvisible
			}));
		};
	}

	function initRoomData() {
		if (roomdef.endTime) {
			borderOpacity = 0;
			if (dlBox)
				dlBox.style.display = 'inline';
		}
		groups__unknown = [], isBoxSelecting = false, isPanning = false, roomdefGroups = roomdef.groups.map((function(group) {
			return {
				set: 0 | group.set,
				id: group.id,
				ids: group.ids || [],
				x: group.x,
				y: group.y,
				w: 0,
				h: 0,
				locked: !!group.locked,
				rot: 0 | group.rot,
				angle: (0 | group.rot) * Math.PI * .5,
				targetAngle: (0 | group.rot) * Math.PI * .5,
				pieces: group.indices.map((function(t) {
					return setPieces[0 | group.set][t];
				})),
				user: getUserById(roomUsers, group.dragged || group.selected),
				selectedByOther: !!group.selected,
				selected: false,
				dragged: false,
				startX: 0,
				startY: 0
			};
		})), transformedboard = [];
		if ((!roomdef.ext || !roomdef.ext.reported) && !localStorage['reported' + globalThis.ROOM_NAME]) {
			let rbox = /**@type {HTMLAnchorElement}*/ (documentref.getElementById("report-box"));
			if (rbox) {
				let popvisible = false;
				const reportinput = documentref.getElementById("reportinput");
				const confirmbtn = reportinput.querySelector('button[value="confirm"]');
				const cancelbtn = reportinput.querySelector('button[value="cancel"]');
				const choice = reportinput.querySelector('#rchoice');
				reportinput.onsubmit = (e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					e.stopPropagation();

					if ( /**@type {HTMLButtonElement}*/ (e.submitter).value == "cancel") {
						rbox.click();
						return;
					}
					const reason = choice.value;
					fetch("/report/" + globalThis.ROOM_NAME + '?reason=' + btoa(reason)).then((response) => {
						if (response.ok) {
							rbox.style.display = 'none';
							localStorage['reported' + globalThis.ROOM_NAME] = 'y';
							alert("Report submitted!");
						} else {
							alert("An error occurred. Please try again later.");
						}
					});
					rbox.click();
				};

				rbox.onclick = handlePopup(rbox, reportinput);

				rbox.style.display = 'inline';
			}
		}
		if (roomdef.juke) {
			let inaud = documentref.getElementById("jukeelem");
			if (!inaud) {
				const jukecont = documentref.getElementById("jukebox");
				const aud = documentref.createElement("audio");
				const sl = documentref.getElementById("slidecont");
				aud.id = "jukeelem";
				const vsl = /**@type {HTMLInputElement}*/ (documentref.getElementById('volslider'));
				if (mutejuke) {
					aud.volume = 0;
				} else {
					aud.volume = jukevol;
					vsl.value = "" + ~~(jukevol * 100);
				}
				jukecont.append(aud);
				jukecont.onclick = toggleJukeboxMute;
				sl.style.display = mutejuke ? "none" : "block";
				const jt = document.getElementById('jukebox-text');
				if (mutejuke) {
					jt.textContent = `🔈Click here to unmute.`;
				} else {
					jt.textContent = `🔊Click here to mute.`;
				}
				vsl.onchange = vsl.oninput = () => {
					jukevol = (+vsl.value) / 100;
					localStorage['jukevol'] = "" + jukevol;
					aud.volume = jukevol;
					vsl.blur();
				};

				try {
					const urlinputbtn = documentref.getElementById("urlinputbtn");
					const urlinput = /**@type {HTMLFormElement}*/ (documentref.getElementById("urlinput"));
					const jambtn = /**@type {HTMLButtonElement}*/ (urlinput.querySelector('button[value="jam"]'));
					const addbtn = urlinput.querySelector('button[value="add"]');
					urlinputbtn.onclick = handlePopup(urlinputbtn, urlinput);
					urlinput.addEventListener("visibility", async (ev) => {
						const popvisible = /**@type {CustomEvent}*/ (ev).detail;
						if (popvisible) {
							urlinput.bid.value = (minprice || 5) + 1;
							try {
								const content = await navigator.clipboard.readText();
								const purl = new URL(content);
								if (purl.host.includes('youtu')) {
									urlinput.url.value = content;
									setTimeout(() => {
										urlinput.url.scrollLeft = urlinput.url.scrollWidth;
									}, 0);
								}
							} catch (e) {
								console.log(e);
							}
						}
					});

					let down = false;
					addbtn.addEventListener("mousedown", (e) => {
						e.preventDefault();
					});
					jambtn.addEventListener("mousedown", (e) => {
						e.preventDefault();
						urlinput.bid.value *= 2;
						down = true;
					});
					jambtn.addEventListener("mouseup", (e) => {
						down = false;
					});

					jambtn.addEventListener("mouseleave", (e) => {
						if (down)
							urlinput.bid.value /= 2;
					});

					jambtn.addEventListener("mouseenter", (e) => {
						if (e.button == 2 && down) {
							urlinput.bid.value *= 2;
						} else {
							down = false;
						}
					});

					urlinput.onsubmit = (e) => {
						e.preventDefault();
						e.stopImmediatePropagation();
						e.stopPropagation();
						urlinputbtn.click();
						sendToWS({
							type: "chat",
							message: `/pl${/**@type {HTMLButtonElement}*/(e.submitter).value} ${urlinput.bid.value} ${urlinput.url.value}`
						});
					};
				} catch {

				}
			}

			if (roomdef.ext) {
				setMinPrice(roomdef.ext.minPrice);
				refreshPlaylist(roomdef.ext.playlist);
				refreshCurrentSong(roomdef.ext.currentlyPlaying);
				if (roomdef.ext.currentlyPlaying && roomdef.ext.timeStarted) {
					startMusicAt(roomdef.ext.timeStarted, roomdef.ext.currentlyPlaying);
				}
			}
		} else {
			["jukebox", "volslider", "playlistMenu", "point-text",
				"slidecont", "playlist-cont", "urlinputbtn"
			]
			.map(e => documentref.getElementById(e))
				.forEach(e => e.style.display = "none");
		}
		for (var e = 0, t = setPieces; e < t.length; e++)
			for (var r = t[e], n = 0; n < r.length; n++) {
				r[n];
				transformedboard.push(void 0);
			}
		for (var a = 0, i = roomdefGroups; a < i.length; a++) {
			var o = i[a];
			updateGroupPieces(o), preventOOBRotation(o), transformedboard[o.id] = o;
			for (var s = 0, l = o.ids; s < l.length; s++) {
				var c = l[s];
				transformedboard[c] = o;
			}
		}
		refreshLockedDisplay();
		updateDonePercent();
	}

	function setupPieceGeometry(e, t, r, angle) {
		setupVertexBuffer(gt,
			e.x + e.spriteX, e.y + e.spriteY, e.spriteW, e.spriteH,
			e.tx, e.ty, e.tw, e.th,
			e.tx2, e.ty2, e.tw2, e.th2,
			t, r, angle, 0);
	}

	function updateUniformColor(e, t) {
		gpucontext.uniform4f(e, t[0], t[1], t[2], t[3]);
	}

	function updateGroup(group) {
		var t = localsetclone[group.set],
			pieceWidth = t.pieceWidth,
			pieceHeight = t.pieceHeight,
			absX = group.x + viewX,
			absY = group.y + viewY,
			groupMidX = (group.w + pieceWidth) / 2,
			groupMidY = (group.h + pieceHeight) / 2;
		// cull groups out of view
		if (!(absX - groupMidX > scaledViewWidth || absY - groupMidY > scaledViewHeight || absX + groupMidX < 0 || absY + groupMidY < 0)) {
			var angle = group.angle,
				c = (group.dragged || group.user ? .7 : .4) * clamp(pieceWidth / 100, .1, 1),
				acos = Math.sin(angle),
				asin = Math.cos(angle);
			transformMat2d[0] = asin;
			transformMat2d[1] = acos;
			transformMat2d[2] = -acos;
			transformMat2d[3] = asin;
			transformMat2d[4] = absX;
			transformMat2d[5] = absY;
			for (var i = 0, pieces = group.pieces; i < pieces.length; i++) {
				setupPieceGeometry(pieces[i], 0, c, angle); // shadow geometry
			}
			if (!group.dragged && group.user || group.selected) {
				var currentSelecter = group.selected ? yt : group.user.highlight;
				if (previousSelecter !== currentSelecter) {
					executeDrawingCommands(gt);
					previousSelecter = currentSelecter;
					updateUniformColor(jigshader.uniforms.highlightColor, previousSelecter);
				};
				for (var p = 0, m = group.pieces; p < m.length; p++) {
					setupPieceGeometry(m[p], 0, 0, angle); // highlight geometry
				}
			}
            // MyEdit START - Подсветка своего поднятия
            else if(group.dragged) {
                var currentSelecter = [0, 1, 1, 1];
                if (previousSelecter !== currentSelecter) {
                    executeDrawingCommands(gt);
                    previousSelecter = currentSelecter;
                    updateUniformColor(jigshader.uniforms.highlightColor, previousSelecter);
                };
                for (var p = 0, m = group.pieces; p < m.length; p++) {
                    setupPieceGeometry(m[p], 0, 0, angle);
                }
            }
            // MyEdit END
			for (var x = 0, w = group.pieces; x < w.length; x++) {
				setupPieceGeometry(w[x], 1, 0, angle); // proper piece geometry
			}
		}
	}

	function drawPiecesCPU(e, t, r, n, a, i) {
		var o, s, l = localsetclone[t.set],
			c = l.pieceWidth,
			u = l.pieceHeight,
			f = t.x + viewX,
			v = t.y + viewY,
			g = (t.w + c) / 2,
			p = (t.h + u) / 2;
		if (t.angle !== t.targetAngle) o = s = Math.sqrt(g * g + p * p);
		else {
			var m = 1 === t.rot || 3 === t.rot;
			o = m ? p : g, s = m ? g : p;
		}
		if (!(f - o > a || v - s > i || f + o < r || v + s < n)) {
			var selected = !t.dragged && t.user || t.selected;
			if (selected) {
				var w = t.user ? t.user.color : "white";
				possibletransparentbgcol !== w && (e.strokeStyle = possibletransparentbgcol = w);
			}
			e.save();
			e.translate(f, v);
			e.rotate(t.angle);
			if (selected) {
				e.beginPath();
				for (var y = 0, T = t.pieces; y < T.length; y++) {
					var b = T[y];
					if (!roomdef.rotation) {
						var E = f + b.x,
							R = v + b.y,
							C = E + b.spriteX,
							k = R + b.spriteY;
						if (C > a || k > i || C + b.spriteW < r || k + b.spriteH < n) continue;
					}
					drawJigShapePath(e, b.x + b.puzzleX, b.y + b.puzzleY, b.puzzle);
				}
				e.stroke();
			}
			if (roomdefGroups.length == localsetclone.length) {
				const img = Ar[t.set];
				e.drawImage(Ar[t.set], 0, 0,
					img.naturalWidth, img.naturalHeight,
					-t.w / 2, -t.h / 2,
					t.w, t.h);
			} else
				for (var M = 0, _ = t.pieces; M < _.length; M++) {
					var D = _[M];
					if (!roomdef.rotation) {
						var A = f + D.x,
							U = v + D.y,
							X = A + D.spriteX,
							O = U + D.spriteY;
						if (X > a || O > i || X + D.spriteW < r || O + D.spriteH < n) continue;
					}
					e.drawImage(cpucanvas, D.tx, D.ty, D.tw, D.th, D.x + D.spriteX, D.y + D.spriteY, D.spriteW, D.spriteH);
				}
			e.restore();
		}
	}

	function recountHeldPieces() {
		for (var i = 0, users = roomUsers; i < users.length; i++) {
			var user = users[i];
			user.heldPiecesOld = user.heldPieces, user.heldPieces = 0;
		}
		for (var i = 0, groups = roomdefGroups; i < groups.length; i++) {
			var group = groups[i];
			group.user && (group.user.heldPieces += group.pieces.length);
		}
		for (var i = 0, users = roomUsers; i < users.length; i++) {
			var user = users[i];
			user.heldPieces !== user.heldPiecesOld && (user.heldPiecesText.textContent = user.heldPieces.toString());
		}
	}

	function Kr(t, r, n, a) {
		var i = Math.max(Math.floor((t + viewX) * viewScale), 0),
			o = Math.max(Math.floor((r + viewY) * viewScale), 0);

		(function(e, t, r, n) {
			if (!useGPURenderer && !z && 0 !== r && 0 !== n) {
				if (n < 0 && console.warn("invalid redraw", e, t, r, n), I.length > 20) return z = true, void(I.length = 0);
				var a = false;
				do {
					a = false;
					for (var i = 0; i < I.length; i++) {
						var o = I[i];
						if (e < o.x + o.w && e + r > o.x && t < o.y + o.h && t + n > o.y) {
							var s = Math.min(e, o.x);
							r = Math.max(e + r, o.x + o.w) - s;
							var l = Math.min(t, o.y);
							n = Math.max(t + n, o.y + o.h) - l, e = s, t = l, I[i] = I[I.length - 1], I.length--, a = true;
							break;
						}
					}
				} while (a);
				I.push({
					x: e,
					y: t,
					w: r,
					h: n
				});
			}
		})(i,
			o,
			clamp(Math.ceil((t + viewX + n) * viewScale) - i, 0, Math.max(windowref.innerWidth - i, 0)),
			clamp(Math.ceil((r + viewY + a) * viewScale) - o, 0, Math.max(windowref.innerHeight - o, 0)));
	}

	function Vr(group) {
		if (!useGPURenderer) {
			var axisAlignedW, axisAlignedH, set = localsetclone[group.set],
				w = set.pieceWidth,
				h = set.pieceHeight,
				cx = (group.w + w) / 2,
				cy = (group.h + h) / 2;
			if (group.angle !== group.targetAngle) axisAlignedW = axisAlignedH = Math.sqrt(cx * cx + cy * cy);
			else {
				var turned = 1 === group.rot || 3 === group.rot;
				axisAlignedW = turned ? cy : cx, axisAlignedH = turned ? cx : cy;
			}
			Kr(group.x - axisAlignedW, group.y - axisAlignedH, 2 * axisAlignedW, 2 * axisAlignedH);
		}
	}

	function clamp(val, min, max) {
		return val > min ? val < max ? val : max : min;
	}

	function calcPercent(e) {
		return Math.round(100 * e) / 100;
	}

	function createShaderProgram(e) {
		return function(e, t, r) {
			var n = gpucontext.createProgram();
			if (!n) throw new Error("Failed to create program");
			gpucontext.attachShader(n, e);
			gpucontext.attachShader(n, t);
			gpucontext.bindAttribLocation(n, 0, "position");
			gpucontext.bindAttribLocation(n, 1, "texcoords");
			gpucontext.bindAttribLocation(n, 2, "vertexColor");
			gpucontext.linkProgram(n);
			gpucontext.deleteShader(e);
			gpucontext.deleteShader(t), false;
			var a = function(e, t) {
				gpucontext.useProgram(e);
				for (var r = {}, n = [], a = "".concat(t.vertex, "\n").concat(t.fragment).match(/uniform [a-z0-9_]+ [a-z_][a-z0-9_]*/gi) || [], i = 0; i < a.length; i++) {
					var o = a[i].split(" "),
						s = o[1],
						l = o[2],
						c = gpucontext.getUniformLocation(e, l);
					c && (r[l] = c, "sampler2D" === s && n.push(l));
				}
				return n.sort().forEach((function(e, t) {
					return gpucontext.uniform1i(r[e], t);
				})), r;
			}(n, r);
			return {
				program: n,
				uniforms: a
			};
		}(compileshader(gpucontext.VERTEX_SHADER, e.vertex), compileshader(gpucontext.FRAGMENT_SHADER, e.fragment), e);
	}

	function compileshader(e, t) {
		var r = gpucontext.createShader(e);
		if (!r) throw new Error("Failed to create shader");
		return gpucontext.shaderSource(r, t), gpucontext.compileShader(r), r;
	}

	function powoftwo(e) {
		for (var t = 1; t < e;) t *= 2;
		return t;
	}

	function sendToWS(obj) {
		isConnected && webSocket && webSocket.send(JSON.stringify(obj));
	}
	var isIE11 = /MSIE 10|Trident\/7/.test(navigator.userAgent);

	function uploadCommandBuffer(data) {
		if (isIE11) {
			var buffer = new ArrayBuffer(data.byteLength);
			new Uint8Array(buffer).set(data);
			data = buffer;
		}
		isConnected && webSocket && playerID && webSocket.send(data);
	}

	function allocateCommandBuffer(cmdType, initialSize) {
		(function(size) {
			for (; size > tmpbuffer.byteLength;) tmpbuffer = new Uint8Array(2 * tmpbuffer.byteLength), tmpbufferview = new DataView(tmpbuffer.buffer);
		})(initialSize), tmpbufferview.setUint8(0, cmdType), tmpbufferview.setUint16(1, playerID, true);
	}

	function selectCommand(e, t) {
		var r = 3 + 2 * t.length;
		allocateCommandBuffer(e, r);
		for (var n = 0, a = 3; n < t.length; n++, a += 2) tmpbufferview.setUint16(a, t[n].id, true);
		uploadCommandBuffer(tmpbuffer.subarray(0, r));
	}

	function moveCommand(cmdType, groups) {
		var bytes = 3 + 10 * groups.length;
		allocateCommandBuffer(cmdType, bytes);
		for (var n = 0, a = 3; n < groups.length; n++, a += 10) {
			tmpbufferview.setUint16(a, groups[n].id, true);
			tmpbufferview.setFloat32(a + 2, groups[n].x, true);
			tmpbufferview.setFloat32(a + 6, groups[n].y, true);
		}
		uploadCommandBuffer(tmpbuffer.subarray(0, bytes));
	}

	function recordSolveCommand(t) {
		allocateCommandBuffer(0x40, 5); // 1: cmdid, 2-3: player id, 4-5: record id
		tmpbufferview.setUint16(3, t, true);
		uploadCommandBuffer(tmpbuffer.subarray(0, 5));
	}

	var openedMenu = void 0,
		openedMenuButton = void 0,
		clickedUserId = 0;

	function closeMenus() {
		if (openedMenu) {
			documentref.body.removeChild(openedMenu);
			openedMenu = void 0;
			openedMenuButton = void 0;
			clickedUserId = 0;
		}
	}

	function positionOpenedMenu() {
		if (openedMenu && openedMenuButton) {
			var rect = openedMenuButton.getBoundingClientRect();
			openedMenu.style.right = (windowref.innerWidth - rect.right) + "px";
			openedMenu.style.top = (rect.bottom + 8) + "px";
		}
	}
	attachEvents(usersElement, "wheel", attachMobileHandlers);
	attachEvents(usersElement, "scroll", positionOpenedMenu);
	attachEvents(documentref, "mousedown", closeMenus);
	var enableTimer = "n" !== loadFromLocalStorage("timer"),
		timerBoxElement = getElementById("timer-box"),
		timerTextElement = getElementById("timer-text");

	function vn() {
		enableTimer ? timerBoxElement.classList.remove("is-hidden") : timerBoxElement.classList.add("is-hidden");
	}

	function timeFormat(e) {
		return e < 10 ? "0".concat(e) : e;
	}

	let qty = 0;
	let minprice = 5;
	let currentlyPlaying;

	function renderPoints() {
		const points = documentref.getElementById('point-text');
		points.textContent = `${qty}₽ / ${minprice}₽`;
	}

	function setQty(newqty) {
		qty = newqty;
		renderPoints();
	}

	function setMinPrice(newqty) {
		minprice = newqty;
		renderPoints();
	}

	function refreshCurrentSong(newcp) {
		const pl = getElementById('playlistMenu');
		const oldspan = pl.querySelector(`[data-id="${currentlyPlaying}"]`);
		const newspan = pl.querySelector(`[data-id="${newcp}"]`);
		currentlyPlaying = newcp;
		if (oldspan)
			oldspan.classList.remove('active');
		if (newspan)
			newspan.classList.add('active');
	}

	function refreshPlaylist(playlist) {
		const pl = getElementById('playlistMenu');
		pl.innerHTML = '';
		pl.append(...playlist.map(p => {
			const el = documentref.createElement('span');
			el.setAttribute('data-id', p.id);
			el.innerText = p.title;
			el.title = p.title; // display full name by hovering the mouse over
			el.classList.add('pl-item');
			if (p.skip)
				el.classList.add('skipped');
			return el;
		}));

		refreshCurrentSong(currentlyPlaying);
	}

	function fullTimeFormat() {
		var e = roomdef.startTime,
			t = roomdef.endTime || Date.now(),
			r = e ? Math.floor(Math.max(0, t - e) / 1e3) : 0,
			n = r % 60,
			a = Math.floor(r / 60) % 60,
			i = Math.floor(r / 3600) % 24,
			o = Math.floor(r / 86400),
			s = "".concat(timeFormat(a), ":").concat(timeFormat(n));
		(o || i) && (s = "".concat(timeFormat(i), ":").concat(s)), o && (s = o + (1 === o ? " day " : " days ") + s), timerTextElement.innerText = s;
	}

	function initConnection() {
		clearTimeout(Z);

		Z = void 0;
		webSocket = webSocket = new WebSocket(location.origin.replace(/^http/, "ws") + "/ws");
		webSocket.binaryType = "arraybuffer";

		loadingBoxElem.style.display = "block";
		loadingTextElem.textContent = "Connecting...";

		webSocket.onopen = function() {
			Date.now();

			loadingTextElem.textContent = "Loading...";
			isConnected = true;
			sendToWS({
				type: "user",
				name: savedname,
				color: savedcolor,
				room: globalThis.ROOM_NAME,
				secret: secretforthisroom
			});
		};

		webSocket.onmessage = function(WebSocketEvent) {
			var data = WebSocketEvent.data;
			if (Date.now(), data) {
				if ("string" == typeof data) {
					var obj = JSON.parse(data);
					switch (obj.type) {
						case "version":
							obj.version !== globalThis.APP_VERSION && location.reload();
							break;
						case "noroom":
							location.reload();
							break;
						case "me":
							playerID = obj.id;
							break;
						case "upgrade":
							localStorage.setItem('secret:' + globalThis.ROOM_NAME, obj.secret);
							break;
						case "users":
							// Userlist entries alter the clientHeight.
							const scrollBottom = chatLogElem.scrollHeight - chatLogElem.clientHeight - chatLogElem.scrollTop;

							for (; usersElement.lastElementChild;) usersElement.removeChild(usersElement.lastElementChild);
							let thisUser = getUserById(obj.users, playerID);
							if (thisUser) {
								obj.users.unshift(obj.users.splice(obj.users.indexOf(thisUser), 1)[0]);
							}
							// Detect disconnected Users
							roomUsers.forEach(oldUser => {
								const oldId = oldUser.id;
								if (!obj.users.find(newUser => newUser.id == oldUser.id)) {
									nameTags.remove(oldId);
								}
							});
							roomUsers = obj.users;
							if (clickedUserId && !roomUsers.some((function(e) {
									return e.id === clickedUserId;
								}))) {
								closeMenus();
							}
							for (var createUserItem = function(i, users) {
									var user = users[i];
									user.heldPieces = 0, user.heldPiecesOld = 0, user.heldPiecesText = createTextNode("0"), user.highlight = toRgbaNum(user.color);
									var userElem = createElemWithClass("div", "user"),
										colorElem = createElemWithClass("span", "user-color");
									colorElem.style.backgroundColor = user.color;
									var nameElem = createElemWithClass("span", "user-name");
									nameElem.appendChild(createTextNode(user.name));
									var heldPiecesElem = createElemWithClass("span", "user-pieces");
									heldPiecesElem.title = "Pieces held by user";
									heldPiecesElem.appendChild(user.heldPiecesText);
									heldPiecesElem.appendChild(createSVG("0 0 576 512", "M519.442 288.651c-41.519 0-59.5 31.593-82.058 31.593C377.409 320.244 432 144 432 144s-196.288 80-196.288-3.297c0-35.827 36.288-46.25 36.288-85.985C272 19.216 243.885 0 210.539 0c-34.654 0-66.366 18.891-66.366 56.346 0 41.364 31.711 59.277 31.711 81.75C175.885 207.719 0 166.758 0 166.758v333.237s178.635 41.047 178.635-28.662c0-22.473-40-40.107-40-81.471 0-37.456 29.25-56.346 63.577-56.346 33.673 0 61.788 19.216 61.788 54.717 0 39.735-36.288 50.158-36.288 85.985 0 60.803 129.675 25.73 181.23 25.73 0 0-34.725-120.101 25.827-120.101 35.962 0 46.423 36.152 86.308 36.152C556.712 416 576 387.99 576 354.443c0-34.199-18.962-65.792-56.558-65.792z"));
									userElem.appendChild(colorElem);
									userElem.appendChild(nameElem), user.id !== playerID && secretforthisroom && userElem.appendChild(heldPiecesElem);
									if (user.id === playerID) {
										var userSettingsElem = createElemWithClass("div", "user-button");
										userSettingsElem.title = "User options";
										var c = createSVG("0 0 512 512", "M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-47 0-70.2l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-11.1-35.6-30-67.8-54.7-94.6-3.8-4.1-10-5.1-14.8-2.3L380.8 110c-17.9-15.4-38.5-27.3-60.8-35.1V25.8c0-5.6-3.9-10.5-9.4-11.7-36.7-8.2-74.3-7.8-109.2 0-5.5 1.2-9.4 6.1-9.4 11.7V75c-22.2 7.9-42.8 19.8-60.8 35.1L88.7 85.5c-4.9-2.8-11-1.9-14.8 2.3-24.7 26.7-43.6 58.9-54.7 94.6-1.7 5.4.6 11.2 5.5 14L67.3 221c-4.3 23.2-4.3 47 0 70.2l-42.6 24.6c-4.9 2.8-7.1 8.6-5.5 14 11.1 35.6 30 67.8 54.7 94.6 3.8 4.1 10 5.1 14.8 2.3l42.6-24.6c17.9 15.4 38.5 27.3 60.8 35.1v49.2c0 5.6 3.9 10.5 9.4 11.7 36.7 8.2 74.3 7.8 109.2 0 5.5-1.2 9.4-6.1 9.4-11.7v-49.2c22.2-7.9 42.8-19.8 60.8-35.1l42.6 24.6c4.9 2.8 11 1.9 14.8-2.3 24.7-26.7 43.6-58.9 54.7-94.6 1.5-5.5-.7-11.3-5.6-14.1zM256 336c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z");
										userSettingsElem.style.marginRight = "2px";
										userSettingsElem.appendChild(c);
										addClickHandlers(userSettingsElem, syncUserFormState);
										userElem.appendChild(userSettingsElem);
									} else if (secretforthisroom) {
										var userButtonElem = createElemWithClass("div", "user-button");
										userButtonElem.title = "Admin actions";
										var d = createSVG("0 0 640 512", "M610.5 373.3c2.6-14.1 2.6-28.5 0-42.6l25.8-14.9c3-1.7 4.3-5.2 3.3-8.5-6.7-21.6-18.2-41.2-33.2-57.4-2.3-2.5-6-3.1-9-1.4l-25.8 14.9c-10.9-9.3-23.4-16.5-36.9-21.3v-29.8c0-3.4-2.4-6.4-5.7-7.1-22.3-5-45-4.8-66.2 0-3.3.7-5.7 3.7-5.7 7.1v29.8c-13.5 4.8-26 12-36.9 21.3l-25.8-14.9c-2.9-1.7-6.7-1.1-9 1.4-15 16.2-26.5 35.8-33.2 57.4-1 3.3.4 6.8 3.3 8.5l25.8 14.9c-2.6 14.1-2.6 28.5 0 42.6l-25.8 14.9c-3 1.7-4.3 5.2-3.3 8.5 6.7 21.6 18.2 41.1 33.2 57.4 2.3 2.5 6 3.1 9 1.4l25.8-14.9c10.9 9.3 23.4 16.5 36.9 21.3v29.8c0 3.4 2.4 6.4 5.7 7.1 22.3 5 45 4.8 66.2 0 3.3-.7 5.7-3.7 5.7-7.1v-29.8c13.5-4.8 26-12 36.9-21.3l25.8 14.9c2.9 1.7 6.7 1.1 9-1.4 15-16.2 26.5-35.8 33.2-57.4 1-3.3-.4-6.8-3.3-8.5l-25.8-14.9zM496 400.5c-26.8 0-48.5-21.8-48.5-48.5s21.8-48.5 48.5-48.5 48.5 21.8 48.5 48.5-21.7 48.5-48.5 48.5zM224 256c70.7 0 128-57.3 128-128S294.7 0 224 0 96 57.3 96 128s57.3 128 128 128zm201.2 226.5c-2.3-1.2-4.6-2.6-6.8-3.9l-7.9 4.6c-6 3.4-12.8 5.3-19.6 5.3-10.9 0-21.4-4.6-28.9-12.6-18.3-19.8-32.3-43.9-40.2-69.6-5.5-17.7 1.9-36.4 17.9-45.7l7.9-4.6c-.1-2.6-.1-5.2 0-7.8l-7.9-4.6c-16-9.2-23.4-28-17.9-45.7.9-2.9 2.2-5.8 3.2-8.7-3.8-.3-7.5-1.2-11.4-1.2h-16.7c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16h-16.7C60.2 288 0 348.2 0 422.4V464c0 26.5 21.5 48 48 48h352c10.1 0 19.5-3.2 27.2-8.5-1.2-3.8-2-7.7-2-11.8v-9.2z");
										userButtonElem.appendChild(d);
										addClickHandlers(userButtonElem, (function() {
											return function(userBtn, user) {
												if (clickedUserId !== user.id) {
													closeMenus();
													var dropDownMenu = createElemWithClass("div", "dropdown-menu right dropdown-menu-user"),
														kickBtn = createElemWithClass("button", "dropdown-item");
													kickBtn.appendChild(createTextNode("kick & block user"));
													addClickHandlers(kickBtn, (function() {
														sendToWS({
															type: "kick",
															user: user.id,
															secret: secretforthisroom
														});
														closeMenus();
													}));
													dropDownMenu.appendChild(kickBtn);
													dropDownMenu.style.display = "block";
													documentref.body.append(dropDownMenu);
													addMouseHandlers(dropDownMenu);
													openedMenu = dropDownMenu;
													openedMenuButton = userBtn;
													clickedUserId = user.id;
													positionOpenedMenu();
												} else
													closeMenus();
											}(userButtonElem, user);
										}));
										userElem.appendChild(userButtonElem);
										clickedUserId === user.id && (openedMenuButton = userButtonElem);
									}
									usersElement.appendChild(userElem);
								}, i = 0, users = roomUsers; i < users.length; i++) {
								createUserItem(i, users);
								const user = roomUsers[i];
								nameTags.add(user.id, user.name, user.color);
							}

							// Restore scroll position with the new clientHeight, measuring from the bottom instead of the top.
							setTimeout(() => chatLogElem.scrollTop = chatLogElem.scrollHeight - scrollBottom - chatLogElem.clientHeight);

							for (var i = 0, groups = roomdefGroups; i < groups.length; i++) {
								var group = groups[i];
								group.user && (group.user = getUserById(roomUsers, group.user.id));
							}
							recountHeldPieces();
							positionOpenedMenu();
							break;
						case "room":
							roomdef = obj.room;
							seed = roomdef.seed;
							boardWidth = roomdef.boardWidth;
							boardHeight = roomdef.boardHeight;
							pieceCountElem.textContent = roomdef.sets.reduce((function(e, t) {
								return e + t.cols * t.rows;
							}), 0).toString();
							var g = "/?image=".concat(roomdef.sets.map((function(e) {
								return e.image;
							})).join(";"), "&name=").concat(encodeURIComponent(roomdef.name), "&pieces=").concat(roomdef.pieces);
							roomdef.rotation && (g += "&rotation=yes");
							roomdef.hidePreview && (g += "&preview=hide");
							newRoomSameImgBtn.href = g;
							newRoomSameImgBtn.style.display = roomdef.hidePreview ? "none" : "flex";
							previewBoxElement.style.display = roomdef.hidePreview ? "none" : "flex";
							previewNextElement.style.display = roomdef.sets.length > 1 ? "inline" : "none";
							setTimeout(startLoading);
							fullTimeFormat();
							break;
						case "update":
							Object.assign(roomdef, obj.room);
							if (!canMultiselect()) {
								sendunselected();
							}
							newRoomSameImgBtn.style.display = roomdef.hidePreview ? "none" : "flex";
							previewBoxElement.style.display = roomdef.hidePreview ? "none" : "flex";
							break;
						case "chat":
							(function(e, t, r, ts) {
								var n = true;
								for (; chatMessagesElem.childElementCount > 100;) chatMessagesElem.removeChild(chatMessagesElem.firstChild);
								var a = createElemWithClass("div", "chat-message"),
									i = createElemWithClass("div"),
									o = ts ? new Date(ts) : new Date,
									s = o.getHours(),
									l = o.getMinutes(),
									c = createElemWithClass("div", "chat-date");
								c.appendChild(createTextNode("".concat(timeFormat(s), ":", timeFormat(l))));
								i.appendChild(c);
								var u = createElemWithClass("div", "chat-user");
								u.style.color = t, u.appendChild(createTextNode(e)), i.appendChild(u);
								var d = createElemWithClass("div", "chat-content");
								d.appendChild(createTextNode(r));
								i.appendChild(d);
								a.appendChild(i);
								chatMessagesElem.appendChild(a);
								n && setTimeout((function() {
									const isBottom = Math.abs((chatLogElem.scrollTop + chatLogElem.clientHeight) - chatLogElem.scrollHeight) <= a.clientHeight;
									// receivedHeartBeat allows to scroll down the chat during initial loading
									if (isBottom || !receivedHeartBeat)
										return chatLogElem.scrollTop = 1e6;
								}));
							})(obj.name, obj.color, obj.message, obj.ts);
							if (obj.id !== playerID && !hidechat) {
								playsound(chatsound);
							}
							break;
						case "points": {
							if (obj.qty)
								setQty(obj.qty);
							break;
						}
						case "playlist": {
							if (obj.minPrice)
								setMinPrice(obj.minPrice);
							if (obj.playlist)
								refreshPlaylist(obj.playlist);
							if (obj.currentlyPlaying)
								refreshCurrentSong(obj.currentlyPlaying);
							if (obj.reschedule) {
								if (obj.timeStarted)
									startMusicAt(obj.timeStarted, obj.currentlyPlaying);
							}
							if (obj.stop) {
								let inaud = /** @type {HTMLAudioElement} */ (documentref.getElementById("jukeelem"));
								inaud.pause();
								inaud.removeAttribute('src');
								inaud.src = '';
							}
							break;
						}
						default:
							console.log("invalid message", obj);
					}
				} else {
					var dataView = new DataView(data),
						cmdType = dataView.getUint8(0),
						userId = dataView.getUint16(1, true);
					switch (cmdType) {
						case CMD_TYPE.PICK:
						case CMD_TYPE.MOVE:
						case CMD_TYPE.DROP:
							for (var offset = 3, length = 0 | data.byteLength; offset < length; offset = offset + 10 | 0) {
								var groupId = dataView.getUint16(offset, true),
									groupX = dataView.getFloat32(offset + 2 | 0, true),
									groupY = dataView.getFloat32(offset + 6 | 0, true),
									group = transformedboard[groupId];
								if (group) {
									group.x = groupX;
									group.y = groupY;
									preventOOBRotation(group);
									if (CMD_TYPE.PICK === cmdType) {
										wn(group);
										group.user = getUserById(roomUsers, userId);
										reorderGroupBySize(group);
									} else if (CMD_TYPE.DROP === cmdType && !group.selectedByOther) {
										//Released & Not selected (i.e. a single group move)
										group.user = void 0;
										Vr(group);
									}
								};
							}
							recountHeldPieces();
							break;
						case CMD_TYPE.SELECT:
						case CMD_TYPE.DESELECT:
						case CMD_TYPE.LOCK:
						case CMD_TYPE.UNLOCK:
						case CMD_TYPE.STEAL:
							for (var offset = 3, length = 0 | data.byteLength; offset < length; offset = offset + 2 | 0) {
								var groupId = dataView.getUint16(offset, true),
									group = transformedboard[groupId];
								if (group) {
									switch (cmdType) {
										case CMD_TYPE.SELECT:
											wn(group), group.user = getUserById(roomUsers, userId), group.selectedByOther = true, Vr(group);
											break;
										case CMD_TYPE.DESELECT:
										case CMD_TYPE.STEAL:
											group.user = void 0, group.selectedByOther = false, Vr(group);
											break;
										case CMD_TYPE.STEAL:
											//Unreachable code!
											wn(group);
											break;
										case CMD_TYPE.LOCK:
										case CMD_TYPE.UNLOCK:
											group.locked = CMD_TYPE.LOCK === cmdType, wn(group), refreshLockedDisplay();
									}
								}
							}
							recountHeldPieces();
							break;
						case CMD_TYPE.MERGE:
							var groupIdA = dataView.getUint16(3, true),
								groupIdB = dataView.getUint16(5, true);
							var groupA = transformedboard[groupIdA],
								groupB = transformedboard[groupIdB];
							if (groupA && groupB && groupA !== groupB) {
								wn(groupA);
								wn(groupB, true);
								var group = mergeGroups(groupA, groupB);
								group.x = dataView.getFloat32(7, true);
								group.y = dataView.getFloat32(11, true);
								preventOOBRotation(group);
								reorderGroupBySize(group);
								playsound(clicksound, .5);
							}
							if (roomdefGroups.length === localsetclone.length) {
								borderOpacity = 0;
								if (dlBox)
									dlBox.style.display = 'inline';
								playsound(completesound);
							}
							recountHeldPieces();
							break;
						case CMD_TYPE.ROTATE:
							for (let offset = 3; offset < dataView.byteLength; offset += 3) {
								const group = transformedboard[dataView.getUint16(offset, true)];
								if (!group) continue;
								setGroupRotation(group, dataView.getUint8(offset + 2));

								/* Special case for right-clicking unselected pieces.
								 * Anti-clockwise rotation can be done without PICK or SELECT */
								if (group.user || !nameTags.enabled) continue;
								requestAnimationFrame(() => {
									nameTags.show(userId);
									nameTags.set(userId, group.x, group.y, viewX, viewY, viewScale);
								});
							}
							break;
						case 0x60: { // records update
							let nrec = [];
							for (var ptr = 3; ptr < data.byteLength; ptr += 6) {
								nrec.push({
									id: dataView.getUint16(ptr, true),
									pos: [
										dataView.getUint16(ptr + 2, true),
										dataView.getUint16(ptr + 4, true)
									]
								});
							}
							records = nrec;
							break;
						}
						case CMD_TYPE.HEARTBEAT:
							allocateCommandBuffer(11, 3);
							uploadCommandBuffer(tmpbuffer.subarray(0, 3));
							receivedHeartBeat = true;
							break;
						default:
							console.log("invalid message", data);
					}
				}
				firstTextureLoadFinished = true;
			}
		};

		webSocket.onclose = function(err) {
			console.log(err);
			loadingBoxElem.style.display = "block";
			loadingTextElem.textContent = "Connecting...";
			isConnected = false;
			playerID = 0;
			Z = setTimeout(initConnection, 100);
		};
	}

	/**
	 * @param {Group} group
	 * @param {number} rot [0-3]
	 */
	function setGroupRotation(group, rot) {
		const rev = 2 * Math.PI;
		let tAngle = rot * rev / 4;
		if (rot === (group.rot + 1) % 4) {
			while (tAngle < group.angle) tAngle += rev;
			while (tAngle - rev > group.angle) tAngle -= rev;
		} else {
			while (tAngle > group.angle) tAngle -= rev;
			while (tAngle + rev < group.angle) tAngle += rev;
		}
		group.targetAngle = tAngle;
		group.rot = rot;
		preventOOBRotation(group);
	}

	function reorderGroupBySize(group) {
		Vr(group);
		extractFromArray(roomdefGroups, group);
		for (var i = roomdefGroups.length; i > 0; i--)
			if (roomdefGroups[i - 1].pieces.length >= group.pieces.length)
				return void roomdefGroups.splice(i, 0, group);
		roomdefGroups.unshift(group);
	}

	function wn(group, isSelected) {
		if (group.dragged) {
			for (var i = 0; i < groups__unknown.length; i++) {
				if (groups__unknown[i] === group) {
					groups__unknown.splice(i, 1);
					break;
				}
			}
			group.dragged = false;
		}
		if (!isSelected) {
			group.selected = false;
		}
		Vr(group);
	}

	function getUserById(users, id) {
		for (var i = 0; i < users.length; i++)
			if (users[i].id === id) return users[i];
	}

	function extractFromArray(arr, obj) {
		var i = arr.indexOf(obj); - 1 !== i && arr.splice(i, 1);
	}

	function toRgbaNum(colorCode) {
		var hex = parseInt(colorCode.substr(1), 16);
		return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex >> 0 & 255) / 255, 1];
	}

	function createTexture() {
		var e = gpucontext.createTexture();
		if (!e) throw new Error("Failed to create texture");
		return e;
	}

	function reveal() {
		chatInputElem.style.display = "block", chatInputElem.focus();
	}

	function hide() {
		chatInputElem.blur();
		chatInputElem.value = "";
		chatInputElem.style.display = "none";
	}

	function updateDonePercent() {
		var e = setPieces.reduce((function(e, t) {
				return e + t.length;
			}), 0),
			t = 100 * (1 - (roomdefGroups.length - localsetclone.length) / (e - 1));
		pieceBoxElem.title = "".concat(e, " pieces, ").concat(t.toFixed(), "% done");
	}

	function loadFromLocalStorage(key) {
		try {
			return localStorage.getItem(key);
		} catch (e) {
			return;
		}
	}

	function setLocalStorage(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch (e) {}
	}

	function loadFloatSetting(key, fallback) {
		var f = parseFloat(loadFromLocalStorage(key));
		return Number.isNaN(f) ? fallback : f;
	}

	function getElementById(id) {
		return documentref.getElementById(id);
	}

	function createElemWithClass(tag, className) {
		var n = documentref.createElement(tag);
		return className && (n.className = className), n;
	}

	function createTextNode(e) {
		return documentref.createTextNode(e);
	}

	function createSVG(viewBox, pathData) {
		var n = "http://www.w3.org/2000/svg",
			a = documentref.createElementNS(n, "svg");
		a.setAttribute("class", "svg-icon"), a.setAttribute("viewBox", viewBox);
		var i = documentref.createElementNS(n, "path");
		return i.setAttribute("fill", "currentColor"), i.setAttribute("d", pathData), a.appendChild(i), a;
	}

	function addMouseHandlers(e) {
		attachEvents(e, ["mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "wheel"], attachMobileHandlers);
	}

	function addClickHandlers(eventTarget, callback) {
		attachEvents(eventTarget, "click", callback);
		addMouseHandlers(eventTarget);
	}

	function attachEvents(eventTarget, types, callback) {
		"string" == typeof types ? eventTarget.addEventListener(types, callback, {
			passive: false
		}) : types.map((function(t) {
			return eventTarget.addEventListener(t, callback, {
				passive: false
			});
		}));
	}

	function attachMobileHandlers(event) {
		"touchstart" === event.type && setMobile(), "touchstart" !== event.type && "mousedown" !== event.type || preloadsoundeffects(), event.stopPropagation();
	}
	vn(), addClickHandlers(timerBoxElement, (function() {
		setLocalStorage("timer", (enableTimer = !enableTimer) ? "y" : "n"), vn();
	})), setInterval(fullTimeFormat, 1e3);

    
    // MyEdit START

    var myPiecesNear = [];
    var myMarkColor = [0, 1, 1, 1];

    function my_getSelectedPiece(group, mouseX, mouseY) {
        var gameX = mouseX - group.x
        var gameY = mouseY - group.y;

        var rot = (4 - group.rot) % 4;
        var groupX = getRotatedX(rot, gameX, gameY);
        var groupY = getRotatedY(rot, gameX, gameY);
        for (var i = 0, pieces = group.pieces; i < pieces.length; i++) {
            var piece = pieces[i];
            if (posIsInPiece(groupX, groupY, piece) &&
                    (cpudrawingcontext.beginPath(),
                    drawJigShapePath(cpudrawingcontext, piece.x + piece.puzzleX, piece.y + piece.puzzleY, piece.puzzle),
                    cpudrawingcontext.isPointInPath(groupX, groupY))) {
                return piece;
            }
        }
        return null;
    }
    function my_getNeighborPiece(group, piece, relX, relY, cols) {
        return setPieces[group.set][piece.xi + relX + (piece.yi + relY) * cols];
    }

    function my_markNear(group, mouseX, mouseY) {
        console.log(`Rot: ${group.rot}, Angle: ${group.angle}`);
        console.log(`Pos(${group.x + ", " + group.y}), Start(${group.startX + ", " + group.startY})`);
        console.log(`xi: ${group.pieces[0].xi}, yi: ${group.pieces[0].yi}`);

        var piece = my_getSelectedPiece(group, mouseX, mouseY);
        if(piece == null) {
            console.log("[MY] Selected piece not found!");
            return;
        }
        
        var set = localsetclone[group.set];
        if (!set) {
            console.log("[MY] Set is empty!");
            return;
        }
        myPiecesNear.push(my_getNeighborPiece(group, piece, 1, 0, set.cols));
        myPiecesNear.push(my_getNeighborPiece(group, piece, -1, 0, set.cols));
        myPiecesNear.push(my_getNeighborPiece(group, piece, 0, 1, set.cols));
        myPiecesNear.push(my_getNeighborPiece(group, piece, 0, -1, set.cols));
    }

    function my_unmarkNear() {
        myPiecesNear = [];
    }

    function my_drawNear() {
        if(myPiecesNear.length == 0) return;
        if (previousSelecter !== myMarkColor) {
            executeDrawingCommands(gt);
            previousSelecter = myMarkColor;
            updateUniformColor(jigshader.uniforms.highlightColor, previousSelecter);
        }
        for (var i = 0; i < myPiecesNear.length; i++) {
            setupPieceGeometry(myPiecesNear[i], 0, 0, 0);
        }
    }
    // MyEdit END

})(window, document);

/**
 * @param {Document} documentref
 * @param {HTMLElement} containerElem
 */
function nameTagsModule(documentref, containerElem) {
	/**@type {{elem:HTMLDivElement, x:number, y:number, hidden:number}[]} */
	const tags = [];
	const container = containerElem;
	let enabled = true;
	let lastViewX = 0,
		lastViewY = 0;

	/**
	 * @param {number} viewX
	 * @param {number} viewY
	 * @param {number} scale
	 * @param {{x:number, y:number, user:{id:number}}[]} groups
	 */
	function drawTags(viewX, viewY, scale, groups) {
		if (!enabled) return;
		const selections = [];

		groups.forEach((group) => {
			if (!group.user) return;
			const id = group.user.id;
			const rect = selections[id] ??= [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 0, 0];
			rect[0] = Math.min(rect[0], group.x);
			rect[1] = Math.min(rect[1], group.y);
			rect[2] = Math.max(rect[2], group.x);
			rect[3] = Math.max(rect[3], group.y);
		});

		const viewHasMoved = lastViewX != viewX || lastViewY != viewY;
		for (let id = 0; id < tags.length; id++) {
			const tag = tags[id];
			if (!tag) continue;
			const selection = selections[id];
			if (selection) {
				const [x1, y1, x2, y2] = selection;
				const x = (x1 + x2) * .5,
					y = (y1 + y2) * .5;
				if (tag.hidden) show(id);
				if (!viewHasMoved && tag.x === x && tag.y === y) continue;
				tag.x = x, tag.y = y;
				tag.elem.style.translate = (viewX + x) * scale + "px " + (viewY + y) * scale + "px";
			} else if (tag.hidden !== 2) {
				if (viewHasMoved) {
					tag.elem.style.translate = (viewX + tag.x) * scale + "px " + (viewY + tag.y) * scale + "px";
				}
				if (!tag.hidden) {
					tag.hidden = 1;
					setTimeout(hide, 0, id); //Let the DOM css update first.
				}
			}
		}
		lastViewX = viewX, lastViewY = viewY;
	}

	function add(userId, name, color, isHost = userId == 1) {
		let tag = tags[userId],
			elem = tag?.elem;
		if (!tag) {
			tags[userId] = tag = {
				x: 0,
				y: 0,
				hidden: 2,
				elem: elem = container.appendChild(documentref.createElement("div"))
			};
			elem.style.display = "none";
			elem.addEventListener("transitionend", () => {
				tag.elem.style.display = "none";
				tag.hidden = 2;
			});
		}
		elem.classList.toggle("host", isHost);
		elem.style.color = color;
		elem.textContent = name.trim();
	}

	function set(userId, x, y, viewX, viewY, viewScale) {
		const tag = tags[userId];
		if (!tag) return;
		const elem = tag.elem;
		tag.x = x;
		tag.y = y;
		elem.style.translate = (viewX + x) * viewScale + "px " + (viewY + y) * viewScale + "px";
	}

	function show(userId) {
		const tag = tags[userId];
		if (!tag) return;
		tag.elem.style.display = "";
		tag.elem.classList.remove("fade-out");
		tag.hidden = 0;
	}

	function hide(userId) {
		const tag = tags[userId];
		if (!tag) return;
		tag.elem.classList.add("fade-out");
		tag.hidden = 1;
	}

	function remove(userId) {
		tags[userId]?.elem.remove();
		tags[userId] = null;
	}

	function clear() {
		container.replaceChildren();
		tags.length = 0;
	}

	return {
		drawTags,
		set,
		show,
		hide,
		remove,
		add,
		clear,
		get enabled() {
			return enabled;
		},
		set enabled(enable) {
			enabled = enable;
			container.style.display = enable ? "" : "none";
		}
	};
}