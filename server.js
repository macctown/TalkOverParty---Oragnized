var express = require('express')
	, http = require('http');
var static = require('node-static');
var app = express(),
	server = http.createServer(app),
	io = require('socket.io').listen(server);
var session = require("express-session");
var cookieParser = require('cookie-parser')
const MongoStore = require('connect-mongo')(session);
var Yelp = require('yelp');
var mongoose = require('mongoose');
var ObjectId = require('mongoose').Types.ObjectId; 
var uuid = require('node-uuid');
var winston = require('winston');
var Schema = mongoose.Schema;


var northeastLat;
var northeastLng;
var southwestLat;
var southwestLng;

var handlebars = require('express3-handlebars').create({defaultLayout:'main'});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: 'info',
            filename: './logs/yelp-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, //5MB
            maxFiles: 5,
            colorize: false
        }),
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

app.use(cookieParser());

app.use(express.static(__dirname + '/public'));
// create a schema
var userSchema = new Schema({
  userId: {type: String, unique:true},
  socketId: String
});

var msgSchema = new Schema({
  userId: String,
  userName: String,
  msgContent: String,
  msgDate: Date
});

var chatSchema = new Schema({
  chatUsers: [userSchema],
  chatContent: [msgSchema],
  chatCreateDate: Date,
  chatActive: Boolean
});

