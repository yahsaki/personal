// hmmmm whats the actual difference between a view and a tool in the scope of my project? they are literally the exact
// same thing so far. not going to change anything due to this yet because im sure the difference will highlight itself
// during this build
_.module.nabnak = {
  load: (selector) => {
    const parentEl = document.querySelector(selector)
    if (!parentEl) { throw Error(`nabnak.load: failed to find parent element via selector '${selector}'`) }

    const module = { name: 'nabnak', displayName: 'nabnak', code: 'NBK' }
    if (_.module.terminal) { _.module.terminal.data.module[module.name] = module }

    const data = _.module.nabnak.data
    data.parentSelector = selector

    _.fn.updateTitle('NABNAK')

    // wait a min... wtf is the html supposed to even be at this point?
    //const html = document.createElement('div')
    //html.setAttribute('class', 'nabnak-container')

    _.module.nabnak.fn.get()
    _.module.nabnak.fn.setCss()
    _.module.nabnak.fn.render.home()
    _.logger.log('nabnak.load: load complete') 
  },
  unload: () => {
    // need to keep track of event listeners
    // I dont have a set way to purge everything yet. im thinkin add a class to all elements and purging via that
  },
  fn: {
    save: () => {
      const string = JSON.stringify(_.module.nabnak.data.projects)
      _.storage.save(_.module.nabnak.data.storageKey, string)
      _.logger.log('nabnak.fn.save: projects saved')
    },
    get: () => {
      const projects = _.storage.get(_.module.nabnak.data.storageKey)
      if (projects) {
        _.module.nabnak.data.projects = projects
        _.logger.log(`nabnak.get: fetched ${projects.length} projects`,_.logger.level.debug,projects)
      } else {
        _.logger.log(`nabnak.get: no projects found`)
      }
    },
    onProjectClick: (id) => {
      _.logger.log('project clicked',_.logger.level.debug, id)
      const mod = _.module.nabnak
      const project = mod.data.projects.find(x => x.id === id)
      if (!project) {
        _.logger.log(`nabnak.fn.onProjectClick: failed to find project by id '${id}'`,_.logger.level.warn);return
      }
      if (mod.data.selectedProject?.id === project.id) {
        mod.data.selectedProject = null
        mod.data.selectedGroup = null
        mod.data.selectedTask = null
        _.logger.log(`project '${project.name}' un-selected`)
      } else if (mod.data.selectedProject) {
        mod.data.selectedProject = project
        // switching project, unselect other project's group/task
        mod.data.selectedGroup = null
        mod.data.selectedTask = null
        _.logger.log(`switched to project '${project.name}'`)
      } else {
        mod.data.selectedProject = project
        _.logger.log(`project '${project.name}' selected`)
      }
      
      _.module.nabnak.fn.render.home()
    },
    onGroupClick: (id) => {
      _.logger.log('group clicked',_.logger.level.debug, id)
      const mod = _.module.nabnak
      if (!mod.data.selectedProject) { _.logger.log(`no project selected`,_.logger.level.warn);return }
      const group = mod.data.selectedProject.groups.find(x => x.id === id)
      if (!group) {
        _.logger.log(`nabnak.fn.onGroupClick: failed to find group by id '${id}'`,_.logger.level.warn);return
      }
      if (mod.data.selectedGroup?.id === group.id) {
        _.logger.log(`group '${group.name}' un-selected`)
        mod.data.selectedGroup = null
      } else {
        _.logger.log(`group '${group.name}' selected`)
        mod.data.selectedGroup = group
      }
      
      mod.fn.render.home()
    },
    // not sold on fn.render pattern yet
    render: {
      home: () => { // home = projects page for the most part
        // 261004: want to start writing more agnostic code, starting with not directly referencing itself everywhere,
        // less things to change on renames and restructures are easier
        const mod = _.module.nabnak
        const parentEl = document.querySelector(mod.data.parentSelector)
        
        const projectsEl = mod.fn.buildHtml.projects()
        const groupsEl = mod.fn.buildHtml.groups()
        const rightViewHeaderEl = mod.fn.buildHtml.rightViewHeader()
        const projectEl = mod.fn.buildHtml.project()

        _.fn.clear(_.module.nabnak.data.parentSelector)

        const html = document.createElement('div')
        html.setAttribute('class', 'nabnak')
        html.setAttribute('data-id', mod.data.id)
        parentEl.append(html)

        const wrapper = document.createElement('div')
        wrapper.setAttribute('class', 'home')
        html.append(wrapper)

        const col0 = document.createElement('div')
        col0.setAttribute('class', 'col-0')
        wrapper.append(col0)
        col0.append(projectsEl)
        col0.append(groupsEl)

        const col1 = document.createElement('div')
        col1.setAttribute('class', 'col-1')
        wrapper.append(col1)
        col1.append(rightViewHeaderEl)
        col1.append(projectEl)
        
      }
    },
    buildHtml: {
      projects: () => {
        const data = _.module.nabnak.data
        const html = document.createElement('div')
        html.setAttribute('class', 'projects-container')
        html.innerHTML = `
        <b>Projects: ${data.projects.length}</b>
        <ul>
        ${renderProjectList()}
        </ul>
        `
        return html

        function renderProjectList() {
          let string = ''
          for (let i = 0; i < data.projects.length; i++) {
            const project = data.projects[i]
            let className = 'not-selected'
            if (project.id === data.selectedProject?.id) {
              className = 'selected'
            }
            string += `
            <li class="${className}" onclick="_.module.nabnak.fn.onProjectClick('${project.id}')" data-projectId="${project.id}" data-tempId="${i}">
              <b>${i}</b>: ${project.name}
            </li>
            `
          }
          return string
        }
      },
      groups: () => {
        const mod = _.module.nabnak
        const html = document.createElement('div')
        html.setAttribute('class', 'groups-container')
        const project = mod.data.selectedProject
        if (!project) {
          html.innerHTML = `
          <b>groups</b>
          `
          return html
        }

        html.innerHTML = `
        <b>Groups: ${project.groups.length}</b>
        <ul>${renderGroupsList()}</ul>
        `
        return html

        function renderGroupsList() {
          let string = ''
          for (let i in project.groups) {
            const group = project.groups[i]
            let className = 'not-selected'
            if (group.id === mod.data.selectedGroup?.id) {
              className = 'selected'
            }
            string += `
            <li class="${className}" onclick="_.module.nabnak.fn.onGroupClick('${group.id}')" data-projectId="${project.id}" data-tempId="${i}">
              <b>${i}</b>: ${group.name}
            </li>
            `
            
          }
          return string
        }
      },
      rightViewHeader: () => {
        // 261006: clusterjam, all this render code needs to be refactored hardcore
        const mod = _.module.nabnak
        const html = document.createElement('div')
        html.setAttribute('class', 'col1-header-container')
        html.innerHTML = `
        <div class="col1-header">
          <div class="info-row">
            <div class="row-0">PROJECT: ${mod.data.selectedProject ? mod.data.selectedProject.name : ''}</div>
            <div class="row-1">GROUP: ${mod.data.selectedGroup ? mod.data.selectedGroup.name : ''}</div>
            <div class="row-2">TASK: ${mod.data.selectedTask ? mod.data.selectedTask.name : ''}</div>
          </div>
          <div class="control-row">
            <button onclick="_.module.nabnak.fn.command.create.project()">Create Project</button>
            <button onclick="_.module.nabnak.fn.command.create.group()">Create Group</button>
            <button onclick="_.module.nabnak.fn.command.create.task()">Create Task</button>
          </div>
        </div>  
        `
        return html
      },
      project: () => {
        // thinking about it, a different fn should interface with elements returning an index. only private fns
        // should call this fn which should always have the projectId. lets see how this goes
        const mod = _.module.nabnak
        const html = document.createElement('div')
        html.setAttribute('class', 'project-container')
        const project = mod.data.selectedProject
        if (!project) {
          const h1 = document.createElement('h1')
          h1.innerText = `NO PROJECT SELECTED`
          html.append(h1)
          return html  
        }
        let tasks = []
        if (mod.data.selectedGroup) {
          for (let i in mod.data.selectedGroup.tasks) {
            const group = mod.data.selectedGroup
            tasks.push({
              ...mod.data.selectedGroup.tasks[i],
              group: {name:group.name,id:group.id}
            })
          }
        } else {
          // aggregate all tasks
          for (let i in mod.data.selectedProject.tasks) {
            tasks.push({
              ...mod.data.selectedProject.tasks[i],
              group: null,
            })
          }
          for (let i in mod.data.selectedProject.groups) {
            const group = mod.data.selectedProject.groups[i]
            for (let j in group.tasks) {
              tasks.push({
                ...group.tasks[j],
                group: {name:group.name,id:group.id}
              })
            }
          }
        }

        const todoTasks = tasks.filter(x => x.status === mod.schema.enum.status.todo)
        const inprogressTasks = tasks.filter(x => x.status === mod.schema.enum.status.inprogress)
        const doneTasks = tasks.filter(x => x.status === mod.schema.enum.status.done)

        let string = `
        <div class="tasks-container">
          <div class="task-col todo-col">
            <h1>TODO</h1>
            <div class="task-list">
              ${renderTasks(todoTasks)}
            </div>
          </div>
          <div class="task-col inprogress-col">
            <h1>In Progress</h1>
            <div class="task-list">
              ${renderTasks(inprogressTasks)}
            </div>
          </div>
          <div class="task-col done-col">
            <h1>Done</h1>
            <div class="task-list">
              ${renderTasks(doneTasks)}
            </div>
          </div>
        </div>
        `
        
        html.innerHTML = string
        return html

        // changed this arg name from 'tasks' to 'taskArgs', hate them being the same name as a locally scoped var
        // even if it works as intended
        function renderTasks(taskArgs) {
          let string = ''
          for (let i in taskArgs) {
            const task = taskArgs[i]
            string += `
            <div class="task">
              <button data-id="${task.id}" onclick="_.module.nabnak.fn.task.onClick(this)">view</button>
              <p>created: ${task.date_created}</p>
              <p>tags: ${task.tags.join(',')}</p>
              <p>name: ${task.name}</p>
              <p>desc: ${task.description}</p>
              <select class="debug" data-id="${task.id}" oninput="_.module.nabnak.fn.task.onStatusChange(this)">
                <option${task.status === mod.schema.enum.status.todo ? ' selected' : ''}>${mod.schema.enum.status.todo}</option>
                <option${task.status === mod.schema.enum.status.inprogress ? ' selected' : ''}>${mod.schema.enum.status.inprogress}</option>
                <option${task.status === mod.schema.enum.status.done ? ' selected' : ''}>${mod.schema.enum.status.done}</option>
              </select>
            </div>
            
            `
          }
          return string
        }
      },
    },
    // sold
    command: {
      help: () => {},
      // delete project data from browser storage
      wipe: () => {
        _.storage.save(_.module.nabnak.data.storageKey, null)
        _.logger.log('cleared nabnak storage')
      },
      select: {
        project: (index) => {
          const mod = _.module.nabnak
          _.logger.log('select project called!',_.logger.level.debug, index)
          const project = mod.data.projects[index]
          if (!project) {
            _.logger.log(`no project found at index ${index}`,_.logger.level.warn);return
          }
          mod.data.selectedProject = project
          _.logger.log(`project '${project.name}' selected`)
          mod.fn.render.home()
        },
        group: (index) => {
          const mod = _.module.nabnak
          if (!mod.data.selectedProject) { _.logger.log(`select a project`,_.logger.level.warn);return }
          const group = mod.data.selectedProject.groups[index]
          if (!group) { _.logger.log(`no group found at index ${index}`,_.logger.level.warn);return }
          mod.data.selectedGroup = group
          _.logger.log(`group '${group.name}' selected`)
          mod.fn.render.home()
        },
        task: (index) => {
          const mod = _.module.nabnak
          if (!mod.data.selectedProject) { _.logger.log(`select a project`,_.logger.level.warn);return }
          const task = mod.data.selectedProject.tasks[index]
          if (!task) { _.logger.log(`no task found at index ${index}`,_.logger.level.warn);return }
          mod.data.selectedTask = task
          _.logger.log(`task '${task.name}' selected`)
          // we dont have any other views yet lol
          // TODO: change(or create) this view if needed
          mod.fn.render.home()
        }
      },
      home: () => {
        _.module.nabnak.fn.render.home()
      },
      create: {
        project: () => {
          _.logger.log('create project called!',_.logger.level.debug)
          // pondered renaming .render to something like .load. I dont like other modules 'forcing' another module to
          // act: it seems better to pass the information that the module needs and let it act accordingly
          // changed it to .load, there
          _.form.load({
            title: 'Create Project',
            form: _.module.nabnak.form.project,
            // not settled on passing callback or assuming fn from string. callback should be fine so ill move forward
            // with that while keeping the name of the callback as an arg too. the reason im hesitant on string name
            // is that that would rely on the terminal's current module being this module. if that switched, we would
            // lose the reference. I prefer string name because it lets me build cross module operations without
            // directly calling them, but callback fn gives me that just as well. I found no reason not to use callback
            // yet
            callback: _.module.nabnak.fn.onSubmit.projectCreate,
            //callbackName: 'projectCreate'
          })
        },
        group: () => {
          const mod = _.module.nabnak
          if (!mod.data.selectedProject) {
            _.logger.log(`select project first`,_.logger.level.warn);return
          }
          _.form.load(({
            title: 'Create Group',
            form: mod.form.group,
            callback: mod.fn.onSubmit.groupCreate,
          }))
        },
        task: () => {
          const mod = _.module.nabnak
          if (!mod.data.selectedProject) {
            _.logger.log(`select project first. I guess we can just let you select project during task creation`,_.logger.level.warn)
            return
          }
          _.form.load({
            title: 'Create Task',
            form: mod.form.task,
            callback: mod.fn.onSubmit.taskCreate,
          })
        }
      }
    },
    handleInput: (args) => {
      // this is going to be pure slop for the first few iterations
      /*
        I could do something like this:
        fn = _.module.nabnak.fn.command[args[0]]?[args[1]]
        if (typeof fn === 'function') fn(otherargs)
      */
      if (typeof _.module.nabnak.fn.command[args[0]] === 'function') {
        _.module.nabnak.fn.command[args[0]](args)
        return
      }
      // unreadable garbage dump
      switch (args[0]) {
        case 'create': {
          if (!args[1]) { _.logger.log(`nabnak.handleInput: invalid create command. add what you want to create after that`,_.logger.level.warn);return }
          switch (args[1]) {
            case 'project': {
              _.module.nabnak.fn.command.create.project()
            } break
            case 'group': {
              _.module.nabnak.fn.command.create.group ()
            } break
            case 'task': {
              _.module.nabnak.fn.command.create.task()
            } break
            default: {
              _.logger.log(`invalid create argument '${args[1]}'. see help for details(doesnt exist yet)`,_.logger.level.warn)
            } break
          }
        } break
        case 'select': {
          if (!args[1]) { _.logger.log(`nabnak.handleInput: invalid select command. add what you want to select after that`,_.logger.level.warn);return }
          switch (args[1]) {
            case 'project': {
              if (!args[2]) { _.logger.log(`select argument requires project id as third argument. see help for details(doesnt exist yet)`,_.logger.level.warn);return }
              _.module.nabnak.fn.command.select.project(args[2])
            } break
            case 'group': {
              if (!args[2]) { _.logger.log(`select argument requires project id as third argument. see help for details(doesnt exist yet)`,_.logger.level.warn);return }
              _.module.nabnak.fn.command.select.group(args[2])
            } break
            default: {
              _.logger.log(`invalid select argument '${args[1]}'. see help for details(doesnt exist yet)`,_.logger.level.warn)
            } break
          }
        } break
        default: {
          _.logger.log(`nabnak.handleInput: unknown command '${args[0]}'. they are case sensitive at the moment so yeah`,_.logger.level.warn)
        } break
      }
    },
    /*
      the structure of these props are HORRIBLE
      - fn.buildHtml.projects
      - fn.task.onStatusChange
      - fn.onSubmit.projectCreate
      - fn.setCss
      - fn.command...
      - schema.enum
      - form.project.fields,  form.task.fields
      - fn.onProjectClick
      
      its all spur of the moment type shit. I have to look up EVERYTHING is I want to reference something, nothing
      can be assumed like this
      once a few more things are added, we can sit down and reorganize
    */
    task: {
      onStatusChange: (e) => {
        // requires an active project for this to work as is
        _.logger.log(`nabnak.fn.task.onStatusChange: status changed!`,_.logger.level.debug,e)
        const dom = _.module.nabnak
        const id = e.getAttribute('data-id')
        const task = dom.fn.task.find(id)
        if (!task) {
          _.logger.log(`nabnak.fn.task.onStatusChange: failed to find task via id '${id}'`,_.logger.level.warn,e);return
        }
        const previousStatus = task.status
        task.status = e.value
        _.logger.log(`task '${task.name}' status changed from '${previousStatus}' to '${task.status}'. TODO: handle logic once a task is marked completed, etc`)
        // set this as the active task so rerender shows it properly
        // 261006: disabling this for now(let the spaghetti rain)
        //dom.data.selectedTask = task
        // you know, we could just do render() and switch up the view according to 'state' like we're doing now
        dom.fn.save()
        dom.fn.render.home()
      },
      find: (id) => {
        // now that we have tasks all over the place we need this fn
        let mod = _.module.nabnak
        if (!mod.data.selectedProject) {
          _.logger.log(`nabnak.fn.task.find: no selected project`,_.logger.level.warn);return
        }
        let task
        task = mod.data.selectedProject.tasks.find(x => x.id === id)
        if (task) return task
        for (let i in mod.data.selectedProject.groups) {
          const group = mod.data.selectedProject.groups[i]
          task = group.tasks.find(x => x.id === id)
          if (task) return task
        }
        return task
      }
    },
    // the idea here is that these are callbacks called from outside this module
    onSubmit: {
      projectCreate: (args) => {
        _.logger.log('nabnak.fn.onSubmit.projectCreate: project submitted!',_.logger.level.debug, args)
        const project = {..._.module.nabnak.schema.project}
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

        _.module.nabnak.data.projects.push(project)
        _.logger.log(`nabnak.onSubmit.projectCreate: project '${project.name}' created`)
        _.module.nabnak.fn.save()
        // eehhhh not sure if a rerender is triggered after this but im putting this here anyway
        _.module.nabnak.fn.render.home()
      },
      groupCreate: (args) => {
        _.logger.log('nabnak.fn.onSubmit.groupCreate: group submitted!',_.logger.level.debug, args)
        const mod = _.module.nabnak
        if (!mod.data.selectedProject) {
          _.logger.log(`nabnak.fn.onsubmit.groupCreate: no selected project`,_.logger.level.warn);return
        }
        const group = {...mod.schema.group}
        const date = new Date()
        group.id = crypto.randomUUID()
        group.name = args.name.value
        group.description = args.description.value
        if (args.tags.value.length) {
          // _.form handles cleaning up tags
          project.tags = args.tags.value.split(',')
        }
        group.date_created = date.toISOString()
        group.date_updated = date.toISOString()
        mod.data.selectedProject.groups.push(group)
        _.logger.log(`nabnak.fn.onSubmit.groupCreate: group '${group.name}' created`,_.logger.level.info,group)
        mod.fn.save()
        mod.fn.render.home()
      },
      taskCreate: (args) => {
        _.logger.log('nabnak.fn.onSubmit.projectCreate: task submitted!',_.logger.level.debug, args)
        const mod = _.module.nabnak
        const task = {...mod.schema.task}
        const date = new Date()
        task.id = crypto.randomUUID() // we technically dont need these yet which is crazy
        task.name = args.name.value
        task.description = args.description.value
        task.acceptanceCriteria = args.acceptanceCriteria.value
        task.status = args.status.value
        task.priority = args.priority.value
        if (args.tags.value.length) {
          task.tags = args.tags.value.split(',')
        }
        task.date_created = date.toISOString()
        task.date_updated = date.toISOString()

        // I dont really like a fn like this having to decide where the task should go. I would rather it be dumber and
        // just dump the task where its told
        if (mod.data.selectedGroup) {
          mod.data.selectedGroup.tasks.push(task)
          _.logger.log(`nabnak.onSubmit.taskCreate: task '${task.name}' created and added to group '${mod.data.selectedGroup.name}'`)
        } else if (mod.data.selectedProject) {
          mod.data.selectedProject.tasks.push(task)
          _.logger.log(`nabnak.onSubmit.taskCreate: task '${task.name}' created and added to project '${mod.data.selectedProject.name}'`)
        } else {
          _.logger.log(`nabnak.onSubmit.taskCreate: project or group must be selected`,_.logger.level.warn);return
        }
        
        mod.fn.save()
        mod.fn.render.home()
      }
    },
    setCss: () => {
      // dont want this crowding .load. need to move them in all plugins
      const style = document.createElement('style')
      style.setAttribute('data-id', _.module.nabnak.data.id)
      style.innerText = `
      .nabnak {
        height: inherit;
      }
      .nabnak ul {
        padding: 0;
      }
      .nabnak ul li {
        cursor: pointer;
        list-style-type: none;
        padding-top:10px;
        padding-bottom:10px;
      }
      .nabnak ul li:hover {
        border: 1px solid red;
      }
      .nabnak ul .selected {
        text-decoration: underline;
        font-weight: bold;
      }
      .nabnak .projects-container .not-selected {}
      .nabnak .project-container {}

      .nabnak .home {
        display: grid;
        grid-template-columns: 1fr 8fr;
        height: inherit;
      }
      .nabnak .home .col-0 {
        border-right: 1px solid red;
        overflow-x: hidden;
        height: inherit;
      }
      .nabnak .home .projects-container {
        height: 50%;
      }
      .nabnak .home .groups-container {
        height: 50%;
      }
    
      .nabnak .home .col-1 {
        height: inherit;
      }
      .nabnak .home .col-1 .col1-header-container {}
      .nabnak .home .col-1 .col1-header-container .col1-header {}
      .nabnak .home .col-1 .col1-header-container .col1-header .info-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        overflow: hidden;
      }
      .nabnak .home .col-1 .col1-header-container .col1-header .info-row .row-0 {
        
      }
      .nabnak .home .col-1 .col1-header-container .col1-header .info-row .row-1 {
        
      }
      .nabnak .home .col-1 .col1-header-container .col1-header .info-row .row-2 {
        
      }

      .nabnak .home .project-container {
        height: inherit;
      }
      .nabnak .home .tasks-container {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        height: inherit;
      }
      .nabnak .home .project-container .todo-col {
        border: 1px solid black;
        overflow-y: auto;
      }
      .nabnak .home .project-container .inprogress-col {
        border: 1px solid black;
        overflow-y: auto;
      }
      .nabnak .home .project-container .done-col {
        border: 1px solid black;
        overflow-y: auto;
      }
      .nabnak .home .task {
        border: 1px solid white;
        margin: 6px;
      }
      `
      document.head.append(style)
    },
  },
  // not sure where to put workflows
  // 261002: workflows are dead at the moment but I want to keep this here for a bit. the idea is to trigger a workflow
  // via command(IE 'create project') and follow the instuctions via the cli until the workflow is completed. opted for
  // forms via terminal instead for the time being
  workflow: {
    create: {
      project: () => {},
      task: () => {}
    }
  },
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
      // 261004: dont like the idea of moving the actual task object between .tasks and .groups so just put
      // a super shallow copy in groups instead, if we even implement this thing. still not a fan yet
      groups: [],
      tasks: [],
      tags: [],
      comments: [],
    },
    // changed how 'stories' work last minute. I like task groups better; also makes it fit in more places instead of
    // 'stories'
    // 261006: this thing is definitely missing properties but I dont know what yet
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
      //groupId: null, // need to support groups one of these days
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
      // comments have own path
      comments: [],
      // date required to be completed(Due Date)? I dont need such thing but yeah
      // history is a great one(someday)
      // priority
    }
  },
  form: {
    project: {
      fields: {
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' }, // text field with comma separated unique strings, spaces are squashed
      },
    },
    group: {
      fields: {
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
      }
    },
    task: {
      // ah yeah here we go. we call setup before passing the form to the form control. setup builds any dynamic fields
      // that have requirements like the module being built to build itself(need to work on wording man)
      setup: (fields) => {
        // our own fields are passed here
        const mod = _.module.nabnak
        if (!mod.data.selectedProject) {
          // hmmmm we really want the entire process to blow up if we fail here
          _.logger.log(`nabnak.fn.onsubmit.groupCreate: no selected project`,_.logger.level.error);return
        }
        /*if (!mod.data.selectedProject.groups.length) {
          fields.group.type = 'hidden'
        } else {
          fields.group.options = mod.data.selectedProject.groups.map(x => ({
            id:x.id,
            name:x.name,
            selected: x.id === mod.data.selectedGroup?.id,
          }))
        }*/
        fields.status.options = Object.keys(mod.schema.enum.status)
        fields.priority.options = Object.keys(mod.schema.enum.priority)
      },
      // think we need a 'date when this needs to be completed' field. yeah I actually really like that, we could put
      // on the home page all the tasks that are due soon(and late). ah yeah 'date_due'
      fields: {
        // removed for now but I do like the idea of being able to create a task without an active project
        //projectId: { type: 'hidden' }, // we technically dont need this field in schema since tasks always live in project
        // 261006: disabling group for now. its slightly conflicting with how we associate everything to the selected thing
        //group: { type: 'select', options: [] },
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
        // not using displayName yet, I simply dont care atm
        acceptanceCriteria: { type: 'textarea', displayName: 'Acceptance Criteria' },
        // had to set these options manually due to circular reference(or not yet initialized) error
        //status: { type: 'select', required: true, options: ['todo','inprogress','done'] },
        //priority: { type: 'select', options: ['low','medium','high'] }
        // 261006: finally making these dynamic!
        status: { type: 'select', required: true, options: [] },
        priority: { type: 'select', options: [] }
      }
    }
  },
  data: {
    // this id is for UI elements, not for saved data
    id: `nabnak-${crypto.randomUUID()}`,
    storageKey: 'nabnak-projects',
    parentSelector: null,
    // gets blown away on page refreshes. will need to persist at some point
    selectedProject: null,
    selectedGroup: null,
    selectedTask: null,
    projects: []
  },
}