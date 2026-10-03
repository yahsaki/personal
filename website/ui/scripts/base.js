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
_.fn.load = (viewName) => {
  console.log(`_.fn.load: attempting to load view '${viewName}'`)
  if (!_.view[viewName]) {
    console.error(`_.fn.load: failed to find view '${viewName}'`);return
  }
}

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
  grid-auto-rows: 10px;
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
  `
  document.head.append(style)

  // 261002: this has no affect on the child elements
  /*document.querySelector('.base-container').setAttribute('style', `height:${window.innerHeight - 20}px;`)
  window.addEventListener('resize', () => {
    // TODO: fix this dupe code. also we need to be able to unbind this if home is ever unloaded
    document.querySelector('.base-container').setAttribute('style', `height:${window.innerHeight - 20}px;`)
  })
  */

  // im going to opt for manually loading the tools instead of letting them load themselves when the script is
  // initialized. lets even tell it where to install itself
  if (_.module.terminal) {
    _.module.terminal.load('.base-section-terminal')
    //setTimeout(() => { _.module.terminal.unload() }, 1000)
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