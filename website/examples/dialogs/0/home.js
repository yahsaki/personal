_.load.home = () => {
  _.current.script = () => {
    _.module = {
      terminalInputId: 'terminal-input',
      terminalOutputId: 'terminal-output',
      mode: null,
      tool: {
        CMD: {name: 'command line', code: 'CMD'},
        KWR: {name: 'kawaru', code: 'KWR'},
      },
      command: {
        help: () => { _.module.fn.command.help() },
        clear: () => { _.module.fn.command.clear() },
        //kawaru: command_kawaru,
        //exit: command_exit,
        //help: command_help,
      },
      helpers: {
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
      },
      fn: {
        onInputKeyDown: (e) => {
          console.log('hit!', e.key)
          if (e.key !== 'Enter') return
          if (!e.target?.value?.length) return
          const input = e.target.value
          
          _.module.fn.handleInput(input)
  
          e.target.value = ""
        },
        handleInput: (input) => {
          const args = input.split(' ')
          const command = args.splice(0, 1)[0]
          if (!_.module.fn.command[command]) {
            _.module.helpers.prepend(`command '${command}' not found`)
            return
          }
          _.module.fn.command[command](args)
        },
        command: {
          clear: (args) => {
            document.getElementById(_.module.terminalOutputId).replaceChildren()
            console.log('terminal cleared')
          },
          help: (args) => {
            _.module.helpers.prepend(
              _.module.helpers.createElement('pre', [], `
    clear: clear terminal
    help: what you literally just entered
    kawaru: convert romanji to hiragana/katakana
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
    const title = document.createElement('title')
    title.innerText = 'home'
    document.head.append(title)

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
      display: grid;
    }
    #s0 {
      grid-column: 1;
      border: 1px solid yellow;
    }
    #s1 {
      grid-column: 2;
      border: 1px solid green;
    }
    #s2 {
      grid-column: 3;
      border: 1px solid purple;
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
      <div id="s2"></div>
      `
      document.body.append(html)
  }
  _.mode = 'home'
}