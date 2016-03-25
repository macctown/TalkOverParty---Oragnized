# TalkOverParty
This is an one-time use web app. When people have plan to hangout, but have no idea about where (even what) to go. They can have real-time chat, real-time location, and intelligent recommendation (TODO) according to their location, traffic (Google Map API) and place reviews data (Yelp API).

The stack is: Node.js + Express + Socket.io + MongoDB + Mongoose + (Angular.js => add in 2.0, Redis => add in future version)

###Scenarios:
  1. Jack wants to know if there is any sports bar near him, so he can use the function [Aroud Me]
  2. Bob wants to hangout with Mike and Julian, they live in different places and have no idea if there's any good buffet between their places. First, Bob can use [Chat With Friends], then he will get a link and share it with Mike and Julian. When Mike and Julian open the link, they can see each other on the map and chat with each other in a private room. Anyone of them can use [Between Us] to find buffet which just in their area (user will see a polygon area which depends on their locations and numbers). At the same time, they can use [Between Us] to check if there's any buffet near one of their place.
  3. Chris and Anne wants to go for some Italian food after work. But they don't know where to go and they don't want to go far away from their place. So they can use [Between Us] after sharing link from [Chat With Friends]. Then they will only get Italian food in a circle area between them.

###Discussion
This project will be a long-term one, so feel free to talk with me if you have any good idea on this project. 

Email: macctown@hotmail.com

Linkedin: https://www.linkedin.com/in/weizhang131

###License
MIT
