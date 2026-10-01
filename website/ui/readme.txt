going to change enough to resort to a new version. I really didnt want to do this refactor right before nabnak is finally going live-ish but
it needs to be done unfortunately
- home.js contains global functions that need to be migrated out of itself
- home.js will be moved to a /views folder, along with nabnak.js
- not sure what to do with /tools yet since theyre only applicable to home.js
- pondering creating tools specifically for nabnak, meaning the home view and nabnak view will have tools only applicable to them
- need to create a root view that will house the cli. the cli needs to persist on all views/interfaces(pondered not but thats unacceptable, this tool is cli first)
- really need to fix textslider this time around
- will keep the views static, or more so, im not going to implement dynamic changing of grid item locations in home.js. ill just create another view
- need to implement the ability to change views now. that was always the case but the logic does not exist yet
- scrapping all that work I did in nabnak/server which will be replaced with:
  - GET:/
  - POST:/
  thats it, dont even need path parts. since we save the entire json every time. the right way to do this is validation of the entire 
  object before each save and generation of change logs every time, which I aint doing immediately
- personal website is going to need some kind of server for nabnak to work(the above point). will need some obscurity security jazz around it
- once projects are loaded, nabnak will CRUD directly against the data in memory instead of posting every change to the server. some interval will be
  responsible for posting the latest data to the server

questions:
- can we put nabnak server in a single file? the heaviest part is validating the post body. ah well auth
  too... but thats a later thing. I think we can make this a single file