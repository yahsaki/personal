// ================================= 
//      GLOBAL FN DECLARATIONS
// =================================
_.fn.createElement = (type, attribs = [], text = null, parent = null) => {
  const element = document.createElement(type)
  if (text) element.textContent = text
  attribs.forEach(a => { element.setAttribute(a.name, a.val) })
  if (parent) parent.appendChild(element)
  return element
}
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
_.fn.render = () => {
  _.logger.log(`fn.render: render function should be remapped to the current view`)
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
// replaced by terminal
_.fn.focus = () => {}

// ================================= 
//   END GLOBAL FN DECLARATIONS
// =================================
// same as form, I dont want any module to directly call a different module so I have to put this here
_.logger = {
  log: (text, level, blob) => { console.log(`default logger: ${text}`, level, blob) },
  rehydrate: () => {},
  level: { debug: 'debug', info: 'info', warn: 'warn', error: 'error' }
}
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
  grid-template-columns: repeat(19, 1fr);
  border 1px solid black;
  column-gap: 2px;
  row-gap: 2px;
}
.base-item {
  box-sizing: border-box;
}
.base-section-content {
  border: 1px solid black;
  grid-column: 1 / 15;
  grid-row: 1 / 20;
}
.base-section-terminal {
  border: 1px solid blue;
  overflow-y:auto;
  grid-column: 15 / 20;
  grid-row: 1 / 20;
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
  // tried to add 'width:${window.innerWidth / 100 * 30}px' to fix smaller containers taking up too much space problems but it
  // didnt work
  document.querySelector('.base-section-content').setAttribute('style', `height:${window.innerHeight-20}px;`)
  document.querySelector('.base-section-terminal').setAttribute('style', `height:${window.innerHeight-20}px;`)
  //document.querySelector('.base-section-text-scroller0').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
  //document.querySelector('.base-section-text-scroller1').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
  //document.querySelector('.base-section-tester').setAttribute('style', `height:${window.innerHeight / 100 * 30}px;`)
  window.addEventListener('resize', () => {
    // TODO: fix this dupe code. also we need to be able to unbind this if home is ever unloaded
    document.querySelector('.base-section-content').setAttribute('style', `height:${window.innerHeight-20}px;`)
    document.querySelector('.base-section-terminal').setAttribute('style', `height:${window.innerHeight-20}px;`)
    //document.querySelector('.base-section-text-scroller0').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
    //document.querySelector('.base-section-text-scroller1').setAttribute('style', `height:${window.innerHeight / 100 * 20}px;`)
    //document.querySelector('.base-section-tester').setAttribute('style', `height:${window.innerHeight / 100 * 30}px;`)
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

    _.module.textScroller.load()
    // note: temporary fetch code
    /*setTimeout(() => {
      fetch('/data/latest.json')
      .then(x => x.json())
      .then(x => {
        console.log('got latest articles', x)
        _.module.textScroller.fn.createTextScroller('.base-section-text-scroller0', _.fn.shuffle(x.data))
      })
    }, 500)
    setTimeout(() => {
      fetch('/data/all.json')
      .then(x => x.json())
      .then(x => {
        console.log('got all articles', x)
        _.module.textScroller.fn.createTextScroller('.base-section-text-scroller1', _.fn.shuffle(x.data))
      })
    }, 1000)*/
  } else {
    console.log(`terminal.buildBase: textScroller tool not loaded`)
  }
  
  if (_.module.tester) {

  } else {
    console.log(`terminal.buildBase: tester tool not loaded`)
  }

  // LOAD NABNAK
  // I usually try to modularly load but ill make this static for now, so:
  // TODO: move this code to /modules/nabnak/index.js
  _.module.nabnak = {
    load: (selector) => {
      const root = document.querySelector(selector)
      if (!root) { throw Error(`nabnak.load: failed to find parent element via selector '${selector}'`) }

      const parentEl = document.createElement('div')
      parentEl.setAttribute('id', 'nabnak')
      root.append(parentEl)
      // 261008: shortcuts not implemented
      const module = { name: 'nabnak', displayName: 'nabnak', code: 'NBK', shortcuts: ['n'] }
      if (_.module.terminal) { _.module.terminal.data.module[module.name] = module }

      // we dont want this value stored to state
      _.module.nabnak.setting.parentSelector = selector

      _.fn.updateTitle('NABNAK')
      _.module.nabnak.setCss()

      const dal = new NabnakDal({ quiet: true })
      _.module.nabnak.dal = dal
      console.log('nabnak dal data', dal.data)

      const view = new NabnakRenderer({ dal, root: parentEl })
      _.module.nabnak.view = view
      console.log('view state', view.state)

      _.module.nabnak.db.get()
      view.api.render()

      // force change terminal's active module to nabnak, kinda hacky to do it like this
      _.module.terminal.fn.updateCurrentModule('nabnak')

      _.logger.log('nabnak.load: load complete')
    },
    unload: () => {
      // UNTESTED, mostly due to no alternative views yet
    },
    fn: {
      handleInput: (args) => {
        const mod = _.module.nabnak

        switch (args[0]) {
          case 'del':
          case 'delete': {
            // im not directly calling render after delete but it re-renders. not even sure how :cry:
            console.log('renderer state', mod.view.state)
            if (mod.view.state.taskId?.length) {
              // delete task
              console.log('deleting task')
              if (!mod.setting.deleteConfirmed) {
                _.logger.log(`confirm deletion of task '${mod.view.state.taskId}'`,_.logger.level.error)
                mod.setting.deleteConfirmed = true
              } else {
                mod.dal.api.task.delete({ id: mod.view.state.taskId })
                // setting 'notice' breaks delete? leaving it alone for now, dont care about jank
                //mod.view.state.notice = `deleted task '${mod.view.state.taskId}'`
                mod.view.state.taskId = null
                mod.setting.deleteConfirmed = false
              }
            } else if (mod.view.state.groupId?.length) {
              // delete group
              console.log('deleting group')
              if (!mod.setting.deleteConfirmed) {
                _.logger.log(`confirm deletion of group '${mod.view.state.groupId}'`,_.logger.level.error)
                mod.setting.deleteConfirmed = true
              } else {
                mod.dal.api.group.delete({ id: mod.view.state.groupId })
                //mod.view.state.notice = `deleted group '${mod.view.state.groupId}'`
                mod.view.state.groupId = null
                mod.setting.deleteConfirmed = false
              }
            } else if (mod.view.state.boardId?.length) {
              // delete board
              console.log('deleting board')
              if (!mod.setting.deleteConfirmed) {
                _.logger.log(`confirm deletion of board '${mod.view.state.boardId}'`,_.logger.level.error)
                mod.setting.deleteConfirmed = true
              } else {
                mod.dal.api.board.delete({ id: mod.view.state.boardId })
                //mod.view.state.notice = `deleted board '${mod.view.state.boardId}'`
                mod.view.state.boardId = null
                mod.setting.deleteConfirmed = false
              }
            } else {
              // nothing selected
              _.logger.log('nabnak: nothing selected')
            }
          } break
          default: {
            _.logger.log(`nabnak: unknown command '${args[0]}'`,_.logger.level.warn,args)
          } break
        }
      },
    },
    db: {
      save: () => {
        const mod = _.module.nabnak
        const dataString = JSON.stringify(mod.dal.data)
        const stateString = JSON.stringify(mod.view.state)
        _.storage.save(`${mod.setting.name}-data`, dataString)
        _.storage.save(`${mod.setting.name}-state`, stateString)
        _.logger.log(`nabnak.db.save: data saved`,_.logger.level.debug, {data:mod.dal.data,state:mod.view.state})
      },
      get: () => {
        const mod = _.module.nabnak
        const data = _.storage.get(`${mod.setting.name}-data`)
        if (data) {
          mod.dal.hydrate(data)
          _.logger.log(`nabnak.db.get: fetched data`, _.logger.level.debug, data)
        } else {
          _.logger.log(`nabnak.db.get: no data found`)
        }
        const state = _.storage.get(`${mod.setting.name}-state`)
        if (state) {
          mod.view.setState(state)
          _.logger.log(`nabnak.db.get: fetched state`, _.logger.level.debug, state)
        } else {
          _.logger.log(`nabnak.db.get: no state found`)
        }
      },
    },
    setting: {
      name: 'nabnak',
      // obvious bug: if triggering delete on an object and not following through, the delete will
      // immediately happened when changing selected object and re-triggering delete since we only
      // (un)set this value on delete. dont care enough to track delete per object type and dont care
      // enough to reset on scope change for now
      // this value resets on page refresh which is fine since its not saved to state.
      // TODO: clear value when user does anything other than enter delete a second time. move this
      // prop to dal(or renderer, dal is better), reset it when user does anything else besides enter
      // delete a second time
      // TODO: save deleted object to a TTL deleted objects array. we dont need any functionality to
      // restore, we can just do so manually from json(for now). we will need functionality to purge
      // on TTL though, dont want it growing indefinitely
      deleteConfirmed: false,
    },
    state: {
      // nothing here, renderer state lives in the renderer class. dal is stateless
    },
    setCss: () => {
      const style = document.createElement('style')
      style.setAttribute('data-module', 'nabnak')
      style.innerText = `
      .nabnak {
        --green: #66FF66;
        --yellow: yellow;
        --red: red;
        --cyan: #04D9FF;
        --muted: #8a9099;
        --raised: #2b2f34;
        --selected: #373c42;
        display: grid;
        grid-template-columns: minmax(160px, 1fr) 7fr;
        height: calc(100vh - 10px);
        margin: 4px;
        border: 1px solid var(--green);
      }
      .nabnak .single-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
      .nabnak .nabnak-muted { color: var(--muted); font-weight: normal; }
      .nabnak .nabnak-pre { white-space: pre-wrap; }
      .nabnak [data-action] { cursor: pointer; }
      .nabnak .selected { font-weight: bold; }
      .nabnak .selected > span:first-child { text-decoration: underline; }

      .nabnak .nabnak-board-name { color: var(--green); font-weight: bold; }
      .nabnak .nabnak-group-name { color: var(--yellow); }
      .nabnak .nabnak-task-name { color: var(--red); font-weight: bold; margin: 2px 0; }
      .nabnak .nabnak-task-id { color: #e1e4e8; }

      /* column colors(list-page summary colors from the old view) */
      .nabnak .nabnak-count.nabnak-col-todo { color: var(--red); }
      .nabnak .nabnak-count.nabnak-col-inprogress { color: var(--yellow); }
      .nabnak .nabnak-count.nabnak-col-done { color: var(--green); }
      .nabnak .nabnak-counts { display: inline-flex; gap: 3px; font-weight: bold; flex-shrink: 0; }

      /* sidebar */
      .nabnak .nabnak-side { border-right: 1px solid var(--green); overflow: auto; padding: 4px 0; }
      .nabnak .nabnak-side-boards { border-bottom: 1px solid var(--green); padding-bottom: 8px; margin-bottom: 8px; }
      .nabnak .nabnak-row { display: flex; justify-content: space-between; gap: 6px; padding: 1px 4px; }
      .nabnak .nabnak-row:hover { background: var(--selected); }
      .nabnak .nabnak-row.ancestor { font-weight: bold; }

      .nabnak .nabnak-main { overflow: auto; min-width: 0; }

      /* all boards overview */
      .nabnak .nabnak-overview { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8px; padding: 8px; }
      .nabnak .nabnak-board-card { border: 1px solid var(--green); padding: 6px; width: 260px; }
      .nabnak .nabnak-card-head { display: flex; justify-content: space-between; gap: 6px; font-size: 14px; }
      .nabnak .nabnak-overview-groups { border-top: 1px solid var(--yellow); margin-top: 6px; padding-top: 4px; }

      /* kanban */
      .nabnak .nabnak-kanban-head { padding: 6px 8px; border-bottom: 1px solid var(--green); }
      .nabnak .nabnak-crumbs { font-size: 18px; display: flex; align-items: baseline; flex-wrap: wrap; }
      .nabnak .nabnak-tools { margin-left: auto; font-size: 12px; display: flex; gap: 10px; }
      .nabnak .nabnak-link { color: var(--cyan); }
      .nabnak .nabnak-kanban-head .nabnak-desc { color: #FAFFFB; margin-top: 2px; }

      .nabnak .nabnak-grid { display: grid; }
      .nabnak .nabnak-span { grid-column: 1 / -1; }
      .nabnak .nabnak-col-head {
        position: sticky; top: 0; z-index: 1; background: #222529;
        font-size: 20px; font-weight: bold; padding: 4px 8px; border-bottom: 1px solid black;
      }
      .nabnak .nabnak-lane-head {
        display: flex; align-items: center; gap: 8px; padding: 3px 8px;
        background: var(--raised); border-top: 1px solid #000; border-left: 3px solid var(--yellow);
      }
      .nabnak .nabnak-lane-head.collapsed { opacity: .75; }
      .nabnak .nabnak-lane-head .nabnak-counts { margin-left: auto; }
      .nabnak .nabnak-lane-name { font-weight: bold; }
      .nabnak .nabnak-caret { width: 10px; color: var(--muted); }
      .nabnak .nabnak-cell { border-right: 1px solid black; padding: 2px 0 6px; min-width: 0; }
      .nabnak .nabnak-cell:last-child { border-right: 0; }

      .nabnak .nabnak-card { border: 1px solid var(--green); margin: 4px 6px; padding: 4px 6px; }
      .nabnak .nabnak-card:hover { background: var(--raised); }
      .nabnak .nabnak-card.selected-task { background: var(--selected); }
      .nabnak .nabnak-card-meta { color: var(--muted); }
      .nabnak .nabnak-card-dates { margin: 2px 0; }
      .nabnak .nabnak-overdue { color: var(--red); }
      .nabnak .nabnak-desc { color: #FAFFFB; }
      .nabnak .nabnak-tags { display: flex; flex-wrap: wrap; gap: 3px; margin: 2px 0; }
      .nabnak .nabnak-tag { border: 1px solid var(--cyan); color: var(--cyan); padding: 0 4px; }

      /* update workflow */
      .nabnak .nabnak-small { font-size: 11px; }
      .nabnak .nabnak-card-meta-row { display: flex; justify-content: space-between; gap: 6px; }
      .nabnak .nabnak-card.editing,
      .nabnak .nabnak-board-card.editing { border-color: var(--cyan); box-shadow: 0 0 0 1px var(--cyan); }
      .nabnak .nabnak-editing-tag { color: var(--cyan); }
      .nabnak .nabnak-notice { color: var(--green); margin-top: 2px; flex-basis: 100%; }
      .nabnak .nabnak-editor {
        border: 1px solid var(--cyan); background: var(--raised);
        margin: 6px 8px; padding: 6px 8px; flex-basis: 100%;
      }
      .nabnak .nabnak-editor-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-bottom: 6px; font-size: 14px; }
      .nabnak .nabnak-editor-actions { margin-left: auto; display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
      .nabnak .nabnak-editor-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 4px 16px; }
      @media (max-width: 700px) { .nabnak .nabnak-editor-grid { grid-template-columns: 1fr; } }
      .nabnak .nabnak-editor-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .nabnak .nabnak-field { display: flex; flex-direction: column; gap: 2px; border-left: 2px solid transparent; padding-left: 6px; }
      .nabnak .nabnak-field.dirty { border-left-color: var(--yellow); }
      .nabnak .nabnak-field.has-error { border-left-color: var(--red); }
      .nabnak .nabnak-field-label { color: var(--muted); }
      .nabnak .nabnak-field-error { color: var(--red); }
      .nabnak .nabnak-field-warn { color: var(--yellow); }
      .nabnak .nabnak-readonly { padding: 3px 0; }
      .nabnak .nabnak-editor input,
      .nabnak .nabnak-editor select,
      .nabnak .nabnak-editor textarea,
      .nabnak .nabnak-editor button {
        background: #222529; color: #e1e4e8; border: 1px solid #555b63;
        font: inherit; padding: 3px 5px; box-sizing: border-box; max-width: 100%;
      }
      .nabnak .nabnak-editor textarea { resize: vertical; width: 100%; }
      .nabnak .nabnak-editor input[type=date] { color-scheme: dark; }
      .nabnak .nabnak-editor :focus { outline: 1px solid var(--cyan); border-color: var(--cyan); }
      .nabnak .nabnak-editor button { cursor: pointer; }
      .nabnak .nabnak-editor .nabnak-save { border-color: var(--green); color: var(--green); }
      .nabnak .nabnak-add { color: var(--muted); margin: 2px 6px; padding: 2px 4px; opacity: .55; }
      .nabnak .nabnak-add:hover { opacity: 1; color: var(--cyan); background: var(--raised); }
      .nabnak .nabnak-overview-tools { flex-basis: 100%; display: flex; gap: 12px; align-items: baseline; }
      `
      document.head.append(style)
    }
  }
  _.module.nabnak.load('.base-section-content')
  // END NABNAK


  // defaulting the view to nabnak for now
  //if (_.module.nabnak) {
    //_.module.nabnak.load('.base-section-content')
    // I dont have a way for nabnak or terminal to change to nabnak terminal mode without direct communication so im putting
    // this here
    //_.module.terminal.fn.updateCurrentModule('nabnak')
  //}
}