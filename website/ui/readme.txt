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

todo:
- add a status bar to the top(or wherever) of the site that shows statuses of things. I forget the first status that
  we would want some indication of so just aggregate all ideas here
- create fn to download storage data as json
- save command history
- create a form workflow like:
  - set up form in module(IE create project form in nabnak, two fields)
  - send form schema to terminal to render it. terminal keeps data saved and whatnot
  - once form passes requirements set by the original schema, completed form gets sent back to module
  this is a replacement for cli workflows, IE, user enters 'create project' command, terminal prompts user for
  name, whiles it until satisfactory response, continues to next field description until completed. decided
  to move forward with form due to speed of implementation
- add 'killall' command that literally deletes everything, would be funny
- add settings that save to browserdb
  - show debug output
- music player!(place in top status bar)
- BUG: the old implementation of terminal's argument splitting did not support quoted arguments: must fix
- pull CVEs manually from git repo and manually generate some consumable data from it. automate this someday
- integrate tester
- integrate nabnak view... up to whatever we have built... to a certain degree(what the F does this mean)


completed:
- 261001: fix title display. currently hiding it because I goofed it with absolute positioning in a setup like this. dont
  want to gut it completely at this point
- 261002: need to implement a way for other tools to output logs to terminal. a smidge harder now that its not baked into the
  view as before
- 261002: finish integrating terminal... to an acceptable degree
- 261003: change color of logs in terminal depending on level
- 261003: if I didnt mention before, logger implemented. looking good
- 261003: storage implemented in core of project
- 261002: add a logger to terminal. I was going to split that out but it doesnt make much sense at all since its 
  completely worthless without terminal.
- 261002: renamed _.tool and _.view as _.module
- 261002: need recent data for the new text scroller. get dailies up and running
- BUG: text scrollers dont handle resizing after interval creation, easy fix
  - 261002: it changes speed on every loop which is good enough
- text scroller module implemented
- build replacement for text slider
- set up layout
- design how base, views and tools interact with each other

notes:
- 261002: going to start setting 'this' refs in tools/views at the start of functions. makes code cleaner and easier to
  update for bigger modules like nabnak and tester
how commands should work:
  before this, you would type 'kawaru' to change cli into kawaru mode, tester to do '???' and thats about it. views
  didnt exist