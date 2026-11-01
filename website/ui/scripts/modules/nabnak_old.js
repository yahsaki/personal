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
      _.fn.clear(_.module.nabnak.setting.parentSelector)
      _.module.nabnak.fn.doAction(_.module.nabnak.page[mod.state.currentPage])
    },
    handleInput: (args) => {
      const mod = _.module.nabnak
      
      if (typeof mod.command[args[0]] === 'function') {
        mod.command[args[0]](args)
        return
      }
      switch (args[0]) {
        case 'mv':
        case 'move': {
          // accepts two arguments. initially, we only support moving task(arg1) to group(arg2). only supports moving tasks
          // between groups in the same project for now.
          // a project->group must be selected, we will ignore the selected task for now
          // clear selected task on successful move due to change in index
          if (isNaN(mod.state.selected[1])) { _.logger.log(`select a project->group first`,_.logger.level.warn);return }
          const taskIndex = parseInt(args[1])
          if (isNaN(taskIndex)) { _.logger.log(`specify task index as first arg`,_.logger.level.warn);return }
          const targetGroupIndex = parseInt(args[2])
          if (isNaN(targetGroupIndex)) { _.logger.log(`specify group index as second arg`,_.logger.level.warn);return }
          const project = mod.data.projects[mod.state.selected[0]]
          if (!project) { _.logger.log(`failed to find project at ${mod.state.selected[0]}`,_.logger.level.warn);return }
          const targetGroup = project.groups[targetGroupIndex]
          if (!targetGroup) { _.logger.log(`failed to find target group at ${targetGroupIndex}`,_.logger.level.warn);return }
          const sourceGroup = project.groups[mod.state.selected[1]]
          if (!sourceGroup) { _.logger.log(`failed to find source group at ${mod.state.selected[1]}`,_.logger.level.warn);return }
          if (!sourceGroup.tasks[taskIndex]) { _.logger.log(`failed to find task in source group at ${taskIndex}`,_.logger.level.warn);return }
          // all verified, good to go
          // remove task from source
          const task = sourceGroup.tasks.splice(taskIndex, 1)[0]
          // add task to target group
          targetGroup.tasks.push(task)
          _.logger.log(`task '${task.name}' removed from group '${sourceGroup.name}' and added to group '${targetGroup.name}'`)
          mod.state.selected.length = 2
          mod.fn.doAction(() => {mod.db.save();_.fn.render()})
        } break
        case 'v':
        case 'view': {
          // for the time being this depends on a second arg
          if (!args[1]) { _.logger.log(`specify view([k]anban, [l]ist)`,_.logger.level.warn);return }
          switch (args[1]) {
            case 'l':
            case 'list': {
              if (mod.state.currentPage === mod.setting.listPage) { return }
              mod.state.currentPage = mod.setting.listPage
              mod.db.save()
              mod.fn.doAction(_.fn.render)
            } break
            case 'k':
            case 'kanban': {
              if (mod.state.currentPage === mod.setting.kanbanPage) { return }
              mod.state.currentPage = mod.setting.kanbanPage
              mod.db.save()
              mod.fn.doAction(_.fn.render)
            } break
            default: {
              _.logger.log(`view arg '${args[1]}' unsupported`,_.logger.level.warn);return
            } break
          }
        } break
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
          mod.db.save()
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
          // 261011: disabled changing pages here
          //mod.state.currentPage = mod.setting.projectPage
          if (!isNaN(indexArr[1])) {
            const group = project.groups[indexArr[1]]
            if (!group) {
              _.logger.log(`no group found on index ${indexArr[1]} for project '${project.name}'`,_.logger.level.warn,indexArr);return
            } else {
              //mod.state.currentPage = mod.setting.groupPage
              if (!isNaN(indexArr[2])) {
                const task = group.tasks[indexArr[2]]
                if (!task) {
                  _.logger.log(`no task found on index ${indexArr[2]} for group '${group.name}', project '${project.name}'`,_.logger.level.warn,indexArr);return
                }
                //mod.state.currentPage = mod.setting.taskPage
              }
            }
          }
        }

        // success
        mod.state.selected = indexArr
        mod.db.save()
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
    squishify: () => {
      // repackage projects/groups/tasks with current index(kanban all projects view needs this)
      const mod = _.module.nabnak
      const projects = []
      for (let i in mod.data.projects) {
        const project = mod.data.projects[i]
        const squishedProject = {
          id: project.id,
          index: i,
          name: project.name,
          description: project.description,
          groups: []
        }
        projects.push(squishedProject)
        for (let j in project.groups) {
          const group = project.groups[j]
          const squishedGroup = {
            id: group.id,
            index: j,
            projectIndex: i,
            projectName: project.name,
            name: group.name,
            description: group.description,
            tasks: []
          }
          squishedProject.groups.push(squishedGroup)
          for (let k in group.tasks) {
            const task = group.tasks[k]
            const squishedTask = {
              id: task.id,
              index: parseInt(k), // this is the only one im referencing in logic so far
              groupIndex: j,
              groupName: group.name, // not sure if necessary
              projectIndex: i,
              projectName: project.name,
              name: task.name,
              description: task.description,
              status: task.status,
              tags: task.tags,
              date_created: task.date_created,
              date_updated: task.date_updated,
              acceptanceCriteria: task.acceptanceCriteria,
            }
            squishedGroup.tasks.push(squishedTask)
          }
        }
      }
      return projects
    },
  },
  helper: {
    html: {
      buildListContentSectionItem: (args) => {
        const parentEl = args.parentEl
        const name = args.name
        const value = args.value
        const contentSectionItemContainerEl = document.createElement('div')
        contentSectionItemContainerEl.setAttribute('class', `content-item-container`)
        parentEl.append(contentSectionItemContainerEl)

        const contentSectionLabelEl = document.createElement('div')
        contentSectionLabelEl.setAttribute('class', 'content-item-label')
        contentSectionItemContainerEl.append(contentSectionLabelEl)
        contentSectionLabelEl.textContent = `${name}`

        const contentSectionValueEl = document.createElement('div')
        contentSectionValueEl.setAttribute('class', 'content-item-value')
        contentSectionItemContainerEl.append(contentSectionValueEl)
        contentSectionValueEl.textContent = `${ value ?? '' }`
      }
    }
  },
  onInputKeyDown: (e) => {
    const mod = _.module.nabnak
    // high potential to collide with terminal's behaviors
    if (!e.target.value.length) {
      if (e.key === 'Backspace') {
        if (mod.state.selected.length) {
          // if the user hits backspace on an empty cli, unselect the lowest selected entity
          // this should be page depended, so yeah
          mod.state.selected.pop()
          mod.db.save()
          mod.fn.doAction(_.fn.render)
        }
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
      _.logger.log('nabnak.db.save: data saved',_.logger.level.debug)
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
    defaultPage: 'list',
    kanbanPage: 'kanban',
    // not using these pages
    //projectPage: 'project',
    //groupPage: 'group',
    //taskPage: 'task',
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
        description: { type: 'textarea' },
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
          const project = structuredClone(mod.schema.project)
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
          console.log('mod schema', mod.schema)
          const group = structuredClone(mod.schema.group)
          group.id = crypto.randomUUID()
          group.name = 'default'
          group.description = ''
          group.date_created = date.toISOString()
          group.date_updated = date.toISOString()
          project.groups.push(group)
          mod.data.projects.push(project)
          _.logger.log(`project '${project.name}' created`,_.logger.level.info,project)
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
        description: { type: 'textarea' },
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
          const group = structuredClone(mod.schema.group)
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
        if (!fields.status.value) {
          fields.status.value = fields.status.options[0]
        }
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
        description: { type: 'textarea' },
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
          const task = structuredClone(mod.schema.task)
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
    .nabnak .single-line {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .selected {
      font-weight: bold;
      text-decoration: underline;
    }
    .list-page {}
    .list-page .title {
      display: block;
      font-weight: bold;
      color: #04D9FF;
    }
    .list-page .main-title {
      font-size: 30px;
    }
    .list-page .single-line {}
    .list-page .project {
      border: 1px solid #66FF66;
      margin: 16px;
      padding: 4px;
    }
    .list-page .project .title {}
    .list-page .group {
      border: 1px solid yellow;
      margin: 4px;
      padding: 4px;
    }
    .list-page .task {
      border: 1px solid red;
      margin: 4px;
      padding: 4px;
    }
    
    .list-page .content-item-container {
      display: grid;
      grid-template-columns: 1fr 8fr;
    }
    .list-page .content-item-container .content-item-label {
      font-weight: bold;
      text-align: center;
    }
    .list-page .content-item-container .content-item-value {
      white-space: pre-wrap;
    }
    .list-page .task-name {

    }
    .list-page .task-description {
      color: #FAFFFB;
    }

    .list-page .task-summary-container {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
    }
    .list-page .task-summary-container .todo-container {
      font-weight: bold;
      color: red;
    }
    .list-page .task-summary-container .inprogress-container {
      font-weight: bold;
      color: yellow;
    }
    .list-page .task-summary-container .done-container {
      font-weight: bold;
      color: green;
    } 
    
    .kanban-page {
      display: grid;
      grid-template-columns: 1fr 8fr;
    }
    .kanban-page .col-0 {
      border-right: 1px solid #66FF66;
      overflow-x: hidden;
      height: inherit;
    }
    .kanban-page .col-0 .projects-container {
      border-bottom: 1px solid #66FF66;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .kanban-page .col-0 .groups-container {}
    .kanban-page .col-1 .tasks-container {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      height: inherit;
    }
    .kanban-page .col-1 .task-col {
      border: 1px solid black;
      overflow-y: auto;
    }
    .kanban-page .col-1 .task {
      border: 1px solid #66FF66;
      margin: 6px;
    }
    .kanban-page .col-1 .selected-task {
      background-color: #373c42;
    }
    .kanban-page .col-1 .selected-task .description,
    .kanban-page .col-1 .selected-task .acceptanceCriteria {
      white-space: pre-wrap;
    }
    .kanban-page .col-1 .task .project-name {
      font-weight: bold;
      color: #66FF66;
    }
    .kanban-page .col-1 .task .group-name {
      font-weight: bold;
      color: yellow;
    }
    .kanban-page .col-1 .task .task-name {
      font-weight: bold;
      color: red;
    }
    `
    document.head.append(style)
  },
  page: {
    kanban: () => {
      const mod = _.module.nabnak
      const squishedProjects = mod.fn.squishify()
      const parentEl = document.querySelector(mod.setting.parentSelector)
      const containerEl = document.createElement('div')
      containerEl.setAttribute('class', 'nabnak kanban-page')
      projects(squishedProjects)
      parentEl.append(containerEl)

      function projects(projects) {
        console.log('projects', projects)
        containerEl.innerHTML = `
        <div class="col-0">
          <div class="projects-container">
            ${renderProjectList()}
          </div>
          <div class="groups-container">
            ${renderGroupList()}
          </div>
        </div>
        <div class="col-1">
          <div style="display:none;" class="header-container">
            <h1>ALL PROJECTS</h1>
          </div>
          <div class="content-container">
            <div class="tasks-container">
              <div class="task-col todo-col">
                <h1>TODO</h1>
                <div class="task-list">
                  ${renderTasks(mod.schema.enum.status.todo)}
                </div>
              </div>
              <div class="task-col inprogress-col">
                <h1>In Progress</h1>
                <div class="task-list">
                  ${renderTasks(mod.schema.enum.status.inprogress)}
                </div>
              </div>
              <div class="task-col done-col">
                <h1>Done</h1>
                <div class="task-list">
                  ${renderTasks(mod.schema.enum.status.done)}
                </div>
              </div>
            </div>

          </div>
        </div>
        `

        function renderProjectList() {
          let string = ''
          const selectedProject = squishedProjects[mod.state.selected[0]]
          for (let i in squishedProjects) {
            const project = squishedProjects[i]
            let selected = ''
            if (selectedProject && selectedProject.id === project.id) { selected = 'selected' }
            string += `
            <div class="project single-line ${selected}">[${project.index}]${project.name}</div>
            `
          }
          return string
        }
        // not happy with the duplicate code in this fn at all but I wasted too many cycles trying to prevent it
        function renderGroupList() {
          let string = ''
          // not sure if squished projects in same order as projects
          const selectedProject = squishedProjects[mod.state.selected[0]]
          if (selectedProject) {
            for (let i in selectedProject.groups) {
              const group = selectedProject.groups[i]
              let selected = ''
              let selectedGroup = selectedProject.groups[mod.state.selected[1]]
              // I know I can use '?.' operator but I dont want to
              if (selectedGroup && selectedGroup.id === group.id) { selected = 'selected' }
              string += `
              <div class="group single-line ${selected}">[${group.projectIndex}-${group.index}]${group.name}</div>
              `
            }
          } else {
            for (let i in squishedProjects) {
              const project = squishedProjects[i]
              for (let i in project.groups) {
                const group = project.groups[i]
                string += `
                <div class="group single-line">[${group.projectIndex}-${group.index}]${group.name}</div>
                `
              }
            }
          }
          return string
        }
        function renderTasks(status) {
          let string = ''
          let projectList = squishedProjects
          const selectedProject = squishedProjects[mod.state.selected[0]]
          if (selectedProject) { projectList = [selectedProject] }
          for (let i in projectList) {
            const project = projectList[i]
            let groupList = project.groups
            const selectedGroup = project.groups[mod.state.selected[1]]
            if (selectedGroup) { groupList = [selectedGroup] }
            for (let j in groupList) {
              const group = groupList[j]
              const filteredTasks = group.tasks.filter(x => x.status === status)
              const selectedTask = filteredTasks.find(x => x.index === mod.state.selected[2])
              // not a fan of this behavior but having the view jump around when selecting a task is offputting
              // crap, this only clears the row for this status type which is definitely a bug but im going to  treat
              // it as a feature for now
              // I really should be popping a dialog in this sitation no joke
              if (selectedTask) {
                string += `
                <div class="task selected-task">
                  <p>
                    [${selectedTask.projectIndex}-${selectedTask.groupIndex}-${selectedTask.index}]
                    <span class="project-name">${selectedTask.projectName}</span>
                    <span class="group-name">${selectedTask.groupName}</span>
                  </p>
                  <p class="name task-name">${selectedTask.name}</p>
                  <p>created: <b>${selectedTask.date_created.substring(0,10)}</b>, updated: <b>${selectedTask.date_updated.substring(0,10)}</b></p>
                  <p class="tags">tags: ${selectedTask.tags}</p>
                  <p>description:</p>
                  <p class="description">${selectedTask.description}</p>
                  <p>acceptance criteria:</p>
                  <p class="acceptanceCriteria">${selectedTask.acceptanceCriteria}</p>
                </div>
                `
              } else {
                for (let k in filteredTasks.reverse()) {
                  const task = filteredTasks[k]
                  string += `
                  <div class="task">
                    <p>
                      [${task.projectIndex}-${task.groupIndex}-${task.index}]
                      <span class="project-name">${task.projectName}</span>
                      <span class="group-name">${task.groupName}</span>
                    </p>
                    <p class="name task-name single-line">${task.name}</p>
                    <p>created: <b>${task.date_created.substring(0,10)}</b></p>
                    <p class="tags">tags: ${task.tags}</p>
                    <p class="description single-line">${task.description}</p>
                  </div>
                  `
                }
              }
            }
          }
          return string
        }
      }
      function project(project) {}
      function group(group) {}
      function task(task) {}
    },
    list: () => {
      const mod = _.module.nabnak
      const parentEl = document.querySelector(mod.setting.parentSelector)
      const containerEl = document.createElement('div')
      containerEl.setAttribute('class', 'nabnak list-page')
      switch (mod.state.selected.length) {
        case 1: { containerEl.append(project(mod.data.projects[mod.state.selected[0]])) } break
        case 2: { containerEl.append(group(mod.data.projects[mod.state.selected[0]].groups[mod.state.selected[1]])) } break
        case 3: { containerEl.append(task(mod.data.projects[mod.state.selected[0]].groups[mod.state.selected[1]].tasks[mod.state.selected[2]])) } break
        default: { containerEl.append(projects(mod.data.projects)) } break
      }
      parentEl.append(containerEl)

      function projects(projects) {
        const el = document.createElement('div')
        el.setAttribute('class', 'projects-container')
        for (let i in projects) {
          const project = projects[i]
          const projectEl = document.createElement('div')
          projectEl.setAttribute('class', 'project')
          el.append(projectEl)
          const titleContainerEl = document.createElement('div')
          titleContainerEl.setAttribute('class', 'title-container')
          projectEl.append(titleContainerEl)
          const titleEl = document.createElement('div')
          titleEl.setAttribute('class', 'title single-line')
          titleContainerEl.append(titleEl)
          titleEl.textContent = `[${i}] ${project.name}: ${project.description}`

          const groupContainerEl = document.createElement('div')
          groupContainerEl.setAttribute('class', 'group-container')
          projectEl.append(groupContainerEl)
          for (let j in project.groups) {
            const group = project.groups[j]
            const groupEl = document.createElement('div')
            groupEl.setAttribute('class', 'group')
            groupContainerEl.append(groupEl)
            const groupTitleContainerEl = document.createElement('div')
            groupTitleContainerEl.setAttribute('class', 'title-container')
            groupEl.append(groupTitleContainerEl)
            const groupTitleEl = document.createElement('div')
            groupTitleEl.setAttribute('class', 'title single-line')
            groupTitleContainerEl.append(groupTitleEl)
            groupTitleEl.textContent = `[${i}-${j}] ${group.name}: ${group.description}`

            const todo = group.tasks.filter(x => x.status === 'todo')
            const inprogress = group.tasks.filter(x => x.status === 'inprogress')
            const done = group.tasks.filter(x => x.status === 'done')

            const taskContainerEl = document.createElement('div')
            taskContainerEl.setAttribute('class', 'task-summary-container')
            groupEl.append(taskContainerEl)
            taskContainerEl.innerHTML = `
            <div class="summary-container todo-container">
              <div class="summary-title">TODO</div>
              <div class="summary-value">${todo.length}</div>
            </div>
            <div class="summary-container inprogress-container">
              <div class="summary-title">IN PROGRESS</div>
              <div class="summary-value">${inprogress.length}</div>
            </div>
            <div class="summary-container done-container">
              <div class="summary-title">DONE</div>
              <div class="summary-value">${done.length}</div>
            </div>
            `

            // keeping this here because I would like to be able to switch between these view options
            /*
            const taskContainerEl = document.createElement('div')
            taskContainerEl.setAttribute('class', 'task-container')
            groupEl.append(taskContainerEl)
            for (let k in group.tasks) {
              const task = group.tasks[k]
              const taskEl = document.createElement('div')
              taskEl.setAttribute('class', 'task')
              taskContainerEl.append(taskEl)
              const taskTitleContainerEl = document.createElement('div')
              taskTitleContainerEl.setAttribute('class', 'title-container')
              taskEl.append(taskTitleContainerEl)
              const taskTitleEl = document.createElement('div')
              taskTitleEl.setAttribute('class', 'title single-line')
              taskTitleContainerEl.append(taskTitleEl)
              taskTitleEl.textContent = `[${i}-${j}-${k}]-[${task.status}] ${task.name}`
              const taskContentEl = document.createElement('div')
              taskContentEl.setAttribute('class', 'content')
              taskEl.append(taskContentEl)
              const taskDescriptionEl = document.createElement('div')
              taskDescriptionEl.setAttribute('class', 'description')
              taskContentEl.append(taskDescriptionEl)
              taskDescriptionEl.textContent = task.description
            }
            */
          }
        }
        return el
      }
      function project(project) {
        const el = document.createElement('div')
        el.setAttribute('class', 'project-container')
        const projectEl = document.createElement('div')
        projectEl.setAttribute('class', 'project project-view')
        el.append(projectEl)

        const titleContainerEl = document.createElement('div')
        titleContainerEl.setAttribute('class', 'title-container main-title')
        projectEl.append(titleContainerEl)
        const titleEl = document.createElement('div')
        titleEl.setAttribute('class', 'title')
        titleContainerEl.append(titleEl)
        titleEl.textContent = `${project.name}`

        const projectContentContainerEl = document.createElement('div')
        projectContentContainerEl.setAttribute('class', 'content-container')
        projectEl.append(projectContentContainerEl)

        mod.helper.html.buildListContentSectionItem({parentEl:projectContentContainerEl,name:'Tags',value:project.tags.join(', ')})
        mod.helper.html.buildListContentSectionItem({parentEl:projectContentContainerEl,name:'Create Date',value:project.date_created})
        mod.helper.html.buildListContentSectionItem({parentEl:projectContentContainerEl,name:'Update Date',value:project.date_updated})
        mod.helper.html.buildListContentSectionItem({parentEl:projectContentContainerEl,name:'description',value:project.description})
        
        const groupContainerEl = document.createElement('div')
        groupContainerEl.setAttribute('class', 'group-container')
        projectEl.append(groupContainerEl)
        for (let i in project.groups) {
          const group = project.groups[i]
          const groupEl = document.createElement('div')
          groupEl.setAttribute('class', 'group')
          groupContainerEl.append(groupEl)
          const groupTitleContainerEl = document.createElement('div')
          groupTitleContainerEl.setAttribute('class', 'title-container')
          groupEl.append(groupTitleContainerEl)
          const groupTitleEl = document.createElement('div')
          groupTitleEl.setAttribute('class', 'title single-line')
          groupTitleContainerEl.append(groupTitleEl)
          groupTitleEl.textContent = `[${i}] ${group.name}: ${group.description}`

          const taskContainerEl = document.createElement('div')
          taskContainerEl.setAttribute('class', 'task-container')
          groupEl.append(taskContainerEl)
          for (let j in group.tasks) {
            const task = group.tasks[j]
            const taskEl = document.createElement('div')
            taskEl.setAttribute('class', 'task')
            taskContainerEl.append(taskEl)
            const taskTitleContainerEl = document.createElement('div')
            taskTitleContainerEl.setAttribute('class', 'title-container')
            taskEl.append(taskTitleContainerEl)
            const taskTitleEl = document.createElement('div')
            taskTitleEl.setAttribute('class', 'title single-line')
            taskTitleContainerEl.append(taskTitleEl)
            taskTitleEl.textContent = `[${i}-${j}]-[${task.status}] ${task.name}`
            const taskContentEl = document.createElement('div')
            taskContentEl.setAttribute('class', 'content')
            taskEl.append(taskContentEl)
            const taskDescriptionEl = document.createElement('div')
            taskDescriptionEl.setAttribute('class', 'description')
            taskContentEl.append(taskDescriptionEl)
            taskDescriptionEl.textContent = task.description
          }
        }
        return el
      }
      function group(group) {
        const el = document.createElement('div')
        el.setAttribute('class', 'group-container')
        const groupEl = document.createElement('div')
        groupEl.setAttribute('class', 'group')
        el.append(groupEl)

        const titleContainerEl = document.createElement('div')
        titleContainerEl.setAttribute('class', 'title-container main-title')
        groupEl.append(titleContainerEl)
        const titleEl = document.createElement('div')
        titleEl.setAttribute('class', 'title')
        titleContainerEl.append(titleEl)
        titleEl.textContent = `${group.name}`

        const groupContentContainerEl = document.createElement('div')
        groupContentContainerEl.setAttribute('class', 'content-container')
        groupEl.append(groupContentContainerEl)

        mod.helper.html.buildListContentSectionItem({parentEl:groupContentContainerEl,name:'Tags',value:group.tags.join(', ')})
        mod.helper.html.buildListContentSectionItem({parentEl:groupContentContainerEl,name:'Create Date',value:group.date_created})
        mod.helper.html.buildListContentSectionItem({parentEl:groupContentContainerEl,name:'Update Date',value:group.date_updated})
        mod.helper.html.buildListContentSectionItem({parentEl:groupContentContainerEl,name:'description',value:group.description})

        const taskContainerEl = document.createElement('div')
        taskContainerEl.setAttribute('class', 'task-container')
        groupEl.append(taskContainerEl)
        for (let i in group.tasks) {
          const task = group.tasks[i]
          const taskEl = document.createElement('div')
          taskEl.setAttribute('class', 'task')
          taskContainerEl.append(taskEl)
          const taskTitleContainerEl = document.createElement('div')
          taskTitleContainerEl.setAttribute('class', 'title-container')
          taskEl.append(taskTitleContainerEl)
          const taskTitleEl = document.createElement('div')
          taskTitleEl.setAttribute('class', 'title single-line')
          taskTitleContainerEl.append(taskTitleEl)
          taskTitleEl.textContent = `[${i}]-[${task.status}] ${task.name}`
          const taskContentEl = document.createElement('div')
          taskContentEl.setAttribute('class', 'content')
          taskEl.append(taskContentEl)
          const taskDescriptionEl = document.createElement('div')
          taskDescriptionEl.setAttribute('class', 'description')
          taskContentEl.append(taskDescriptionEl)
          taskDescriptionEl.textContent = task.description
        }
        return el
      }
      function task(task) {
        const el = document.createElement('div')
        el.setAttribute('class', 'task-container')
        const taskEl = document.createElement('div')
        taskEl.setAttribute('class', 'task')
        el.append(taskEl)

        const titleContainerEl = document.createElement('div')
        titleContainerEl.setAttribute('class', 'title-container main-title')
        taskEl.append(titleContainerEl)
        const titleEl = document.createElement('div')
        titleEl.setAttribute('class', 'title')
        titleContainerEl.append(titleEl)
        titleEl.textContent = `${task.name}`

        const taskontentContainerEl = document.createElement('div')
        taskontentContainerEl.setAttribute('class', 'content-container')
        taskEl.append(taskontentContainerEl)

        mod.helper.html.buildListContentSectionItem({parentEl:taskontentContainerEl,name:'Tags',value:task.tags.join(', ')})
        mod.helper.html.buildListContentSectionItem({parentEl:taskontentContainerEl,name:'Status',value:task.status})
        mod.helper.html.buildListContentSectionItem({parentEl:taskontentContainerEl,name:'Priority',value:task.priority})
        mod.helper.html.buildListContentSectionItem({parentEl:taskontentContainerEl,name:'Create Date',value:task.date_created})
        mod.helper.html.buildListContentSectionItem({parentEl:taskontentContainerEl,name:'Update Date',value:task.date_updated})
        mod.helper.html.buildListContentSectionItem({parentEl:taskontentContainerEl,name:'description',value:task.description})
        mod.helper.html.buildListContentSectionItem({parentEl:taskontentContainerEl,name:'acceptanceCriteria',value:task.acceptanceCriteria})

        return el
      }
    },
    group: () => {},
    task: () => {},
  }
}