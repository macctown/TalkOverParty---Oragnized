//INIT PART
var sentData = {};
var connects = {};
var markers = {};
var active = false;
var socket = io.connect("/");
var myLatlng;
var yelpRectangle;
var yelpArea;
var ne;
var sw;
var yelpResTmp = [];
var yelpFilterRes = [];
var yelpMarker = [];
var myLat;
var myLng;
var iconBase = 'http://talkover.party/img/icon/';
var icons = {
  user: {
    icon: iconBase + 'user.png'
  },
  restaurant: {
    icon: iconBase + 'restaurant.png'
  },
  bar: {
    icon: iconBase + 'bar.png'
  }
};

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


try {
	var bounds = new google.maps.LatLngBounds();
}
catch(e){
	locatoin.reload();
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
	myLat = lat;
	var lng = position.coords.longitude;
	myLng = lng;
	var acr = position.coords.accuracy;
	console.log("My Coords is :"+lat+", "+lng);
	var myLatlng = new google.maps.LatLng(lat, lng);
	var userMarker = new google.maps.Marker({
		    position: myLatlng,
		    icon: icons['user'].icon
	});
	markers[userId] = userMarker;
	userMarker.setMap(map);
	bounds.extend(userMarker.position);
	google.maps.event.trigger(map, 'resize');


	setInterval(function() {
      // update user location every 5 seconds
      active = true;
		sentData = {
			chatId: $('#chatIdInput').val(),
			id: userId,
			active: active,
			coords:[{
				lat: lat,
				lng: lng,
				acr: acr
			}]
		}
		if($('#chatIdInput').val()){
			socket.emit("send:coords", sentData);
		}
	}, 5000);
}

	doc.bind("mouseup mouseleave", function(){
		active = false;
	});



function setMarker(data){
	console.log("setMarker Method is running : lat"+data.coords[0].lat+" lng"+data.coords[0].lng);
	for(i=0; i<data.coords.length; i++){
		var myLatlng = new google.maps.LatLng(data.coords[i].lat, data.coords[i].lng);
		var userMarker = new google.maps.Marker({
		    position: myLatlng,
			icon: icons['user'].icon
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
	console.log(coordsArr.length + "markers on map now...");
	if(coordsArr.length == 0){
		//no marker on map, something wrong
		var msg = "Map error occured, please refresh page and try later...";
		$.notify(msg);
	}
	else if(coordsArr.length == 1){
		//1 marker, search by radius
		var msg = "You're the only one, please use [Around Me] function in menu";
		$.notify(msg);
	}
	else if(coordsArr.length == 2){
		if(yelpArea){
			refereshYelpArea();
		}
		//2 markers, draw a line and search
		var centerCoords = new google.maps.LatLng(bounds.getCenter().lat(), bounds.getCenter().lng());
		var radius = getDistanceFromLatLonInMiles(coordsArr[0].lat, coordsArr[0].lng, centerCoords.lat(), centerCoords.lng());
		console.log("search radius is: "+radius + "miles");
		yelpArea = new google.maps.Circle({
	      strokeColor: '#FF0000',
	      strokeOpacity: 0.8,
	      strokeWeight: 2,
	      fillColor: '#FF0000',
	      fillOpacity: 0.35,
	      map: map,
	      center: centerCoords,
	      radius: radius * 1069.34
	    });
		socket.emit('sendYelpLinearBounds', centerCoords.lat(),centerCoords.lng(), radius);
	}
	else{
		if(yelpArea){
			refereshYelpArea();
		}
		//3 or more marksers, draw polygon and search
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
						fillOpacity: 0,
						strokeWeight: 0
			});

			ne = yelpRectangle.getBounds().getNorthEast();
		  	sw = yelpRectangle.getBounds().getSouthWest();
		  	yelpBounds();
	}
	map.fitBounds(yelpArea.getBounds());

});


function yelpBounds(){
  	console.log("Send yelp Polygon Bounds to Server...");
  	socket.emit('sendYelpBounds', ne.lat(),ne.lng(), sw.lat(), sw.lng());
}


