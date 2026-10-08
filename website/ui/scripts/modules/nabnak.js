_.module.nabnak = {
  load: (selector) => {
    const parentEl = document.querySelector(selector)
    if (!parentEl) { throw Error(`nabnak.load: failed to find parent element via selector '${selector}'`) }

    // 261008: shortcuts not implemented
    const module = { name: 'nabnak', displayName: 'nabnak', code: 'NBK', shortcuts: ['n'] }
    if (_.module.terminal) { _.module.terminal.data.module[module.name] = module }

    _.module.nabnak.setting.parentSelector = selector

    _.fn.updateTitle('NABNAK')

    // fn.render needs to be remapped to whatever the current view is
    _.fn.render = _.module.nabnak.fn.render
    // fetch storage data
    // set css(should css be global? I dont see a reason not atm)
    // render
    _.fn.render()

    _.logger.log('nabnak.load: load complete')
  },
  fn: {
    doAction: (fn) => {
      fn()
      // way to keep focus on the terminal input after every action
      _.fn.focus()
    },
    render: () => {
      _.logger.log('nabnak.fn.render: called',_.logger.debug)
      // wrap every render in a doAction
    },
    handleInput: (args) => {
      const mod = _.module.nabnak
      // this is going to be pure slop for the first few iterations
      /*
        I could do something like this:
        fn = mod.command[args[0]]?[args[1]]
        if (typeof fn === 'function') fn(otherargs)
      */
      if (typeof mod.command[args[0]] === 'function') {
        mod.command[args[0]](args)
        return
      }
      // unreadable garbage dump
      switch (args[0]) {
        case 'create': {
          if (!args[1]) { _.logger.log(`missing next argument`,_.logger.level.warn);return }
          switch (args[1]) {
            case 'project': {
              mod.fn.doAction(mod.fn.create.project)
            } break
            case 'group': {
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            case 'task': {
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            default: {
              _.logger.log(`invalid argument '${args[1]}'`,_.logger.level.warn)
            } break
          }
        } break
        case 'select': {
          if (!args[1]) { _.logger.log(`missing next argument`,_.logger.level.warn);return }
          switch (args[1]) {
            case 'project': {
              if (!args[2]) { _.logger.log(`missing index argument`,_.logger.level.warn);return }
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            case 'group': {
              if (!args[2]) { _.logger.log(`missing index argument`,_.logger.level.warn);return }
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            case 'task': {
              if (!args[2]) { _.logger.log(`missing index argument`,_.logger.level.warn);return }
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            default: {
              _.logger.log(`invalid argument '${args[1]}'`,_.logger.level.warn)
            } break
          }
        } break
        case 'update': {
          if (!args[1]) { _.logger.log(`missing next argument`,_.logger.level.warn);return }
          switch (args[1]) {
            case 'project': {
              if (!args[2]) { _.logger.log(`missing index argument`,_.logger.level.warn);return }
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            case 'group': {
              if (!args[2]) { _.logger.log(`missing index argument`,_.logger.level.warn);return }
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            case 'task': {
              if (!args[2]) { _.logger.log(`missing index argument`,_.logger.level.warn);return }
              _.logger.log('unimplemented',_.logger.level.error,args)
            } break
            default: {
              _.logger.log(`invalid select argument '${args[1]}'`,_.logger.level.warn)
            } break
          }
        } break
        default: {
          _.logger.log(`unknown command '${args[0]}'`,_.logger.level.warn,args)
        } break
      }
    },
    // I feel like this pathing is still not right, or optimal
    create: {
      project: () => {
        const mod = _.module.nabnak
        _.form.load({ title: 'Create Project', form: mod.form.project })
      },
    }
  },
  command: {
    
  },
  db: {
    save: () => {
      const mod = _.module.nabnak
      const string = JSON.stringify(mod.data)
      _.storage.save(mod.setting.storageKey, string)
      _.logger.log('nabnak.db.save: data saved')
    },
    get: () => {
      const data = _.storage.get(mod.setting.storageKey)
      if (data) {
        _.module.nabnak.data = data
        _.logger.log(`nabnak.db.get: fetched data`, _.logger.level.debug, data)
      } else {
        _.logger.log(`nabnak.db.get: no data found`)
      }
    },
  },
  // eh, doesnt feel like it should live in state or data so here we go...
  setting: {
    name: 'nabnak', // feels dumb setting it like this. I mean the module is already named this
    storageKey: 'nabnak-data', // if we name these the same as another module... poof
  },
  // attempting to keep these as strings so it can be saved/restored
  state: {},
  // would like this entire object to be saved to localstorage, not just data.projects like before
  data: {},
  schema: {
    // the idea was not to use enums but to use tags, like 'status-todo' and 'priority-low'. leaving these two for now
    // and will build the cool dynamic tag grouping display logic later
    enum: {
      status: {
        todo: 'todo',
        inprogress: 'inprogress',
        done: 'done'
      },
      priority: {
        low: 'low',
        medium: 'medium',
        high: 'high',
      }
    },
    project: {
      id: null,
      date_created: null,
      date_updated: null,
      name: null,
      description: null,
      groups: [],
      // 261008: decided to remove tasks from project, tasks will always live in a group now
      //tasks: [],
      tags: [],
      comments: [],
    },
    group: {
      id: null,
      date_created: null,
      date_updated: null,
      name: null,
      description: null,
      tasks: [],
      tags: [],
      comments: [],
    },
    task: {
      id: null,
      date_created: null,
      date_updated: null,
      // /UPDATE-able fields
      name: null,
      description: null,
      acceptanceCriteria: null,
      status: null,
      tags: [],
      // end 
      date_started: null,
      date_completed: null,
      date_due: null,
      comments: [],
    },
  },
  form: {
    project: {
      setup: (fields) => {},
      onSubmit: (args) => { _.logger.log(`form submitted`,_.logger.level.debug,args) },
      onCancel: (args) => { _.logger.log(`form cancelled`,_.logger.level.debug,args) },
      fields: {
        id: { type: 'hidden' },
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
      },
    },
    group: {
      setup: (fields) => {},
      onSubmit: (args) => { _.logger.log(`form submitted`,_.logger.level.debug,args) },
      onCancel: (args) => { _.logger.log(`form cancelled`,_.logger.level.debug,args) },
      fields: {
        id: { type: 'hidden' },
        projectId: { type: 'hidden' },  
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
      }
    },
    task: {
      setup: (fields) => {
        const mod = _.module.nabnak
        fields.status.options = Object.keys(mod.schema.enum.status)
        fields.priority.options = Object.keys(mod.schema.enum.priority)
      },
      onSubmit: (args) => { _.logger.log(`form submitted`,_.logger.level.debug,args) },
      onCancel: (args) => { _.logger.log(`form cancelled`,_.logger.level.debug,args) },
      fields: {
        id: { type: 'hidden' },
        projectId: { type: 'hidden' },
        groupId: { type: 'hidden' },
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
        // not using displayName yet, I simply dont care atm
        acceptanceCriteria: { type: 'textarea', displayName: 'Acceptance Criteria' },
        status: { type: 'select', required: true, options: [] },
        priority: { type: 'select', options: [] }
      }
    }
  },
}