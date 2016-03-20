//INIT PART
var sentData = {};
var connects = {};
var markers = {};
var active = false;
var socket = io.connect("/");
var bounds = new google.maps.LatLngBounds();
var myLatlng;
var yelpRectangle;
var yelpArea;
var ne;
var sw;
var yelpResTmp = [];
var yelpFilterRes = [];
var yelpMarker = [];


var userId = $('#userIdInput').val();
		//set userID cookie
		var date = new Date();
        date.setTime(date.getTime()+(60*1000)); 
        var expires = "; expires="+date.toGMTString();
        document.cookie = "cUserId="+userId+expires+"; path=/";

var info = $("#infobox");
var doc = $(document);
console.log("User Info:" + userId);

$("#nameTxn").val(userId);
$("#nameValue").val(userId);

socket.on("load:coords", function(data){
	console.log("load:coords:"+data.id);
	if(!(data.id in connects)){
		setMarker(data);
	}
	connects[data.id] = data;
	connects[data.id].updated = $.now();
});

if(navigator.geolocation){
		navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
}
else{
		$("#map").text("Your browser is out of fashion, there\'s no geolocation!");
}


function initMap(){
		window.map = new google.maps.Map(document.getElementById('map'), {
		center: {lat: 42.428996, lng: -71.077269},
		zoom: 8
	});
		bounds = new google.maps.LatLngBounds();
}

function positionSuccess(position){
	initMap();
	var lat = position.coords.latitude;
	var lng = position.coords.longitude;
	var acr = position.coords.accuracy;
	console.log("My Coords is :"+lat+", "+lng);
	var myLatlng = new google.maps.LatLng(lat, lng);
	var userMarker = new google.maps.Marker({
		    position: myLatlng
	});
	markers[userId] = userMarker;
	userMarker.setMap(map);
	bounds.extend(userMarker.position);
	google.maps.event.trigger(map, 'resize');

	doc.on("mousemove", function(){
		active = true;
		sentData = {
			chatId: $('chatIdInput').val(),
			id: userId,
			active: active,
			coords:[{
				lat: lat,
				lng: lng,
				acr: acr
			}]
		}
		if($('chatIdInput').val()){
			socket.emit("send:coords", sentData);
		}
	});
}

	doc.bind("mouseup mouseleave", function(){
		active = false;
	});



function setMarker(data){
	console.log("setMarker Method is running : lat"+data.coords[0].lat+" lng"+data.coords[0].lng);
	for(i=0; i<data.coords.length; i++){
		var myLatlng = new google.maps.LatLng(data.coords[i].lat, data.coords[i].lng);
		var userMarker = new google.maps.Marker({
		    position: myLatlng
		});
		console.log("Marker["+data.id+"] is:"+data.coords[i].lat+", "+data.coords[i].lng);
		userMarker.setMap(map);
		markers[data.id] = userMarker;
		bounds.extend(userMarker.position);
	}
	map.fitBounds(bounds);
	console.log("mapFitBounds:"+bounds);
 
}

// handle geolocation api errors
function positionError(error) {
	var errors = {
		1: "Authorization fails", // permission denied
		2: "Can\'t detect your location", //position unavailable
		3: "Connection timeout" // timeout
	};
	showError("Error:" + errors[error.code]);
}

function showError(msg) {
	info.addClass("error").text(msg);
}

	// delete inactive users every 15 sec
setInterval(function() {
	for(ident in connects){
		if ($.now() - connects[ident].updated > 100000) {
			console.log("Gonna Delete ident");
			delete connects[ident];
			var markerDelete = markers[ident];
			markerDelete.setMap(null);
			delete markers[ident];
			reBounds();
			google.maps.event.trigger(map, 'resize');
			console.log("Delete Complete");
		}
       }
    }, 100000);


function reBounds(){
	console.log("reBound After lose marker...on constructing");
}


$( "#bbulink" ).click(function() {
	console.log("click polygonBtn");

  	var coordsArr = [];
	for(var mark in markers){
		var point = {lat: markers[mark].position.lat(), lng: markers[mark].position.lng()};
		console.log("positionForPolygon: "+markers[mark].position.lat()+", "+markers[mark].position.lng());
		coordsArr.push(point);
	}

	// Construct the polygon.
  yelpArea = new google.maps.Polygon({
    paths: coordsArr,
    strokeColor: '#FF0000',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    fillColor: '#FF0000',
    fillOpacity: 0.35
  });
  yelpArea.setMap(map);

	var centerCoords = new google.maps.LatLng(bounds.getCenter().lat(), bounds.getCenter().lng());
	var centerMarker = new google.maps.Marker({
	    position: centerCoords
	});
	centerMarker.setMap(map);

	yelpRectangle = new google.maps.Rectangle({
				bounds: bounds,
				map: map,
				fillColor: "#000000",
				fillOpacity: 0.2,
				strokeWeight: 0
	});

	ne = yelpRectangle.getBounds().getNorthEast();
  	sw = yelpRectangle.getBounds().getSouthWest();
  	yelpBounds();
});


