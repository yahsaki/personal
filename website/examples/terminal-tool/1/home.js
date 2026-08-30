_.load.home = () => {
  _.current.onLoad = () => {
    console.log('make sure to run this last')
    _.module.fn.updateCurrentModule()

    for (const name in _.tool) {
      const errors = []
      if (typeof _.tool[name].onLoad !== 'function') {
        errors.push(`tool '${name}' does not implement onLoad`)
      }
      // this doesnt apply to tester since it will iitaially be GUI, not
      // interfaced with the cli
      if (typeof _.tool[name].onInput !== 'function') {
        //errors.push(`tool '${name}' does not implement onInput`)
      }
      if (errors.length) {
        console.error(errors.join(', '))
        continue
      }

      try {
        _.tool[name].onLoad()
        console.log(`tool '${name}' loaded successfully probably`)
      } catch(err) {
        console.error(`error loading tool '${name}'`, err)
      }
    }
  },
  _.current.script = () => {
    _.module = {
      terminalInputId: 'terminal-input',
      terminalOutputId: 'terminal-output',
      mode: null,
      tool: {
        CMD: {name: 'cli', displayName: 'command line', code: 'CMD'},
      },
      command: {
        help: () => { _.module.fn.command.help() },
        clear: () => { _.module.fn.command.clear() },
      },
      helpers: {
        delay: ms => new Promise((resolve => setTimeout(() => resolve(), ms))),
        prepend: (val) => {
          if (!val) {
            console.error(`attempted to prepend null val to terminal output`)
            return
          }
          const li = document.createElement('li')
          if (typeof val === 'string') {
            li.textContent = val
          }
          else if (val instanceof HTMLElement) {
            li.append(val)
          } else {
            console.error(`cant add unknown thing to terminal`)
          }
  
          document.getElementById(_.module.terminalOutputId).prepend(li)
        },
        createElement: (type, attribs = [], text = null, parent = null) => {
          const element = document.createElement(type)
          if (text) element.textContent = text
          attribs.forEach(a => { element.setAttribute(a.name, a.val) })
          if (parent) parent.appendChild(element)
          return element
        },
        trigger: (el, eventType) => {
          if (typeof eventType === 'string' && typeof el[eventType] === 'function') {
            el[eventType]()
          } else {
            const event =
              typeof eventType === 'string'
                ? new Event(eventType, {bubbles: true})
                : eventType
            el.dispatchEvent(event)
          }
        },
        shuffle: (array) => {
          let currentIndex = array.length, temporaryValue, randomIndex
          while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex)
            currentIndex -= 1

            temporaryValue = array[currentIndex]
            array[currentIndex] = array[randomIndex]
            array[randomIndex] = temporaryValue
          }
          return array
        },
      },
      fn: {
        updateCurrentModule: (code) => {
          //if (!_.module.mode) {_.module.mode = _.module.tool.CMD.code;return}
          if (!code) {
            code = 'CMD'
            _.module.mode = code
          } else {
            if (!_.module.tool[code]) throw Error(`unknown tool code '${code}'`)
          }
          
          console.log(`switching mode to '${code}'(${_.module.tool[code].displayName || _.module.tool[code].name})`)
          _.module.mode = code
          document.getElementById('terminal-input-title').innerText = _.module.mode
        },
        onInputKeyDown: (e) => {
          //console.log('hit!', e.key)
          if (_.module.mode !== 'CMD') {
            if (e.key === 'Escape') {
              const tool = _.module.tool[_.module.mode]
              if (typeof _.tool[tool.name]?.fn?.helpers?.cleanup === 'function') {
                _.tool[tool.name].fn.helpers.cleanup()
              }

              _.module.fn.updateCurrentModule('CMD')
              _.module.helpers.prepend('switched to command mode')
            }
          }
          if (e.key !== 'Enter') return
          if (!e.target?.value?.length) return
          const input = e.target.value
          
          _.module.fn.handleInput(input)
  
          e.target.value = ""
        },
        handleInput: (input) => {
          if (_.module.mode !== 'CMD') {
            if (input === 'exit') {
              const tool = _.module.tool[_.module.mode]
              if (typeof _.tool[tool.name]?.fn?.helpers?.cleanup === 'function') {
                _.tool[tool.name].fn.helpers.cleanup()
              }
              _.module.fn.updateCurrentModule('CMD')
              _.module.helpers.prepend('switched to command mode')
              return
            }
            // TODO: call!
            const tool = _.module.tool[_.module.mode]
            //console.log('dsfs', tool.name, typeof _.module.fn.response[tool.name])
            //_.tool[tool.name].onInput(input, _.module.fn.response[tool.name])
            _.tool[tool.name].onInput(input)
            return
          }
          const args = input.split(' ')
          const command = args.splice(0, 1)[0]
          if (!_.module.fn.command[command]) {
            _.module.helpers.prepend(`command '${command}' not found`)
            return
          }
          _.module.fn.command[command](args)
        },
        response: {},
        command: {
          clear: (args) => {
            document.getElementById(_.module.terminalOutputId).replaceChildren()
            console.log('terminal cleared')
          },
          help: (args) => {
            _.module.helpers.prepend(
              _.module.helpers.createElement('pre', [], `
    TODO: make this modular(somehow)
    clear: clear terminal \u4e0b\u8f7d  &#72;
    help: what you literally just entered
    kawaru: convert romanji to hiragana/katakana
    tester: do tests
    exit: switch back command(CMD) mode
              `)
            )
          },
        }
      }
    }
  
    document.getElementById('content').style.height = `${window.innerHeight / 1.1}px`
    document.getElementById(_.module.terminalInputId).addEventListener('keydown', _.module.fn.onInputKeyDown)
  }
  _.current.css = () => {
    const style = document.createElement('style')
    style.setAttribute('id', 'core')
    style.innerText = `
    html {
      background-color: #222529;
      color: #e1e4e8;
    }
    #content {
      border: 1px solid black;
      padding: 10px;
      margin: 10px;
      display: flex;
      flex-direction: row;
    }
    #s0 {
      order: 0;
      flex-grow: 4;
      border: 1px solid yellow;
    }
    #s1 {
      order: 1;
      flex-grow: 1;
      border: 1px solid green;
    }
    #terminal-input-container {
      display: flex;
    }
    #terminal-input-title {
      flex: 1 20px;
    }
    #terminal-input {
      flex: 20;
      background-color: #222529;
      color: white;
    }
    #terminal-output {
      list-style-type: none;
      overflow-y: auto;
      margin: 0;
      padding: 0;
    }
    #terminal-output li {
      padding: 1px;
      margin: 1px;
      background-color: #43474d;
    }
    `
    document.head.append(style)
  }
  _.current.html = () => {
    const title = document.createElement('title')
    title.innerText = 'home'
    document.head.append(title)

    //const encoding = document.createElement('meta')
    //encoding.setAttribute('http-equiv','Content-Type')
    //encoding.setAttribute('content','text/html; charset=utf-8')
    //document.head.append(encoding)

    const charset = document.createElement('meta')
    charset.setAttribute('charset', 'utf-8')
    document.head.append(charset)

    
    const html = document.createElement('div')
      html.setAttribute('id', 'content')
      html.innerHTML = `
      <div id="s0"></div>
      <div id="s1">
        <div id="terminal-input-container">
            <span id="terminal-input-title"></span>
            <input type="text" id="terminal-input" autofocus />
          </div>
          <div id="terminal-output-container">
            <ul id="terminal-output"></ul>
          </div>
      </div>
      `
      document.body.append(html)
  }
  _.mode = 'home'
}
