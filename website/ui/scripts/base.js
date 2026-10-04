_.fn.clean = () => {
  const head = document.querySelector('head')
  while(head.firstChild) head.removeChild(head.firstChild)
  const body = document.querySelector('body')
  for (let i = 0; i < body.children.length; i++) {
    if (body.children[i].localName !== 'script') {
      body.children[i].remove()
    }
  }
}
_.fn.clear = (selector) => {
  const el = document.querySelector(selector)
  if (!el) {
    _.logger.log(`fn.clear: failed to find element via selector '${selector}'`,_.logger.level.error);return
  }
  el.replaceChildren()
  _.logger.log(`fn.clear: element via selector '${selector}' cleared`,_.logger.level.debug)
}
_.fn.load = (viewName) => {
  console.log(`_.fn.load: attempting to load view '${viewName}'`)
  if (!_.view[viewName]) {
    console.error(`_.fn.load: failed to find view '${viewName}'`);return
  }
}
_.fn.updateTitle = (text) => {
  if (typeof text !== 'string' || !text.length) {
    _.logger.log(`attepting to set site title to some garbage value`,_.logger.level.error,text)
    return
  }
  let title = document.querySelector('title')
  if (title) { title.innerText = `YAHSAKI | ${text}` }
  else {
    title = document.createElement('title')
    title.innerText = `YAHSAKI | ${text}`
    document.head.append(title)
  }
}
_.logger = {
  log: (text, level, blob) => { console.log(`default logger: ${text}`, level, blob) },
  rehydrate: () => {},
  level: { debug: 'debug', info: 'info', warn: 'warn', error: 'error' }
}
// same as logger above, I dont want any module to directly call a different module so I have to put this here
_.form = {
  validate: () => { throw Error('unimplemented') },
  render: () => { throw Error('unimplemented') },
  onSubmit: () => { throw Error('unimplemented') },
  onCancel: () => {throw Error('unimplemented') },
  schema: {
    inputField: { type:'text/number', required:false },
    enumField: { type:'list', required:true, options:[] }
  }
}
_.storage.get = (key) => {
  const string = localStorage.getItem(key)
  if (!string) return
  try {
    const data = JSON.parse(string) 
    return data 
  } catch (err) {
    console.log('storage.get: error parsing data to object', err)
    _.logger.log(`storage.get: error parsing data to object`, _.logger.level?.error)
    return
  }
}
_.storage.save = (key, data) => {
  let string
  try {
    string = JSON.stringify(data)
  } catch (err) {
    _.logger.log(`storage.save: data is not a valid object. data type: '${typeof data}'`, _.logger.level?.error, err)
    return
  }
  // im still leaving the stringify call to verify that its an object that can be stringified
  localStorage.setItem(key, data)
}
// placeholder, gets replaced by terminal
_.fn.focus = () => {}
_.fn.buildBase = () => {
  _.fn.clean()

  const title = document.createElement('title')
  title.innerText = 'YAHSAKI | BASE'
  document.head.append(title)

  const charset = document.createElement('meta')
  charset.setAttribute('charset', 'utf-8')
  document.head.append(charset)

  const html = document.createElement('div')
  html.setAttribute('class', 'base-container')

  html.innerHTML = `
<div class="base-item base-section-content"></div>
<div class="base-item base-section-terminal"></div>
<div class="base-item base-section-text-scroller0 text-scroller"></div>
<div class="base-item base-section-text-scroller1 text-scroller"></div>
<div class="base-item base-section-tester"></div>
  `
  document.body.append(html)

  const style = document.createElement('style')
  style.setAttribute('id', 'base-css')
  style.innerText = `
html {
  background-color: #222529;
  color: #e1e4e8;
  font-size: 12px;
}
.base-container {
  display: grid;
  grid-template-columns: repeat(19, minmax(50px, auto));
  border 1px solid black;
  column-gap: 2px;
  row-gap: 2px;
}
.base-item {
  box-sizing: border-box;
}
.base-section-content {
  border: 1px solid red;
  grid-column: 1 / 15;
  grid-row: 1 / 18;
}
.base-section-terminal {
  border: 1px solid blue;
  overflow-y:auto;
  grid-column: 15 / 20;
  grid-row: 1 / 16;
}
.text-scroller {
  height: 42px;
  border: 1px solid yellow;
}
.base-section-text-scroller0 {
  grid-column: 1 / 8;
  grid-row: 18 / 20;
}
.base-section-text-scroller1 {
  grid-column: 8 / 15;
  grid-row: 18 / 20;
}
.base-section-tester {
  border: 1px solid green;
  grid-column: 15 / 20;
  grid-row: 16 / 20;
}
.loglevel-debug {
  color: green;
}
.loglevel-warn {
  color: yellow;
}
.loglevel-error {
  color: red;
}
  `
  document.head.append(style)

  // 261002: this has no affect on the child elements
  //document.querySelector('.base-container').setAttribute('style', `height:${window.innerHeight - 20}px;`)

  /*
    as of 261003:
    content is 80% of height
    scrollers are the last 20%
    terminal is 70%
    tester is 30%
  */
  document.querySelector('.base-section-content').setAttribute('style', `height:${window.innerHeight / 100 * 80}px;`)
  //document.querySelector('.base-section-text-scroller0').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
  //document.querySelector('.base-section-text-scroller1').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
  document.querySelector('.base-section-terminal').setAttribute('style', `height:${window.innerHeight / 100 * 60}px;`)
  document.querySelector('.base-section-tester').setAttribute('style', `height:${window.innerHeight / 100 * 30}px;`)
  window.addEventListener('resize', () => {
    // TODO: fix this dupe code. also we need to be able to unbind this if home is ever unloaded
    document.querySelector('.base-section-content').setAttribute('style', `height:${window.innerHeight / 100 * 80}px;`)
    //document.querySelector('.base-section-text-scroller0').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
    //document.querySelector('.base-section-text-scroller1').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
    document.querySelector('.base-section-terminal').setAttribute('style', `height:${window.innerHeight / 100 * 60}px;`)
    document.querySelector('.base-section-tester').setAttribute('style', `height:${window.innerHeight / 100 * 30}px;`)
  })
  

  // im going to opt for manually loading the tools instead of letting them load themselves when the script is
  // initialized. lets even tell it where to install itself
  if (_.module.terminal) {
    _.module.terminal.load('.base-section-terminal')
    //setTimeout(() => { _.module.terminal.unload() }, 1000)
    if (_.module.terminal.logger && typeof _.module.terminal.logger.log === 'function') {
      // im not replacing the whole logger since the level prop only lives there
      _.logger.log = _.module.terminal.logger.log
      _.logger.rehydrate = _.module.terminal.logger.rehydrate
      _.logger.log('logger set to terminal')
    }
    if (_.module.terminal.form) {
      _.form = _.module.terminal.form
      _.logger.log('form set to terminal')
    }
  } else {
    console.log(`terminal.buildBase: terminal tool not loaded`)
  }
  if (_.module.textScroller) {
    // we need to fetch data for this to work. how about something like
    // _.module.textScroller.load({selector:'.base-secction-text-scroller0', data:data, options})
    // I think we need the option to have the tool somehow refresh with different data after so long... right?
    // IIRC I just gave it enough data to not really care about it in the past, and I had a ton of em. with only two
    // you kinda want it to refresh. I dont like the idea of that happening automagically, so how about making a 
    // command or two to make that work? lets do that. removing options param for now, backing out of encapsulated args
    // too

    // was going to whip up test data but its so easy to fetch locally that I shouldnt do it. lets get our articles
    // primed instead
    const data = [
      {
        title: '#0 Lorem ipsum dolor sit amet',
        date: '2023-05-31T07:00:00.000Z',
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      },
      {
        date: '2023-05-30T07:00:00.000Z',
        title: '#1 Lorem ipsum dolor sit amet',
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      },
      {
        date: '2023-05-29T07:00:00.000Z',
        title: '#3 Lorem ipsum dolor sit amet',
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      },
    ]
    _.module.textScroller.load()
    // this line is working, just keeping cli output silent
    //_.module.textScroller.fn.createTextScroller('.base-section-text-scroller0', data)
  } else {
    console.log(`terminal.buildBase: textScroller tool not loaded`)
  }
  
  if (_.module.tester) {

  } else {
    console.log(`terminal.buildBase: tester tool not loaded`)
  }

  // defaulting the view to nabnak for now
  if (_.module.nabnak) {
    _.module.nabnak.load('.base-section-content')
  }
}