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
      
      if (typeof mod.command[args[0]] === 'function') {
        mod.command[args[0]](args)
        return
      }
      switch (args[0]) {
        case 'del':
        case 'delete': {
          // only supporting deleting by currently selected thing for a bit. current confirmation implementation depends on
          // that too. fully intend to create the form confirmation version later(some decade)
          if (!mod.state.selected.length) { _.logger.log(`select something`,_.logger.level.warn);return }
          mod.fn.doAction(() => { deleteByIndexArray(mod.state.selected) })
          return

          if (!args[1]) {
            // if only a 'del' command supplied, attempt to delete current selected thing
            if (!mod.state.selected.length) { _.logger.log(`select something`,_.logger.level.warn);return }
            mod.fn.doAction(() => { deleteByIndexArray(mod.state.selected) })
            return
          }
          if (!isNaN(args[1][0])) {
            mod.fn.doAction(() => { deleteByIndexArray(handleIndexString(args[1])) })
          } else {
            _.logger.log(`invalid argument '${args[1]}'`,_.logger.level.warn);return
          }
        } break
        case 'cl':
        case 'reset':
        case 'clear': {
          mod.state.selected = []
          mod.state.currentPage = mod.setting.defaultPage
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
              mod.fn.doAction(mod.fn.create.group)
            } break
            case 'task': {
              mod.fn.doAction(mod.fn.create.task)
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
                mod.fn.doAction(() => { selectByIndexArray(handleIndexString(args[1])) })
              } else {
                _.logger.log(`invalid argument '${args[1]}'`,_.logger.level.warn)
              }
            } break
          }
        } break
        case 'u':
        case 'update': {
          if (!args[1]) {
            return mod.fn.doAction(() => { updateByIndexArray(handleIndexString()) })
          }
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
                mod.fn.doAction(() => { updateByIndexArray(handleIndexString(args[1])) })
              } else {
                _.logger.log(`invalid argument '${args[1]}'`,_.logger.level.warn)
              }
            } break
          }
        } break
        default: {
          _.logger.log(`unknown command '${args[0]}'`,_.logger.level.warn,args)
        } break
      }

      // slightly breaking my rules with this embedded function but I really dont want it anywhere else
      // these embedded fns are technically hacks. to fix this, implement project/group/task maps
      // 261011: now that we can pass nulls here this name is somewhat invalid. defaulting the arg to an empty array or
      // something doesnt quite work without refactoring
      function handleIndexString(string) {
        // alright super simple implementation. if project/group already selected, prepend them to the indexArr. going
        // to ignore the selected
        let validIndexArgumentCount = 3
        let indexArr
        if (!string) { indexArr = [] }
        else { 
          indexArr = string.split('-').map(x => {
            const int = parseInt(x)
            if (isNaN(int)) {
              _.logger.log(`index string '${string}' invalid`,_.logger.level.error)
              throw Error(`index string '${string}' invalid`)
            }
            return int
          })
        }
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
        
        if (indexArr.length > validIndexArgumentCount) {
          _.logger.log(`too many index arguments provided`,_.logger.level.warn,indexArr);return
        }

        // cleared for takeoff
        return indexArr
      }
      // I think its really cool how these <update/select/delete> by index array fns are implemented differently
      function updateByIndexArray(indexArr) {
        if (!indexArr) return
        const project = mod.data.projects[indexArr[0]]
        if (!project) {
          _.logger.log(`no project found on index ${indexArr[0]}`,_.logger.level.warn,indexArr);return
        }
        if (isNaN(indexArr[1])) {
          // hack: dont want to force the currently selected thing to be this on update but I got no choice due to some
          // terrible code in task.form's setup function
          mod.state.selected = indexArr
          mod.fn.update.project(project);return
        }
        const group = project.groups[indexArr[1]]
        if (!group) {
          _.logger.log(`no group found on index ${indexArr[1]} for project '${project.name}'`,_.logger.level.warn,indexArr);return
        }
        if (isNaN(indexArr[2])) {
          mod.state.selected = indexArr
          mod.fn.update.group({project,group});return
        }
        const task = group.tasks[indexArr[2]]
        if (!task) {
          _.logger.log(`no task found on index ${indexArr[2]} for group '${group.name}', project '${project.name}'`,_.logger.level.warn,indexArr);return
        }
        mod.state.selected = indexArr
        mod.fn.update.task({project,group,task});return
      }
      function selectByIndexArray(indexArr) {
        if (!indexArr) return
        const project = mod.data.projects[indexArr[0]]
        if (!project) {
          _.logger.log(`no project found on index ${indexArr[0]}`,_.logger.level.warn,indexArr);return
        } else {
          mod.state.currentPage = mod.setting.projectPage
          if (!isNaN(indexArr[1])) {
            const group = project.groups[indexArr[1]]
            if (!group) {
              _.logger.log(`no group found on index ${indexArr[1]} for project '${project.name}'`,_.logger.level.warn,indexArr);return
            } else {
              mod.state.currentPage = mod.setting.groupPage
              if (!isNaN(indexArr[2])) {
                const task = group.tasks[indexArr[2]]
                if (!task) {
                  _.logger.log(`no task found on index ${indexArr[2]} for group '${group.name}', project '${project.name}'`,_.logger.level.warn,indexArr);return
                }
                mod.state.currentPage = mod.setting.taskPage
              }
            }
          }
        }

        // success
        mod.state.selected = indexArr
        mod.fn.doAction(_.fn.render)
        return
      }
      function deleteByIndexArray(indexArr) {
        if (!indexArr) return
        const project = mod.data.projects[indexArr[0]]
        if (!project) { _.logger.log(`failed to find project by index ${indexArr[0]}`,_.logger.level.warn,indexArr);return }
        let group, task
        if (indexArr.length === 1) {
          // confirmation flaw: you can confirm on project then proceed to delete a group without a re-confirmation. IDGAF im 
          // the only user atm, just needed to be noted though
          if (!mod.deleteConfirmed) {
            _.logger.log(`CONFIRM deletion of project '${project.name}' by typing delete command again`,_.logger.level.error)
            mod.deleteConfirmed = true
            return
          } else {
            mod.data.projects.splice(parseInt(indexArr[0]), 1)
            mod.db.save()
            _.logger.log(`project '${project.name}' deleted. TODO: put deleted objects in deleted array or something with TTL`)
            mod.state.selected = []
            mod.fn.doAction(_.fn.render)
            mod.deleteConfirmed = null
            return
          }
        }
        if (indexArr.length === 2) {
          group = project.groups[indexArr[1]]
          if (!group) { _.logger.log(`failed to find group via ${indexArr[0]}-${indexArr[1]}`,_.logger.level.warn);return }
          if (!mod.deleteConfirmed) {
            _.logger.log(`CONFIRM deletion of group '${group.name}' in project '${project.name}' by typing delete command again`,_.logger.level.error)
            mod.deleteConfirmed = true
            return
          } else {
            project.groups.splice(parseInt(indexArr[1]), 1)
            mod.db.save()
            _.logger.log(`group '${group.name}' deleted for project '${project.name}'. TODO: put deleted objects in deleted array or something with TTL`)
            mod.state.selected.length = 1
            mod.fn.doAction(_.fn.render)
            mod.deleteConfirmed = null
            return
          }
        }
        if (indexArr.length === 3) {
          group = project.groups[indexArr[1]]
          if (!group) { _.logger.log(`failed to find group via ${indexArr[0]}-${indexArr[1]}`,_.logger.level.warn);return }
          task = group.tasks[indexArr[2]]
          if (!task) { _.logger.log(`failed to find task via ${indexArr[0]}-${indexArr[1]}-${indexArr[2]}`,_.logger.level.warn);return }
          
          if (!mod.deleteConfirmed) {
            _.logger.log(`CONFIRM deletion of task '${task.name}' in group '${group.name}' in project '${project.name}' by typing delete command again`,_.logger.level.error)
            mod.deleteConfirmed = true
            return
          } else {
            group.tasks.splice(parseInt(indexArr[2]), 1)
            mod.db.save()
            _.logger.log(`task '${task.name}' in group '${group.name}' in project '${project.name}' deleted. TODO: put deleted objects in deleted array or something with TTL`)
            mod.state.selected.length = 2
            mod.fn.doAction(_.fn.render)
            mod.deleteConfirmed = null
            return
          }
        }
      }
    },
    // I feel like this pathing is still not right, or optimal
    create: {
      project: () => {
        _.form.load({ 
          title: 'Create Project',
          form: _.module.nabnak.form.project,
          onSubmit: _.module.nabnak.form.project.onSubmit.create,
          onCancel: _.module.nabnak.form.onCancel,
        })
      },
      group: () => {
        _.form.load({
          title: 'Create Group',
          form: _.module.nabnak.form.group,
          onSubmit: _.module.nabnak.form.group.onSubmit.create,
          onCancel: _.module.nabnak.form.onCancel,
        })
      },
      task: () => {
        _.form.load({
          title: 'Create Task',
          form: _.module.nabnak.form.task,
          onSubmit: _.module.nabnak.form.task.onSubmit.create,
          onCancel: _.module.nabnak.form.onCancel,
        })
      },
    },
    update: {
      project: (project) => {
        const mod = _.module.nabnak
        const form = {
          setup: mod.form.project.setup,
          fields: structuredClone(mod.form.project.fields)
        }
        form.fields.id.value = project.id
        form.fields.name.value = project.name
        form.fields.description.value = project.description
        form.fields.tags.value = project.tags.join(',')

        _.form.load({ 
          title: 'Update Project',
          form,
          onSubmit: mod.form.project.onSubmit.update,
          onCancel: mod.form.onCancel,
        })
      },
      group: (args) => {
        const mod = _.module.nabnak
        const project = args.project
        const group = args.group
        const form = {
          setup: mod.form.group.setup,
          fields: structuredClone(mod.form.group.fields)
        }
        form.fields.id.value = group.id
        form.fields.project.value = project.id
        // changing project to hidden because I am not supporting changing projects atm(never done this before)
        form.fields.project.type = 'hidden'
        form.fields.name.value = group.name
        form.fields.description.value = group.description
        form.fields.tags.value = group.tags.join(',')

        _.form.load({
          title: 'Update Group',
          form,
          onSubmit: mod.form.group.onSubmit.update,
          onCancel: mod.form.onCancel,
        })
      },
      task: (args) => {
        const mod = _.module.nabnak
        const project = args.project
        const group = args.group
        const task = args.task

        const form = {
          setup: mod.form.task.setup,
          fields: structuredClone(mod.form.task.fields),
        }
        form.fields.id.value = task.id
        form.fields.projectId.value = project.id
        // same as group, im hiding the control on update to support changing groups later
        form.fields.group.type = 'hidden'
        form.fields.group.value = group.id
        form.fields.name.value = task.name
        form.fields.description.value = task.description
        form.fields.tags.value = task.tags.join(',')
        form.fields.acceptanceCriteria.value = task.acceptanceCriteria
        form.fields.status.value = task.status
        form.fields.priority.value = task.priority

        _.form.load({
          title: 'Update Task',
          form,
          onSubmit: mod.form.task.onSubmit.update,
          onCancel: mod.form.onCancel,
        })
      },
    },
  },
  onInputKeyDown: (e) => {
    const mod = _.module.nabnak
    // high potential to collide with terminal's behaviors
    if (!e.target.value.length) {
      if (e.key === 'Backspace') {
        
        // if the user hits backspace on an empty cli, unselect the lowest selected entity
        // this should be page depended, so yeah
        mod.state.selected.pop()
        mod.fn.doAction(_.fn.render)
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
    projectPage: 'project',
    groupPage: 'group',
    taskPage: 'task',
    kanbanPage: 'kanban',
  },
  // attempting to keep these as strings so it can be saved/restored
  // how about we keep all prop names flattened here
  state: {
    // index tree of selected project/group/task. not sure if comments need this level of support... shouldnt
    selected: [],
    // eventually support back button
    page: [],
    // sticking with this prop for a bit
    currentPage: null,
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
    onCancel: () => { _.logger.log(`nabnak.form.onCancel: form cancelled`,_.logger.level.debug) },
    project: {
      setup: (fields) => {},
      fields: {
        id: { type: 'hidden' },
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
      },
      onCancel: (args) => { _.logger.log(`form cancelled`,_.logger.level.debug,args) },
      // 261011: placing these fns here no longer makes sense but whatever, changing it later
      // the true loss here is if delete doesnt use a form which means we'll have to place that somewhere else...
      // im just going to put delete here anyway screw it
      onSubmit: {
        create: (args) => {
          const mod = _.module.nabnak
          _.logger.log(`form submitted`,_.logger.level.debug,args)
          const project = {...mod.schema.project}
          const date = new Date()
          project.id = crypto.randomUUID()
          project.name = args.name.value
          project.description = args.description.value
          if (args.tags.value.length) {
            // _.form handles cleaning up tags
            project.tags = args.tags.value.split(',')
          }
          project.date_created = date.toISOString()
          project.date_updated = date.toISOString()
          // hackish. TODO: some shared fn should be creating this group
          // we could create a field for group name, default it to 'default'
          project.groups.push({
            ...mod.schema.group,
            id: crypto.randomUUID(),
            name: 'default',
            description: '',
            date_created: date.toISOString(),
            date_updated: date.toISOString(),
          })
          mod.data.projects.push(project)
          _.logger.log(`project '${project.name}' created`)
          mod.db.save()
          mod.fn.doAction(_.fn.render)
        },
        update: (args) => {
          const mod = _.module.nabnak
          _.logger.log(`form submitted`,_.logger.level.debug,args)
          const project = mod.data.projects.find(x => x.id === args.id.value)
          if (!project) {
            _.logger.log(`failed to find project by id '${args.id.value}'`,_.logger.level.warn,args)
            return
          }
          project.name = args.name.value
          project.description = args.description.value
          if (args.tags.value.length) { project.tags = args.tags.value.split(',') }
          project.date_updated = new Date().toISOString()

          mod.db.save()
          _.logger.log(`project '${project.name}' updated`)
          mod.fn.doAction(_.fn.render)
        },
      },
    },
    group: {
      setup: (fields) => {
        const mod = _.module.nabnak
        fields.project.options = mod.data.projects.map(x => ({ id: x.id, name: x.name }))
        const project = mod.data.projects[mod.state.selected[0]]
        if (project) {
          fields.project.value = project.id
        }
      },
      fields: {
        id: { type: 'hidden' },
        project: { type: 'select', options: [], required: true },
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
      },
      onCancel: (args) => { _.logger.log(`form cancelled`,_.logger.level.debug,args) },
      onSubmit: {
        create: (args) => {
          const mod = _.module.nabnak
          _.logger.log(`form submitted`,_.logger.level.debug,args)
          const project = mod.data.projects.find(x => x.id === args.project.value)
          if (!project) {
            _.logger.log(`failed to find project by id '${args.project.value}'`,_.logger.level.warn);return
          }
          const group = {...mod.schema.group}
          const date = new Date()
          group.id = crypto.randomUUID()
          group.name = args.name.value
          group.description = args.description.value
          if (args.tags.value.length) { group.tags = args.tags.value.split(',') }
          group.date_created = date.toISOString()
          group.date_updated = date.toISOString()
          project.groups.push(group)
          _.logger.log(`group '${group.name}' created for project '${project.name}'`,_.logger.level.info,group)
          mod.db.save()
          mod.fn.doAction(_.fn.render)
        },
        update: (args) => {
          const mod = _.module.nabnak
          _.logger.log(`form submitted`,_.logger.level.debug,args)
          const project = mod.data.projects.find(x => x.id === args.project.value)
          if (!project) {
            _.logger.log(`failed to find project by id '${args.project.value}'`,_.logger.level.warn);return
          }
          const group = project.groups.find(x => x.id === args.id.value)
          if (!group) {
            _.logger.log(`failed to find group by id '${args.id.value}'`,_.logger.level.warn);return
          }

          // TODO: support moving groups between projects(WTF) because the dumbass field lets you change it. not
          // implementing that right now, same for tasks
          group.name = args.name.value
          group.description = args.description.value
          if (args.tags.value.length) { group.tags = args.tags.value.split(',') }
          group.date_updated = new Date().toISOString()

          mod.db.save()
          _.logger.log(`group '${group.name}' updated for project '${project.name}'`,_.logger.level.info,group)
          mod.fn.doAction(_.fn.render)
        }
      },
    },
    task: {
      setup: (fields) => {
        // 261010: to fully support task they way we support group select project DDL, we would need to create project/group
        // DDLs that changes their values on value change, IE when the project DDL changes, the group's value must change with it.
        // not going to support this at this time SO a project MUST be selected for create task to work
        const mod = _.module.nabnak
        fields.status.options = Object.keys(mod.schema.enum.status)
        fields.priority.options = Object.keys(mod.schema.enum.priority)
        const project = mod.data.projects[mod.state.selected[0]]
        if (!project) {
          const text = `please select project to create a task`
          _.logger.log(text,_.logger.level.error)
          throw Error(text)
        }
        fields.projectId.value = project.id
        if (!project.groups.length) {
          // currently the only 'no groups' check in the module
          const text = `project '${project.name}' needs at least one group`
          _.logger.log(text,_.logger.level.error)
          throw Error(text)
        }
        // cant wait to maps
        const group = project.groups[mod.state.selected[1]]
        if (group) { fields.group.value = group.id }
        else {
          // just going to default it to the first one for now
          fields.group.value = project.groups[0].id
        }
        fields.group.options = project.groups.map(x => ({ id:x.id, name:x.name }))
      },
      fields: {
        id: { type: 'hidden' },
        projectId: { type: 'hidden' },
        group: { type: 'select', options: [], required: true },
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
        // not using displayName yet, I simply dont care atm
        acceptanceCriteria: { type: 'textarea', displayName: 'Acceptance Criteria' },
        status: { type: 'select', required: true, options: [] },
        priority: { type: 'select', options: [] }
      },
      onCancel: (args) => { _.logger.log(`form cancelled`,_.logger.level.debug,args) },
      onSubmit: {
        create: (args) => {
          const mod = _.module.nabnak
          _.logger.log(`form submitted`,_.logger.level.debug,args)
          const project = mod.data.projects.find(x => x.id === args.projectId.value)
          if (!project) { _.logger.log(`projectId '${args.projectId.value}' doesnt match any projects`,_.logger.level.warn,args);return }
          const group = project.groups.find(x => x.id === args.group.value)
          if (!group) { _.logger.log(`groupId '${args.group.value}' doesnt match any groups for project '${project.name}'`,_.logger.level.warn,args);return }
          const task = {...mod.schema.task}
          const date = new Date()
          task.id = crypto.randomUUID() // we technically dont need these yet which is crazy
          task.name = args.name.value
          task.description = args.description.value
          task.acceptanceCriteria = args.acceptanceCriteria.value
          task.status = args.status.value
          task.priority = args.priority.value
          if (args.tags.value.length) { task.tags = args.tags.value.split(',') }
          task.date_created = date.toISOString()
          task.date_updated = date.toISOString()

          _.logger.log(`task '${task.name}' created and added to group '${group.name}' to project '${project.name}'`)
          group.tasks.push(task)

          mod.db.save()
          mod.fn.doAction(_.fn.render)
        },
        update: (args) => {
          const mod = _.module.nabnak
          _.logger.log(`form submitted`,_.logger.level.debug,args)
          const project = mod.data.projects.find(x => x.id === args.projectId.value)
          if (!project) { _.logger.log(`projectId '${args.projectId.value}' doesnt match any projects`,_.logger.level.warn,args);return }
          const group = project.groups.find(x => x.id === args.group.value)
          if (!group) { _.logger.log(`groupId '${args.group.value}' doesnt match any groups for project '${project.name}'`,_.logger.level.warn,args);return }
          const task = group.tasks.find(x => x.id === args.id.value)
          if (!task) { _.logger.log(`failed to find task by id '${args.id.value}' for group '${group.name}' for project '${project.name}'`,_.logger.level.warn,args);return }

          task.name = args.name.value
          task.description = args.description.value
          task.acceptanceCriteria = args.acceptanceCriteria.value
          task.status = args.status.value
          task.priority = args.priority.value
          if (args.tags.value.length) { task.tags = args.tags.value.split(',') }
          task.date_updated = new Date().toISOString()

          mod.db.save()
          _.logger.log(`task '${task.name}' updated for group '${group.name}' for project '${project.name}'`)
          mod.fn.doAction(_.fn.render)
        }
      },
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
    .project-list-page {}
    .project-list-page .title {
      display: block;
      font-weight: bold;
      color: #04D9FF;
    }
    .project-list-page .project {
      border: 1px solid #66FF66;
      margin: 4px;
      padding: 4px;
    }
    .project-list-page .project .title {}
    .project-list-page .group {
      border: 1px solid yellow;
      margin: 4px;
      padding: 4px;
    }
    .project-list-page .task {
      border: 1px solid red;
      margin: 4px;
      padding: 4px;
    }
    .project-page {
      text-align: center;
      font-size: 20px;
    }
    .project-page .project-title {
      display: block;
      font-size: 24px;
      font-weight: bold;
    }
    .project-page .project-dates {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .project-page .description {
      padding: 10px;
    }
    .project-page .tags {
      padding: 10px;
    }
    `
    document.head.append(style)
  },
  page: {
    kanban: () => {
      _.logger.log(`unimplemented`,_.logger.level.error)
    },
    projectList: () => {
      const mod = _.module.nabnak
      const parentEl = document.querySelector(mod.setting.parentSelector)
      let html = `
      <div class="nabnak project-list-page">
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
    },
    project: () => {
      const mod = _.module.nabnak
      // users(me only) have the ability to modify selected object with one keypress, so lets check if a selected project still
      // exists on render. if not, change page to default for now. I dont like that logic living here but I cant think of a better
      // solution until more code exists
      if (!mod.state.selected.length) {
        mod.state.currentPage = mod.setting.defaultPage
        mod.fn.doAction(_.fn.render)
        return
      }
      const parentEl = document.querySelector(mod.setting.parentSelector)
      let html = `
      <div class="nabnak project-page">
        ${renderProject()}
      </div>
      `
      parentEl.innerHTML = html

      function renderProject() {
        const project = mod.data.projects[mod.state.selected[0]]
        let string = `
        <div class="project">
          <div class="title-container">
            <span class="title project-title">${project.name}</span>
          </div>
          <div class="project-content">
            <div class="project-dates">
              <div class="date-updated">
                Updated: ${project.date_updated}
              </div>
              <div class="date-created">
                Created: ${project.date_created}
              </div>
            </div>
            <div class="description">
              ${project.description}
            </div>
            <div class="tags">
              <b>Tags: </b>${project.tags.join(', ')}
            </div>
          </div>
        </div>
        `
        return string
      }
    },
    group: () => {},
    task: () => {},
  }
}