io.on('connection', function(socket){
	
	var yelp = new Yelp({
		consumer_key: 'v4hjI53TEiOPzQxkazpR6A',
		consumer_secret: 'TXXFLEu-KXOipXVOKRgDx1v_Py8',
		token: 'FChFCtuAmyPaRxYiJI0IlWhwc-svbOnX',
		token_secret: 'n9oaLmDrjSJjmpCQ748EQPo_-Lk',
	});


	socket.on('send:coords', function(data){
		//need to be comment this log, cuz it will be triggered when user does any move
		//logger.info(data.id + " from chat room: "+ data.chatId +" send geo info from: "+data.coords['lat'] + ", "+data.coords['lng']);

		//get socket from thr chat room
		var conn = mongoose.createConnection('mongodb://127.0.0.1:27017/talkParty', function(err) {
			    if(err){
				    logger.error(err);
				    socket.emit('errorAlert', err);
			    }
			    else{
					//console.log("User Name Session Set: "+session);
					logger.info("MongoDB Connected for send GEO info!");
				}
			});

		var Chat = conn.model('Chat', chatSchema);		
		Chat.findOne({'_id': new ObjectId(data.chatId)}, function(err, chat) {
            if (err){
            	logger.error("Error occured while looking for chat room: "+err);
        		socket.emit('errorAlert', err);
            }
            else{
            	logger.info("Length: "+chat.chatUsers.length);
            	//emit msg to each chatee
            	for(var i=0; i<chat.chatUsers.length; i++)
            	{
            		logger.info("Send GEO info to: " + data.id +" with socketId:" + chat.chatUsers[i].socketId);
            		//send to client
            		io.to(chat.chatUsers[i].socketId).emit('load:coords', data);
            	}
            }
        });
	});


	socket.on('disconnect', function(){
		logger.info('A User Dicsonnected');
	});


	//1 or 2 people search
	socket.on('sendYelpLinearBounds', function (centerLat, centerLng, term, radius){
		logger.info("Going to search ["+ term +"] from center "+centerLat +", "+centerLng + "with radius: "+ radius + " miles");
		var radiusInMeter = radius * 1069.34;
		yelp.search({ term: term, ll: centerLat+","+centerLng, radius_filter: radiusInMeter })
		.then(function (data) {
		  logger.info("Yelp API Data: "+Object.keys(data));
		  socket.emit('getApiDataInCircle', data);
		})
		.catch(function (err) {
		  logger.error(err);
		  socket.emit('yelpError', err.data);
		});
	});

	//3 or more than 3 people search
	socket.on('sendYelpBounds', function (neLat, neLng, swLat, swLng, term) {
	   //socket.emit('serverMessage', 'Got a message!');
	   northeastLat = neLat;
	   northeastLng = neLng;
	   southwestLat = swLat;
	   southwestLng = swLng;

	   logger.info('Yelp Bounds NE-lat:', neLat,' , NE-lng:', neLng);
	   logger.info('Yelp Bounds SW-lat:', swLat,' , SW-lng:', swLng);

	   yelp.search({ term: term, bounds: northeastLat+","+northeastLng+"|"+southwestLat+","+southwestLng })
		.then(function (data) {
		  logger.info(data);
		  socket.emit('getApiDataInPoly', data);
		})
		.catch(function (err) {
		  logger.error(err);
		  socket.emit('yelpError', err.data);
		});
	});

	//update user SocketID into chat
	socket.on('refreshSocket', function(chatId, userId){
		logger.info(userId + " reopen and begin to update his socketId "+socket.id + " in chat room: "+chatId);

		var conn = mongoose.createConnection('mongodb://127.0.0.1:27017/talkParty', function(err) {
			    if(err){
				    logger.error(err);
				    socket.emit('errorAlert', err);
			    }
			    else{
					//console.log("User Name Session Set: "+session);
					logger.info("MongoDB Connected in fucntion: updateUserSocket!");
				}
			});


		var Chat = conn.model('Chat', chatSchema);

		Chat.update(
				{_id: chatId, 'chatUsers.userId':userId}, 
				{$set:{"chatUsers.$.socketId":socket.id}},
    			function(err, model) {	
    				if(err){
	        			logger.error("Error when refresh user socket: "+err);
	        			socket.emit('errorAlert', err);
    				}
    				else{
        				logger.info("User "+userId+" refresh his socket: "+socket.id+" into chat successfully");
    				}
        			
    		});

		/*Chat.find({_id: chatId}).exec(function(err, chat){
			if(chat.length != 0){
				logger.info("Get "+chat.length+" messages from Chat room "+chatId);
		    	logger.warn(JSON.stringify(chat));
		    	var chatRes = JSON.parse(JSON.stringify(chat));
		    	logger.warn(chatRes.chatContent);
			}

		});*/

	});

	//update userName and insert user into chat
	socket.on('joinUsertoChat', function(data){
		var userId = data.userId;
		var chatId = data.chatId;
		var userName = data.userName;
		var conn = mongoose.createConnection('mongodb://127.0.0.1:27017/talkParty', function(err) {
			    if(err){
				    logger.error(err);
				    socket.emit('errorAlert', err);
			    }
			    else{
					//console.log("User Name Session Set: "+session);
					logger.info("MongoDB Connected in fucntion: joinUsertoChat!");
				}
			});


		var Chat = conn.model('Chat', chatSchema);
		var User = conn.model('User', userSchema);

		if(chatId != ""){

			logger.info('User '+data.userId+" connected and going to join chat: "+chatId + "with socket: " + socket.id);
			var newUser = new User({
				userId: userId,
				socketId: socket.id
			});

			Chat.update(
				{_id: chatId, 'chatUsers.userId':{$ne: newUser.userId}}, 
				{$addToSet:{chatUsers:newUser}}, 
				{safe: true, upsert: true, unique: true},
    			function(err, model) {	
        			if(err&&err.code === 11000){
        				logger.warn("User"+userId+"has joined into chat before");
        			}
        			else{
        				if(err){
		        			logger.error("Error when join user into chat: "+err);
		        			socket.emit('errorAlert', err);
        				}
        				else{
	        				logger.info("User "+userId+" join into chat successfully");
        				}
        			}
        			
    		});
		}
		else{
			logger.info('User '+data.userId+" just connected");
			//That's it
		}
	});


	//send chat msg to the users in their own groups
	socket.on('chatInput', function(data){
		var name = data.userName,
			message = data.message,
			userId = data.userId,
			chatId = data.chatId;

		logger.info("userId: "+ userId +" userName: "+ name + " send message: " +message);
		logger.info("Find users in chat Room: " + chatId);

		var conn = mongoose.createConnection('mongodb://127.0.0.1:27017/talkParty', function(err) {
			    if(err){
				    logger.error(err);
				    socket.emit('errorAlert', err);
			    }
			    else{
					//console.log("User Name Session Set: "+session);
					logger.info("MongoDB Connected after saveName!");
				}
			});


		var Chat = conn.model('Chat', chatSchema);
		var Msg = conn.model('Msg', msgSchema);
		
		Chat.findOne({'_id': new ObjectId(chatId)}, function(err, chat) {
            if (err){
            	logger.error("Error occured while looking for chat room: "+err);
        		socket.emit('errorAlert', err);
            }
            else{
            	//emit msg to each chatee
            	for(var i=0; i<chat.chatUsers.length; i++)
            	{
            		var data = {userName: name, message: message, msgDate: new Date()};
            		logger.info("Send message to: " + name +" with socketId:" + chat.chatUsers[i].socketId);
            		//send to client
            		io.to(chat.chatUsers[i].socketId).emit('chatOutput', data);
            	}

            	/*
            	//store in mongodb
        		var newMsg  = new Msg({
        			userId: userId,
        			userName: name,
					msgContent: message,
					msgDate: new Date()
        		});

        		Chat.update(
				{_id: chatId}, 
				{$addToSet:{chatContent:newMsg}}, 
				{safe: true, upsert: true, unique: true},
    			function(err, model) {	
    				if(err){
	        			logger.error("Error when save message into chat: "+err);
	        			socket.emit('errorAlert', err);
    				}
    				else{
        				logger.info("User "+userId+" message saved into chat successfully");
    				}      			
    			});*/
            }
        });
	});


	//create a chat room and share link
	socket.on('createRecord', function(data){
		logger.info("Begin to create record for chat...");
		var userId = data.userId;
		var userSocketId = socket.id;
		var userName = data.userName;
		var userName = data.userName;

		logger.info(socket.handshake.headers.cookie.toString());
		logger.info(data.userId,"is going to create a conversation");
		if(socket.handshake.headers.cookie.toString().indexOf('cSharedLink') > -1){
			var cleanCookie = decodeURIComponent(socket.handshake.headers.cookie.toString());
			var sharedLinkLocate = cleanCookie.search('cSharedLink');
			var sharedLink = cleanCookie.substr(sharedLinkLocate+12, 55);
			logger.info("User Has Shared Link Before: "+sharedLink);
			socket.emit('shareLink', decodeURIComponent(sharedLink)); 
		}
		else{
			//Init chatID (equals the doc id in mongoDB)
			var chatID;

			var currentDate = new Date();

			var conn = mongoose.createConnection('mongodb://127.0.0.1:27017/talkParty', function(err) {
			    if(err){
				    logger.error(err);
				    socket.emit('errorAlert', err);
			    }
			    else{
					logger.info("MongoDB Connected when create new chat!");
				}
			});

			
			var Chat = conn.model('Chat', chatSchema);
			var User = conn.model('User', userSchema);


			var chatCreator = new User({
				userId: userId,
				socketId: socket.id
			});

			var newChat = new Chat({
				chatCreateDate: currentDate,
	  			chatActive: 1
			});


			newChat.chatUsers.push(chatCreator);
			newChat.save(function (err, res) {
			  	if(err&&err.code === 11000){
			    	logger.warn("Already in a chat! Can't create another one!");
			    	socket.emit('errorAlert','You are in chatting right now! Cant create new chat!');
			    }
			    else if(err&&err.code != 11000){
        			logger.error("Error when join user into chat: "+err);
        			socket.emit('errorAlert', err);
			    }
			    else{
			    	logger.info("Chat Created: "+res.id);
			    	var link = "http://talkover.party"+'/joinChat/'+res.id;
			    	 	var date = new Date();
					    date.setTime(date.getTime()+(60*1000)); 
					    var expires = "; expires="+date.toGMTString();
					socket.handshake.headers.cookie += ';cSharedLink='+decodeURIComponent(link)+expires+";path=/";
			    	logger.info("Link Cookie Created: "+link);
					socket.emit('shareLink', link); 
			    }
			});
		}

	});
	
});


