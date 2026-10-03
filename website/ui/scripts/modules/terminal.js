// terminal was not designed to ever be unloaded so I originally built it in the infra but this time around im
// going to treat it as a plugin thats never unloaded(it doesnt need to know that)
_.module.terminal = {
  // going to keep load/unload out of .fn since these are foundational logic that every tool/view shares
  load: (selector) => {
    // I really liked having the html and css split in their own functions. might go back to that, no reason not to
    const parentEl = document.querySelector(selector)
    if (!parentEl) {
      console.error(`terminal.load: failed to find the parent element via selector '${selector}'`);return
    }

    _.module.terminal.data.parentSelector = selector
    // this will cause a bug if we create terminals on the same tick
    const id = _.module.terminal.data.id = crypto.randomUUID()
    const html = document.createElement('div')
    html.setAttribute('id', `terminal-html-${id}`)
    html.setAttribute('class', 'terminal-container')
    // classnames are static here because I goofed and prepened '.' on the data prop names
    html.innerHTML = `
<div class="terminal-input-container">
  <span class="terminal-input-title"></span>
  <input type="text" class="terminal-input" autofocus />
</div>
<div class="terminal-output-container">
  <ul class="terminal-output"></ul>
</div>
    `
    parentEl.append(html)

    const style = document.createElement('style')
    style.setAttribute('id', `terminal-style-${id}`)
    style.innerText = `
.terminal-input-container {
  display: flex;
}
.terminal-input-title {
  flex: 1 20px;
}
.terminal-input {
  flex: 20;
  background-color: #222529;
  color: white;
}
.terminal-output {
  list-style-type: none;
  overflow-y: auto;
  margin: 0;
  padding: 0;
}
.terminal-output li {
  padding: 1px;
  margin: 1px;
  background-color: #43474d;
}
    `
    document.head.append(style)

    const inputEl = document.querySelector(_.module.terminal.data.inputSelector)
    if (!inputEl) {
      throw Error(`failed to find terminal input element by selector '${_.module.terminal.data.inputSelector}'`)
    }
    inputEl.addEventListener('keydown', _.module.terminal.fn.onInputKeyDown)
    window.addEventListener('resize', () => {
      //document.querySelector(_.module.terminal.data.containerSelector).setAttribute('style', `height:${window.innerHeight - 20}px;`)
    })
    _.module.terminal.fn.updateCurrentModule()
    console.log('terminal.load: load complete')
  },
  unload: () => {
    const selector = _.module.terminal.data.parentSelector
    const id = _.module.terminal.data.id
    const parentEl = document.querySelector(selector)
    if (!parentEl) {
      console.error(`terminal.unload: failed to find the parent element via selector '${selector}'`)
      // probably refresh browser or something

      // we arent even fetching the children of this parent, no need to escape logic
      //return
    }

    const inputEl = document.querySelector(_.module.terminal.data.inputSelector)
    // honestly i need to test that removing like this works
    if (inputEl) { inputEl.removeEventListener('keydown', _.module.terminal.fn.onInputKeyDown) }

    // terminal doesnt have any intervals floating around, but other than that, all the logic for a tool is isolated
    // to itself, or at least it should be
    const html = document.getElementById(`terminal-html-${id}`)
    const style = document.getElementById(`terminal-style-${id}`)
    if (html) { html.remove() }
    if (style) { style.remove() }
    _.module.terminal.data.parentSelector = null
    _.module.terminal.data.id = null
    // is that it?
    console.log(`terminal.unload: removed everything probably, good luck verifying that`)
  },
  // hopefully everything here is only what terminal needs to function besides global helpers
  fn: {
    // pondering placing this in root of tool
    command: {
      clear: (args) => {
        const outputEl = document.querySelector(_.module.terminal.data.outputSelector)
        if (!outputEl) {
          throw Error(`failed to find terminal output element by selector '${_.module.terminal.data.outputSelector}'`)
        }
        outputEl.replaceChildren()
        console.log('terminal.fn.command.clear: terminal cleared')
      },
      help: (args) => {
        _.module.terminal.fn.prepend(
          _.fn.createElement('pre', [], `
    TODO: make this modular(somehow)(CCOMLETE)
    clear: clear terminal \u4e0b\u8f7d  &#72;
    help: what you literally just entered
    kawaru: convert romanji to hiragana/katakana
    tester: testing
    exit: switch back command(CMD) mode
          `)
        )
      }
    },
    prepend: (val) => {
      if (!val) { console.error(`attempted to prepend null(or false) val to terminal output`);return }
      const outputEl = document.querySelector(_.module.terminal.data.outputSelector)
      if (!outputEl) { throw Error(`terminal output element missing for selector '${_.module.terminal.data.outputSelector}'`) }

      const li = document.createElement('li')
      if (typeof val === 'string') { li.textContent = val }
      else if (val instanceof HTMLElement) { li.append(val) }
      else { console.error(`cant add unknown thing to terminal`) }
      outputEl.prepend(li)
    },
    updateCurrentModule: (code) => {
      const module = _.module.terminal.data.module
      if (!code) {
        code = module.CMD.code
        _.module.terminal.data.currentMode = code
      }
      if (!_.module[module[code].name]) { throw Error(`unknown tool code '${code}'`) }
      const titleEl = document.querySelector(_.module.terminal.data.titleSelector)
      if (!titleEl) { throw Error(`terminal title element missing for selector '${_.module.terminal.data.titleSelector}'`) }

      console.log(`switching mode to '${code}'(${module[code].displayName || module[code].name})`)
      _.module.terminal.data.currentMode = code
      titleEl.innerText = code
    },
    onInputKeyDown: (e) => {
      console.log('hit', e.key)
      const module = _.module.terminal.data.module
      const currentMode = _.module.terminal.data.currentMode
      if (currentMode !== module.CMD.code) {
        if (e.key === 'Escape') {
          if (typeof _.module[module[code].name]?.fn?.cleanup === 'function') {
            _.module[module[code].name]?.fn?.cleanup()
          }
          // magiriwashi no namae desu ne, 'module.CMD.code'
          _.module.terminal.fn.updateCurrentModule(module.CMD.code)
          _.module.terminal.fn.prepend('switched to command mode')
        }
      }
      if (e.key !== 'Enter') return
      if (!e.target?.value?.length) return

      const input = e.target.value
      _.module.terminal.fn.handleInput(input)
      e.target.value = ""
    },
    handleInput: (input) => {
      console.log('terminal.fn.handleInput: input', input)
      const currentMode = _.module.terminal.data.currentMode
      const module = _.module.terminal.data.module
      if (currentMode !== module.CMD.code) {
        console.log('terminal.fn.handleInput: TODO: support piping input to other tools')
        return
      }

      const args = input.split(' ')
      const command = args.splice(0, 1)[0]
      if (!_.module.terminal.fn.command[command]) {
        _.module.terminal.fn.prepend(`command '${command}' not found`);return
      }
      _.module.terminal.fn.command[command](args)
    }
  },
  data: {
    id: null, // generated when .load is called
    outputSelector: '.terminal-output',
    inputSelector: '.terminal-input',
    titleSelector: '.terminal-input-title',
    containerSelector: '.terminal-container',
    parentSelector: null, // set from caller when .load is called
    currentMode: null,
    // not in love with this naming convention
    module: {
      // every tool that loads needs to put their code here if applicable(text scroller not applicable yet)
      CMD: {name: 'terminal', displayName: 'command line', code: 'CMD'}
    },
  },
}