socket.on("getApiDataInPoly", function(data){
	if((yelpMarker)||(yelpFilterRes)){
		refreshYelpResult();
	}

	console.log(data['businesses']);
	yelpResTmp = data['businesses'];

	for(j=0; j<yelpResTmp.length; j++){
		console.log(yelpResTmp[j]['id']+" Lat:"+yelpResTmp[j]['location']['coordinate'].latitude+" Lng:"+yelpResTmp[j]['location']['coordinate'].longitude);
		var resLatLng = new google.maps.LatLng({lat:yelpResTmp[j]['location']['coordinate'].latitude, lng:yelpResTmp[j]['location']['coordinate'].longitude}); 
		console.log("YelpArea set: "+yelpArea);
		var bool = google.maps.geometry.poly.containsLocation(resLatLng, yelpArea);
		console.log(yelpResTmp[j]['id']+":"+bool);

		if(bool == true){
			yelpMarker[yelpResTmp[j]['id']] = new google.maps.Marker({
				    position: resLatLng,
				    icon: icons['restaurant'].icon
			});
			//yelpMarker[yelpResTmp[j]['id']].setMap(map);
			yelpFilterRes.push(yelpMarker[yelpResTmp[j]['id']]);
			yelpFilterRes[yelpFilterRes.length-1].setMap(map);
		}
	}
});

socket.on("getApiDataInCircle", function(data){
	if((yelpMarker)||(yelpFilterRes)){
		refreshYelpResult();
	}

	yelpResTmp = data['businesses'];

	for(j=0; j<yelpResTmp.length; j++){
		var resLatLng = new google.maps.LatLng({lat:yelpResTmp[j]['location']['coordinate'].latitude, lng:yelpResTmp[j]['location']['coordinate'].longitude}); 
        console.log(yelpResTmp[j]['id']+" Lat:"+yelpResTmp[j]['location']['coordinate'].latitude+" Lng:"+yelpResTmp[j]['location']['coordinate'].longitude);
		yelpMarker[yelpResTmp[j]['id']] = new google.maps.Marker({
			    position: resLatLng,
			    icon: icons['restaurant'].icon
		});
		//yelpMarker[yelpResTmp[j]['id']].setMap(map);
		yelpFilterRes.push(yelpMarker[yelpResTmp[j]['id']]);   
		yelpFilterRes[yelpFilterRes.length-1].setMap(map);  
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
				$.notify(msg);
        }
        else{
        	if(!userId || !chatId || !userName){
        		var msg = "Message can't be send, please refresh page and try later...";
				$.notify(msg);
	        }
	        else{
	        	socket.emit('chatInput', {
	                "userId":userId,
	                "userName":userName,
	                "chatId":chatId,
	                "message":message
	        	});
	        	$("#txtInput").val("");
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
$("#aroundBtn").click(function(e) {
	if(yelpArea){
		refereshYelpArea();
	}

	if((yelpMarker)||(yelpFilterRes)){
		refreshYelpResult();
	}
	var myLatlng = new google.maps.LatLng(myLat,myLng);
	yelpArea = new google.maps.Circle({
	      strokeColor: '#FF0000',
	      strokeOpacity: 0.8,
	      strokeWeight: 2,
	      fillColor: '#FF0000',
	      fillOpacity: 0.35,
	      map: map,
	      center: myLatlng,
	      radius: 10 * 1069.34
	});
	map.fitBounds(yelpArea.getBounds());
	socket.emit('sendYelpLinearBounds', myLat,myLng, 10);
});


//errorAlert: deal with all kinds of errorMsg
socket.on("errorAlert", function(data){
	$("#errorMsg").val(data.message);
	$('#error').popup('show');
});

//function library
function getDistanceFromLatLonInMiles(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  var miles = d *0.621371;
  return miles;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function refereshYelpArea(){
	yelpArea.setMap(null);
	yelpArea = null;
}

function refreshYelpResult(){

	yelpMarker = [];

	for(var child=0;child<yelpFilterRes.length;child++){
		console.log("yelpFilterRes child: " + yelpFilterRes[child]);
		yelpFilterRes[child].setMap(null);
	}
	yelpFilterRes = [];

	yelpResTmp = [];
}

