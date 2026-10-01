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

    // burn in current view's width for all top level containers. would need something sexy flexible
    // to make this unstatic but solves my width woes for now
    /*setTimeout(() => {
      const parent = document.querySelector('.container')
      const widths = []
      // get widths first
      for (let i = 0; i < parent.children.length; i++) {
        widths.push({
          el: parent.children[i],
          width: parent.children[i].clientWidth,
        })
      }
      // now burn them
      for (const i in widths) {
        widths[i].el.setAttribute('style', `width:${widths[i].width}px`)
      }
      console.log(`the widths for ${widths.length} top level elements under the '.container' element has been statically burned in. if widths need to be fiddled with you must change this logic`)
    }, 100)*/
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
    TODO: make this modular(somehow)(CCOMLETE)
    clear: clear terminal \u4e0b\u8f7d  &#72;
    help: what you literally just entered
    kawaru: convert romanji to hiragana/katakana
    tester: testing
    exit: switch back command(CMD) mode
              `)
            )
          },
        }
      }
    }
  
    //document.getElementById('content').style.height = `${window.innerHeight / 1.1}px`
    document.getElementById(_.module.terminalInputId).addEventListener('keydown', _.module.fn.onInputKeyDown)

    // this assumes .html was already executed
    document.querySelector('.container').setAttribute('style', `height:${window.innerHeight - 20}px;`)
    window.addEventListener('resize', () => {
      // TODO: fix this dupe code. also we need to be able to unbind this if home is ever unloaded
      document.querySelector('.container').setAttribute('style', `height:${window.innerHeight - 20}px;`)
    })
  }
  _.current.css = () => {
    const style = document.createElement('style')
    style.setAttribute('id', 'core')
    style.innerText = `
    html {
      background-color: #222529;
      color: #e1e4e8;
      font-size: 12px;
    }
    .container {
      display: grid;
      grid-template-columns: repeat(19, minmax(50px, auto));
      grid-auto-rows: 10px;
      border: 1px solid black;
      column-gap: 2px;
      row-gap: 2px;
    }
    .item {
      box-sizing: border-box;
    }
    .section-imageslider0 {
      grid-column: 1 / 5;
      grid-row: 1 / 10;
      border: 1px solid orange;
    }
    .section-imageslider1 {
      grid-column: 5 / 9;
      grid-row: 1 / 6;
      border: 1px solid orange;
    }
    .section-imageslider2 {
      grid-column: 9 / 13;
      grid-row: 1 / 6;
      border: 1px solid orange;
    }
    .section-imageslider3 {
      grid-column: 13 / 17;
      grid-row: 1 / 6;
      border: 1px solid orange;
    }
    .section-imageslider4 {
      grid-column: 17 / 20;
      grid-row: 1 / 6;
      border: 1px solid orange;
    }
    .section-textslider0 {
      grid-column: 1 / 17;
      grid-row: 6 / 8;
      border: 1px solid yellow;
    }
    .section-textslider1 {
      grid-column: 9 / 10;
      grid-row: 8 / 14;
      border: 1px solid yellow;
    }
    .section-textslider2 {
      grid-column: 11 / 17;
      grid-row: 8 / 11;
      border: 1px solid yellow;
    }
    .section-textslider3 {
      grid-column: 11 / 17;
      grid-row: 11 / 14;
      border: 1px solid yellow;
    }
    .section-tester {
      grid-column: 14 / 17;
      grid-row: 40 / 60;
      border: 1px solid green;
    }
    .section-terminal {
      grid-column: 17 / 20;
      grid-row: 40 / 60;
      border: 1px solid blue;

      overflow-y:auto;
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

    // 2024-02-20: why tf did I remove this
    // doesnt seem to help in webkit browsers. site probably needs to load with
    // it initially, aint happening
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
      <div class="container">
        <div class="item section-imageslider0">is0</div>
        <div class="item section-imageslider1"></div>
        <div class="item section-imageslider2"></div>
        <div class="item section-imageslider3"></div>
        <div class="item section-imageslider4"></div>
        <div class="item section-tester"></div>
        <div class="item section-terminal">
          <div id="terminal-input-container">
            <span id="terminal-input-title"></span>
            <input type="text" id="terminal-input" autofocus />
          </div>
          <div id="terminal-output-container">
            <ul id="terminal-output"></ul>
          </div>
        </div>
      </div>
      `
      document.body.append(html)
  }
  _.mode = 'home'
}