server.listen(80, function () {
  logger.info('TalkOverParty Server Starts on Port 80!');
});


app.get('/joinChat/:chatId', function(req,res){
	res.type('text/plain');
	res.redirect('http://talkover.party/'+req.params.chatId)
});

app.get('/:chatId', function(req,res){
	var cookie_userId = req.cookies.cUserId;
	var data = {};
	if(typeof cookie_userId !== 'undefined' && cookie_userId){
		res.cookie('cUserId',cookie_userId, { maxAge: 60000, httpOnly: false });
		logger.info("chatId Page - ID Cookie Found and set: "+cookie_userId);
	}
	else{
		cookie_userId = uuid.v4();
		res.cookie('cUserId',cookie_userId, { maxAge: 60000, httpOnly: false });
		logger.info("chatId Page - ID Generated and set: "+cookie_userId);
	}

	if(req.params.chatId.toString().length == 24){
		var link = req.protocol + "://"+req.get('host')+"/joinChat/"+req.params.chatId;
		res.cookie('cSharedLink',link, { maxAge: 60000, httpOnly: false });
		logger.info("Reset sharedlink cookie: "+link);

		res.cookie('cChatId',req.params.chatId, { maxAge: 60000, httpOnly: false });
		logger.info("Set chatId cookie: "+req.params.chatId);		
		data = {userId:cookie_userId, chatId:req.params.chatId, sharedLink:link};
	}
	else{
		data = {userId:cookie_userId};
	}

	res.render('home', data);
});

app.get('/', function(req,res){
	var cookie_userId = req.cookies.cUserId;
	var data = "";
	if(typeof cookie_userId !== 'undefined' && cookie_userId){
		data = {userId:cookie_userId};
		res.cookie('cUserId',cookie_userId, { maxAge: 60000, httpOnly: false });
		logger.info("Index Page - ID Cookie Found and set: "+cookie_userId);
	}
	else{	
		var newuserId = uuid.v4();
		res.cookie('cUserId',newuserId, { maxAge: 60000, httpOnly: false });
		logger.info("Index Page - cookie userId Generated and set: "+newuserId);
		data = {userId:newuserId};
	}

	res.render('home',data);
	
});

app.use(function(req,res,next){
	//res.type('text/plain');
	res.status('404');
	res.render('404');
});