function yelpBounds(){
  	console.log("Send yelp Bounds to Server...");
  	socket.emit('sendYelpBounds', ne.lat(),ne.lng(), sw.lat(), sw.lng());
}


socket.on("getApiData", function(data){
	yelpResTmp = data['businesses'];

	for(j=0; j<yelpResTmp.length; j++){
		console.log(yelpResTmp[j]['id']+"Lat:"+yelpResTmp[j]['location']['coordinate'].latitude+" Lng:"+yelpResTmp[j]['location']['coordinate'].longitude);
		var resLatLng = new google.maps.LatLng({lat:yelpResTmp[j]['location']['coordinate'].latitude, lng:yelpResTmp[j]['location']['coordinate'].longitude}); 
		var bool = google.maps.geometry.poly.containsLocation(resLatLng, yelpArea);
		console.log(yelpResTmp[j]['id']+":"+bool);
		if(bool == true){
			var yelpTmpMarker = new google.maps.Marker({
				    position: resLatLng
			});
			yelpMarker[yelpResTmp[j]['id']] = yelpTmpMarker;
			yelpTmpMarker.setMap(map);
			yelpFilterRes.push(yelpResTmp[j]);
		}
	}

});

//Script for Chat//
var getNode = function(s){
	return document.querySelector(s);
}
var messages = getNode('.chat-messages');
var textarea = getNode('#inputTxn');
var chatName = getNode('#nameValue');

$("#sendBtn").click(function(e) {
        e.preventDefault();
        var userId = $("#userIdInput").val();
        var chatId = $("#chatIdInput").val();
        var userName = $("#userNameInput").val();
        var message = $("#txtInput").val().toString().replace(/^\s+|\s+$/g,'');

        if(!message){
        		var msg = "Message can't be empty...";
        		$('#errMsg').html("<span id='errContent'> "+msg+"</span>");
				$('#error').popup('show');
        }
        else{
        	if(!userId || !chatId || !userName){
        		var msg = "Message can't be send, please try later...";
        		$('#errMsg').html("<span id='errContent' "+msg+"</span>");
				$('#error').popup('show');
	        }
	        else{
	        	socket.emit('chatInput', {
	                "userId":userId,
	                "userName":userName,
	                "chatId":chatId,
	                "message":message
	        	});
	        }
        }
        
});

socket.on("chatOutput", function(data){
	console.log("Message Received from: "+data.userName);
	var msg = document.createElement('div');
	msg.setAttribute('class','chat-message');

	var chatUser = document.createElement('span');
	chatUser.setAttribute('class','chat-person');
	chatUser.textContent = data.userName;

	var chatMsg = document.createElement('span');
	chatMsg.textContent = ": "+data.message;

	msg.appendChild(chatUser);
	msg.appendChild(chatMsg);
	

	//append 
	messages.appendChild(msg);
	messages.insertBefore(msg, messages.firstChild);
});


//Generate Link//
$("#shareBtn").click(function(e) {
        e.preventDefault();
        socket.emit('createRecord', {
        	"userId":userId,
        	"userName":$("#nameValue").val(),
        	"sharedLink":$('#sharedLink').val()
		});
});

socket.on("shareLink", function(data){
	console.log("Get the share link:" + data);
	//set shared link cookie
	var date = new Date();
    date.setTime(date.getTime()+(60*1000)); 
    var expires = "; expires="+date.toGMTString();
    document.cookie = "cSharedLink="+decodeURIComponent(data)+expires+"; path=/";

    var chatId = data.toString().split('/')[4];
    $('#chatIdInput').val(chatId);
	$('#sharedLink').val(data);
	$('#content').html("<input type='text' id='linkContent' value='"+data+"'>");
	$('#link').popup('show');
});


//Around Me

//errorAlert: deal with all kinds of errorMsg
socket.on("errorAlert", function(data){
	$("#errorMsg").val(data.message);
	$('#error').popup('show');
});


