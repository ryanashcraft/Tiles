var lastFocusedWindowID = null;

chrome.tabs.onActivated.addListener(function(info) {
	chrome.tabs.get(info.tabId, function(tab) {
		updateTab(tab);
	});
});

chrome.tabs.onUpdated.addListener(function(tabID, changeInfo, tab) {
	if (tab.active) {
		updateTab(tab);
	}
});

chrome.windows.onFocusChanged.addListener(function(windowID) {
	if (windowID == -1) {
		return;
	}

	lastFocusedWindowID = windowID;

	chrome.windows.get(windowID, { populate: true }, function(window) {
		console.log("Last focused window is now ID " + window.id);

		updateWindow(window);
	});
});

chrome.contextMenus.removeAll(function() {
	chrome.contextMenus.create({
	    "title": "Tiles Options",
	    "documentUrlPatterns": [chrome.extension.getURL("/") + "*"],
	    "contexts": ["page", "link"],
	    "onclick" : function() {
	    	goToOptionsPage(true)
	    }
	});
});

function goToOptionsPage(newTab) {
	var optionsURL = chrome.extension.getURL("options/options.html");

	if (newTab) {
		chrome.tabs.create({
			url: optionsURL
		});
	} else {
		chrome.tabs.getCurrent(function(tab) {
			chrome.tabs.update(tab.id, { url : optionsURL })
		});
	}
}

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
	console.log('Message received: ' + request.message);

	if (request.message == "getUrl") {
		getFocusedTab(function(tab) {
			if (tab) {
				sendResponse({ url: tab.url });

				console.log('Sent URL – ' + tab.url);
			}
		});
	} else if (request.message == "saved") {
		getFocusedTab(function(tab) {
			if (tab) {
				setPopup(false, false, tab.id);
				changeIcon(true, null, tab.id);

				sendResponse({message: "success"});

				console.log('Sent success');

				updateAllWindows();
			}
		});
	} else if (request.message == "delete") {
		console.log('Deleting....');

		getFocusedTab(function(tab) {
			if (!tab) {
				return;
			}

			function deleteSiteCallback() {
				if (!request.url) {
					setPopup(true, false, tab.id);
					changeIcon(false, null, tab.id);
				}

				sendResponse({message: "deleted"});

				chrome.extension.sendMessage({message: "deleted"}, function(response) { });

				console.log('Sent deleted');

				updateAllWindows();
			}

			if (request.url == undefined) {
				console.log("Deleting site " + tab.url);
				deleteSite(tab.url, deleteSiteCallback);
			} else {
				console.log("Deleting site " + request.url);
				deleteSite(request.url, deleteSiteCallback);
			}
		});
	}

	return true;
});

function getFocusedTab(callback) {
	chrome.windows.get(lastFocusedWindowID, { populate: true }, function(window) {
		if (window && window.type != 'normal') {
			return callback(null);
		}

		var tabs = window.tabs;

		for (var j = 0; j < tabs.length; j++) {
			if (tabs[j].active) {
				return callback(tabs[j]);
			}
		}
	});
}

function setPopup(save, error, tabID) {
	var details = {};

	if (error) {
		details.popup = 'browserAction/error.html';
	} else {
		if (save) {
			details.popup = 'browserAction/save.html';
		} else {
			details.popup = 'browserAction/delete.html';
		}
	}

	details.tabId = tabID;

	chrome.browserAction.setPopup(details);

	// console.log('Popup is set to ' + details.popup);
}

function updateWindow(window) {
	if (window && window.type == 'normal') {
		var tabs = window.tabs;

		for (var i = 0; i < tabs.length; i++) {
			if (tabs[i].active) {
				if (window.focused) {
					console.log("Window ID " + window.id + " is focused on active tab on ID: " + tabs[i].id + " which is at " + tabs[i].url);
				} else {
					console.log("Window ID " + window.id + " is has active tab ID: " + tabs[i].id + " which is at " + tabs[i].url);
				}

				updateTab(tabs[i]);

				break;
			}
		}
	}
}

function updateAllWindows() {
	chrome.windows.getAll({ populate: true }, function(windows) {
		console.log('Updating all windows...');

		for (var i = 0; i < windows.length; i++) {
			updateWindow(windows[i]);
		}
	});
}

function updateTab(tab) {
	console.log("Updating tab ID: " + tab.id + " which is at " + tab.url);

	if (isChromeURL(tab.url)) {
		setPopup(false, true, tab.id);
	} else {
		siteExists(tab.url, function(exists) {
			setPopup(!exists, false, tab.id);

			changeIcon(exists, null, tab.id);
		});
	}
}

function isChromeURL(url) {
	return url.substring(0, 6) == 'chrome';
}

function siteExists(url, callback) {
	getSites(function(sites) {
		if (sites) {
			for (var i = 0; i < sites.length; i++) {
				if (sites[i].url == url) {
					return callback(true);
				}
			}
		}

		return callback(false);
	});
}

function changeIcon(colors, callback, tabID) {
	var details = {};

	if (colors) {
		details.path = '../icons/icon-bitty.png';
	} else {
		details.path = '../icons/icon-bitty-gray.png';
	}

	console.log("Changing icon for " + tabID + " to " + details.path);

	details.tabId = tabID;

	chrome.browserAction.setIcon(details, callback);
}