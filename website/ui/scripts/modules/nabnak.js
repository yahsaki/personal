_.module.nabnak = {
  load: (selector) => {
    const parentEl = document.querySelector(selector)
    if (!parentEl) { throw Error(`nabnak.load: failed to find parent element via selector '${selector}'`) }

    // 261008: shortcuts not implemented
    const module = { name: 'nabnak', displayName: 'nabnak', code: 'NBK', shortcuts: ['n'] }
    if (_.module.terminal) { _.module.terminal.data.module[module.name] = module }

    // we dont want this value stored to state
    _.module.nabnak.setting.parentSelector = selector

    _.fn.updateTitle('NABNAK')

    // fn.render needs to be remapped to whatever the current view is
    _.fn.render = _.module.nabnak.fn.render
    // fetch storage data
    _.module.nabnak.db.get()
    // outdated state missing properties overwriting latest state so reupdate it here
    _.module.nabnak.state = {
      ..._.module.nabnak.schema.state,
      ..._.module.nabnak.state,
    }
    // set css(should css be global? I dont see a reason not atm)
    _.module.nabnak.setCss()
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
      _.logger.log('nabnak.fn.render: called',_.logger.level.debug,_.module.nabnak.state.selected)
      // wrap every render in a doAction
      const mod = _.module.nabnak
      if (!mod.state.currentPage) {
        mod.state.currentPage = mod.setting.defaultPage
      }
      _.module.nabnak.page[mod.state.currentPage]()
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
        case 'cl':
        case 'clear': {
          mod.state.selectedProjectIndex = null
          mod.state.selectedGroupIndex = null
          mod.state.selectedTaskIndex = null
          mod.fn.doAction(_.fn.render)
        } break
        case 'c':
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
        case 's':
        case 'sel':
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
              if (!isNaN(args[1][0])) {
                return handleIndexString(args[1])
              } else {
                _.logger.log(`invalid argument '${args[1]}'`,_.logger.level.warn)
              }
            } break
          }
        } break
        case 'u':
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

      // slightly breaking my rules with this embedded function but I really dont want it anywhere else
      function handleIndexString(string) {
        // alright super simple implementation. if project/group already selected, prepend them to the indexArr. going
        // to ignore the selected
        let validIndexArgumentCount = 3
        const indexArr = string.split('-').map(x => (parseInt(x)))
        if (indexArr.length > validIndexArgumentCount) {
          _.logger.log(`too many index arguments provided`,_.logger.level.warn,indexArr);return
        }
        if (indexArr.length === validIndexArgumentCount) {
          // if they provided 3 arguments, replace .state regardless of what it has
        }
        if (indexArr.length < validIndexArgumentCount) {
          // indexArr less than 3
          // prepend last state index into local index and watch the fireworks go
          const copyOfState = structuredClone(mod.state.selected)
          while (copyOfState.length) {
            indexArr.splice(0, 0, copyOfState.pop())
          }
        }
        // below is an exact copy of the above code
        if (indexArr.length > validIndexArgumentCount) {
          _.logger.log(`too many index arguments provided`,_.logger.level.warn,indexArr);return
        }

        // cleared for takeoff
        const project = mod.data.projects[indexArr[0]]
        if (!project) {
          _.logger.log(`no project found on index ${indexArr[0]}`,_.logger.level.warn,indexArr);return
        } else {
          console.log('project', project, indexArr)
          if (!isNaN(indexArr[1])) {
            const group = project.groups[indexArr[1]]
            if (!group) {
              _.logger.log(`no group found on index ${indexArr[1]} for project '${project.name}'`,_.logger.level.warn,indexArr);return
            } else {
              console.log('group', group)
              if (!isNaN(indexArr[2])) {
                const task = group.tasks[indexArr[2]]
                if (!task) {
                  _.logger.log(`no task found on index ${indexArr[2]} for group '${group.name}', project '${project.name}'`,_.logger.level.warn,indexArr);return
                }
                console.log('task', task)
              }
            }
          }
        }

        // success
        mod.state.selected = indexArr
        mod.fn.doAction(mod.fn.render)
        return
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
  onInputKeyDown: (e) => {
    const mod = _.module.nabnak
    // high potential to collide with terminal's behaviors
    if (!e.target.value.length) {
      if (e.key === 'Backspace') {
        // if the user hits backspace on an empty cli, unselect the lowest selected entity
        // this should be page depended, so yeah
        mod.state.selected.pop()
        mod.fn.doAction(mod.fn.render)
      }
    }
    
  },
  command: {
    
  },
  db: {
    save: () => {
      const mod = _.module.nabnak
      const dataString = JSON.stringify(mod.data)
      const stateString = JSON.stringify(mod.state)
      _.storage.save(`${mod.setting.name}-data`, dataString)
      _.storage.save(`${mod.setting.name}-state`, stateString)
      _.logger.log('nabnak.db.save: data saved')
    },
    get: () => {
      const mod = _.module.nabnak
      const data = _.storage.get(`${mod.setting.name}-data`)
      if (data) {
        _.module.nabnak.data = data
        _.logger.log(`nabnak.db.get: fetched data`, _.logger.level.debug, data)
      } else {
        _.logger.log(`nabnak.db.get: no data found`)
      }
      const state = _.storage.get(`${mod.setting.name}-state`)
      if (state) {
        _.module.nabnak.state = state
        _.logger.log(`nabnak.db.get: fetched state`, _.logger.level.debug, state)
      } else {
        _.logger.log(`nabnak.db.get: no state found`)
      }
    },
  },
  // eh, doesnt feel like it should live in state or data so here we go...
  setting: {
    name: 'nabnak', // feels dumb setting it like this. I mean the module is already named this
    defaultPage: 'projectList',
  },
  // attempting to keep these as strings so it can be saved/restored
  // how about we keep all prop names flattened here
  state: {
    // index tree of selected project/group/task. not sure if comments need this level of support... shouldnt
    selected: [],
    // shit mayne lets do it. lets navigate pages via array items
    page: [],
  },
  // would like this entire object to be saved to localstorage, not just data.projects like before
  data: {},
  schema: {
    state: {
      selected: [],
      page: [],
    },
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
  // temporary name yet again
  setCss: () => {
    _.logger.log(`nabnak.setCss: rename this someday`,_.logger.level.debug)
    const style = document.createElement('style')
    style.setAttribute('data-module', _.module.nabnak.setting.name)
    style.innerText = `
    .nabnak {
      margin-top: 4px;
      margin-left: 4px;
      margin-right: 4px;
      border: 1px solid #66FF66;
      height: 98%;
      overflow: auto;
    }
    .project-list {}
    .project-list .title {
      display: block;
      font-weight: bold;
      color: #04D9FF;
    }
    .project-list .project {
      border: 1px solid #66FF66;
      margin: 4px;
      padding: 4px;
    }
    .project-list .project .title {}
    .project-list .group {
      border: 1px solid yellow;
      margin: 4px;
      padding: 4px;
    }
    .project-list .task {
      border: 1px solid red;
      margin: 4px;
      padding: 4px;
    }
    `
    document.head.append(style)
  },
  page: {
    projectList: () => {
      const mod = _.module.nabnak
      const parentEl = document.querySelector(mod.setting.parentSelector)
      let html = `
      <div class="nabnak project-list">
        ${renderProjects()}
      </div>
      `
      parentEl.innerHTML = html

      function renderProjects() {
        let string = ``
        for (let i in mod.data.projects) {
          const project = mod.data.projects[i]
          string += `
          <div data-id="${project.id}" class="project">
            <div class="title-container">
              <div class="title">[${i}] ${project.name}: ${project.description}</div>
            </div>
            <div class="group-container">
              ${renderGroups(project.groups, i)}
            </div>
          </div>
          `
        }
        return string
      }
      function renderGroups(groups, projectIndex) {
        let string = ''
        for (let i in groups) {
          const group = groups[i]
          string += `
          <div data-id="${group.id}" class="group">
            <div class="title-container">
              <div class="title">[${projectIndex}-${i}] ${group.name}: ${group.description}</div>
            </div>
            <div class="task-container">
              ${renderTasks(group.tasks, i, projectIndex)}
            </div>
          </div>
          `
        }
        return string
      }
      function renderTasks(tasks, groupIndex, projectIndex) {
        let string = ''
        for (let i in tasks) {
          const task = tasks[i]
          string += `
          <div data-id="${task.id}" class="task">
            <div class="title-container">
              <div class="title">[${projectIndex}-${groupIndex}-${i}] ${task.name}</div>
            </div>
            <div class="content">
              <div class="description">${task.description}</div>
            </div>
          </div>
          `
        }
        return string
      }
    }
  }
}