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

    _.fn.focus = _.module.terminal.fn.focus
    _.logger.log('terminal.load: load complete. terminal hijacked global focus fn btw')
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
        _.fn.clear(_.module.terminal.data.outputSelector)
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
      },
      save: (args) => {
        _.logger.log('save test',_.logger.level.debug)
        _.storage.save('save-test', {date: new Date().toISOString()})
      },
      get: (args) => {
        _.logger.log('get saved data test',_.logger.level.debug)
        const data = _.storage.get('save-test')
        _.logger.log('got data',_.logger.level.debug,data)
      }
    },
    focus: () => {
      const inputEl = document.querySelector(_.module.terminal.data.inputSelector)
      if (!inputEl) { throw Error(`terminal input element missing for selector '${_.module.terminal.data.inputSelector}'`) }

      inputEl.focus()
    },
    // I would like to combine these but im not going to do that yet
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
    // in testing, only used by logger rehydrate at the moment(going for real fast solution)
    append: (val) => {
      if (!val) { console.error(`attempted to prepend null(or false) val to terminal output`);return }
      const outputEl = document.querySelector(_.module.terminal.data.outputSelector)
      if (!outputEl) { throw Error(`terminal output element missing for selector '${_.module.terminal.data.outputSelector}'`) }

      const li = document.createElement('li')
      if (typeof val === 'string') { li.textContent = val }
      else if (val instanceof HTMLElement) { li.append(val) }
      else { console.error(`cant add unknown thing to terminal`) }
      outputEl.append(li)
    },
    updateCurrentModule: (name) => {
      const module = _.module.terminal.data.module
      if (!name) {
        name = module.terminal.name
        _.module.terminal.data.currentMode = name
      }
      if (!_.module[name]) { throw Error(`unknown module name '${name}'`) }
      const titleEl = document.querySelector(_.module.terminal.data.titleSelector)
      if (!titleEl) { throw Error(`terminal title element missing for selector '${_.module.terminal.data.titleSelector}'`) }

      _.logger.log(`switching mode to '${module[name].displayName || name}'`)
      _.module.terminal.data.currentMode = name
      titleEl.innerText = module[name].code
    },
    onInputKeyDown: (e) => {
      //console.log('hit', e.key)
      const module = _.module.terminal.data.module
      const currentMode = _.module.terminal.data.currentMode
      if (currentMode !== module.terminal.name) {
        if (e.key === 'Escape') {
          if (typeof _.module[currentMode]?.fn?.cleanup === 'function') {
            _.module[currentMode]?.fn?.cleanup()
          }
          // magiriwashi no namae desu ne, 'module.terminal.name'
          _.module.terminal.fn.updateCurrentModule(module.terminal.name)
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
      
      if (currentMode !== module.terminal.name) {
        // we dont need command split out in this situation. need that command parsing
        let args = input.split(' ')
        // not validating module existence atm but I am writing a comment about not doing so for some reason
        _.module[currentMode].fn.handleInput(args);return
      }
      
      // remember this doesnt support quoted arguments with spaces in it, need fixing
      const args = input.split(' ')
      const command = args.splice(0, 1)[0]
      // if the command starts with a module name, let that module handle it
      if (_.module[command]) {
        if (!args.length) {
          // switch the current module
          _.module.terminal.fn.updateCurrentModule(command);return
        } else {
          // dont switch the module just send that module the command
          _.module[command].fn.handleInput(args);return
        }
      }
      // fallback to terminal's built in commands
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
      terminal: {name: 'terminal', displayName: 'command line', code: 'CMD'}
    },
    // logs need to be private so im leaving them out of the .logger obj. doesnt stop anyone from mucking with them
    logs: [],
    // TODO: save command history. why TF didnt I do this originally
    commandHistory: [],
  },
  // all logs should pipe here
  logger: {
    log: (text, level, blob) => {
      // I would like to automagically get the fn name and module name
      if (typeof text !== 'string') {
        console.error(`terminal.logger.log: log is not of type string`);return
      }
      if (!text.length) {
        console.error(`terminal.logger.log: log text is empty`);return
      }
      if (!_.logger.level[level]) {
        if (level) {
          // user sent a level value thats not one of the enum values. they probably sent a blob here
          console.log(`caller sent a non enum value in the level argument. the log was probably constructed incorrectly`, level)
        }
        level = _.logger.level.info

        // I dont see the point of this code, removing for now
        //_.module.terminal.data.logs.push({ date: new Date().toISOString(), text })
        // treat the log as 'info'
        //if (blob) { console.log(text, blob) }
        //else { console.log(text) }
        //_.module.terminal.fn.prepend(text)
        //return
      }

      // TODO: change the color depending on the level
      _.module.terminal.data.logs.push({ date: new Date().toISOString(), text, level })
      const string = `[${level}]:${text}`
      if (blob) { console.log(string, blob) }
      else { console.log(string) }
      // lets disable debug logs going to terminal module for now
      if (level === _.logger.level.debug) {
        return
      }
      const spanEl = document.createElement('span')
      spanEl.setAttribute('class', `loglevel-${level}`)
      spanEl.innerText = text
      _.module.terminal.fn.prepend(spanEl)
    },
    // redisplay logs in terminal. great when terminal was hijacked then returned
    rehydrate: () => {
      // lets only render the last 100 logs
      let count = 0
      for (let i = _.module.terminal.data.logs.length - 1; i >= 0; i--) {
        if (count === 100) { break }
        const log = _.module.terminal.data.logs[i]
        if (log.level !== _.logger.level.debug) {
          const spanEl = document.createElement('span')
          spanEl.setAttribute('class', `loglevel-${log.level}`)
          spanEl.innerText = log.text
          _.module.terminal.fn.append(spanEl)
          count += 1
        }
      }
    }
  },
  // yeah lets stuff the form logic in the root of terminal
  // I just realized form/logger can stand on their own if we just give them a parent selector. it gets weird when they
  // both operate in the same element though(logs coming in while form displayed, unhandled). the idea is to show the logs
  // below the form, but I think we should just ignore terminal logs once the form workflow is completed. we still add
  // the logs to an array(which needs to be truncated, adding that task)
  form: {
    checkForTagDupes: (tags = []) => {
      const duplicates = []
      const checkedTags = []
      for (let i = 0; i < tags.length; i++) {
        const duplicate = checkedTags.find(x => x.toLowerCase() === tags[i].toLowerCase())
        if (duplicate) { duplicates.push(duplicate)}
        checkedTags.push(tags[i])
      }
      return duplicates
    },
    validate: () => {
      const errors = []
      for (let prop in _.form.current.fields) {
        const field = _.form.current.fields[prop]
        if (field.type === 'text' || field.type === 'tags') {
          if (field.required && !field.value?.length) {
            errors.push(`field '${prop}' required`)
          }
        }

        if (field.type === 'tags' && field.value?.length) {
          //const tags = []
          //const untrimmedTags = field.value.toLowerCase().split(',')
          //for (let i in untrimmedTags) { tags.push(untrimmedTags[i].trim()) }
          const tags = field.value.split(',')
          const dupes = _.form.checkForTagDupes(tags)
          if (dupes.length) {
            errors.push(`field '${prop}' has duplicate tags '${dupes.join(', ')}'`)
          }
          if (tags.find(x => !x.length) === '') {
            errors.push(`tags must not be empty`)
          }
        }
      }

      return errors
    },
    render: () => {
      // called when the html is built, I guess
      
      // going to attempt to do this without event listeners
      const formEl = document.createElement('div')
      formEl.setAttribute('class', 'terminal-form-container')
      _.fn.createElement('p',[{name:'onclick',val:'_.form.onCancel()'}],`form: ${_.form.current.title}`,formEl)
      _.fn.createElement('button',[{name:'onclick',val:'_.form.onCancel()'}],'cancel',formEl)
      _.fn.createElement('button',[{name:'onclick',val:'_.form.onSubmit()'}],'submit',formEl)
      _.fn.createElement('br',[],null,formEl)
      for (let prop in _.form.current.fields) {
        const field = _.form.current.fields[prop]
        // I set field value='' instead of value ?? '' because this field prop is being referenced elsewhere
        if ((field.type === 'text' || field.type === 'tags' || field.type === 'textarea') && !field.value) {
          field.value = ''
        }
        _.fn.createElement('span',[],`${prop}: `,formEl)
        // I want some way to auto update the _.current form on change. lets do that
        if (field.type === 'text' || field.type === 'tags') {
          const input = _.fn.createElement('input',[
            {name:'type',val:'text'},
            //{name:'data-name',val:prop}, // being used to map html element to js object. // 261004: no its not
            {name:'class',val:`form-${prop}`}, // worthless at teh moment // 261004: no its not
            {name:'value',val:field.value},
            {name:'oninput',val:`_.form.onFieldChange('${prop}')`}// works!
          ],null,formEl)
          //input.addEventListener('input', _.form.onFieldChange)
        }
        // we 'can' merge this with type:text but I aint
        if (field.type === 'textarea') {
          _.fn.createElement('input',[
            {name:'type',val:'textarea'},
            {name:'rows',val:'5'},{name:'cols',val:'20'},
            {name:'class',val:`form-${prop}`},
            {name:'value',val:field.value},
            {name:'oninput',val:`_.form.onFieldChange('${prop}')`}// works!
          ],null,formEl)
        }
        if (field.type === 'select') {
          //if (field.required) { field.value = field.options[0] }
          field.value = field.options[0] // screw it, always set a default
          const select = _.fn.createElement('select',[
            {name:'class',val:`form-${prop}`},
            // element.value should work
            // element.options[element.selectedIndex].value is a thing too
            {name:'value',val:field.value},
            // from documentation, change and input event do the exact same thing
            {name:'oninput',val:`_.form.onFieldChange('${prop}')`}
          ],null,formEl)
          for (let i in field.options) { _.fn.createElement('option',[],field.options[i],select) }
        }
        _.fn.createElement('br',[],null,formEl)
      }
      _.fn.createElement('br',[],null,formEl)
      _.fn.createElement('button',[{name:'onclick',val:'_.form.onCancel()'}],'cancel',formEl)
      _.fn.createElement('button',[{name:'onclick',val:'_.form.onSubmit()'}],'submit',formEl)
      // so far this is the only line I need to replace to make this its own thing(plus add more logic of course)
      _.module.terminal.fn.prepend(formEl)
    },
    load: (args) => {
      // I dont know how to validate form schemas yet so I aint

      // rush job, could definitely lose something this way
      _.form.current = {
        title: args.title,
        // I only have a .fields prop in form so far, please note this truncation if this changes
        fields: args.form.fields,
        callback: args.callback,
        callbackName: args.callbackName,
      }
      _.form.render()
    },
    onFieldChange: (propertyName) => {
      _.logger.log(`field changed`,_.logger.level.debug, propertyName)
      const field = _.form.current.fields[propertyName]
      const el = document.querySelector(`.form-${propertyName}`)
      if (field.type === 'tags') {
        field.value = el.value.replaceAll(' ','')
      } else {
        field.value = el.value
      }
    },
    onSubmit: () => {
      _.logger.log(`form.onSubmit: called`,_.logger.level.debug)
      console.log(JSON.stringify(_.form.current.fields))
      console.log(_.module.terminal.data.logs)

      const errors = _.form.validate()
      if (errors.length) {
        // log errors
        _.logger.log(errors.join(', '),_.logger.level.error)
        // clear terminal
        _.fn.clear(_.module.terminal.data.outputSelector)
        // rehydrate logs
        _.logger.rehydrate()
        // rerender form
        _.form.render()
      } else {
        // clear terminal
        _.fn.clear(_.module.terminal.data.outputSelector)
        // rehydrate logs
        _.logger.rehydrate()
        // submit results to caller
        _.form.current.callback(_.form.current.fields)
        // this should be green but whatever
        _.logger.log(`form successfully submitted ＼（＾０＾）ノ,`)
        // purge current
        _.form.current = null
        
        // this line needs to be placed somewhere where it gets called regularly, like after most actions
        _.module.terminal.fn.focus()
      }
    },
    onCancel: () => {
      _.logger.log(`form.onCancel: called`,_.logger.level.debug)
    },
    schema: {
      inputField: { type:'text/number', required:false },
      enumField: { type:'list', required:true, options:[] }
    },
    current: null,
  },
}