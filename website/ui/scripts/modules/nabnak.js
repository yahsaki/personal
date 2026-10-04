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
      const project = _.module.nabnak.data.projects.find(x => x.id === id)
      if (!project) {
        _.logger.log(`nabnak.fn.onProjectClick: failed to find project by id '${id}'`,_.logger.level.warn);return
      }
      _.module.nabnak.data.selectedProject = project
      // temp: rerender projects page. supposed to render selected project page
      _.logger.log(`project '${project.name}' selected`)
      _.module.nabnak.fn.render.home()
    },
    // not sold on fn.render pattern yet
    render: {
      home: () => { // home = projects page for the most part
        // 261004: want to start writing more agnostic code, starting with not directly referencing itself everywhere,
        // less things to change on renames and restructures are easier
        const mod = _.module.nabnak
        const parentEl = document.querySelector(mod.data.parentSelector)
        
        const projectsEl = mod.fn.buildHtml.projects()
        const projectEl = mod.fn.buildHtml.project(mod.data.selectedProject)

        _.fn.clear(_.module.nabnak.data.parentSelector)

        const html = document.createElement('div')
        html.setAttribute('class', 'nabnak')
        html.setAttribute('data-id', mod.data.id)
        parentEl.append(html)

        const wrapper = document.createElement('div')
        wrapper.setAttribute('class', 'home')
        wrapper.append(projectsEl)
        wrapper.append(projectEl)
        html.append(wrapper)
      }
    },
    buildHtml: {
      projects: () => {
        const data = _.module.nabnak.data
        const html = document.createElement('div')
        html.setAttribute('class', 'projects-container')
        html.innerHTML = `
        <b>COUNT: ${data.projects.length}</b>
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
      project: (project) => {
        // thinking about it, a different fn should interface with elements returning an index. only private fns
        // should call this fn which should always have the projectId. lets see how this goes
        
        const html = document.createElement('div')
        html.setAttribute('class', 'project-container')
        if (!project) {
          const h1 = document.createElement('h1')
          h1.innerText = `NO PROJECT SELECTED`
          html.append(h1)
          return html  
        }
        const h1 = document.createElement('h1')
        h1.innerText = `Project: ${project.name}\nTask Count: ${project.tasks.length}`
        html.append(h1)
        return html
      },
      // putting this select project pattern on hold for now
      project_args_on_hold: (args) => {
        // can select project(or tasks) by projectId or index
        const projectId = args.projectId
        const index = parseInt(args.index)
        let project
        if (projectId) {
          project = _.module.nabnak.data.projects.find(x => x.id === projectId)
        }
        if (!isNaN(index) && !project) {
          project = _.module.nabnak.data.projects[index]
        }
        // whhhooo I dont like this code
        if (!project) {
          _.logger.log(`failed to find project from one of these arguments: projectId: ${projectId}, index: ${index}`,_.logger.level.warn);return
        }
      }
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
          if (project) {
            mod.data.selectedProject = project
            mod.fn.render.home()
          }
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
            callbackName: 'projectCreate'
          })
        },
        task: (args) => {

        }
      }
    },
    handleInput: (args) => {
      _.logger.log('nabnak.handleInput: unimplemented',_.logger.level.debug,args)
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
      }
    },
    setCss: () => {
      // dont want this crowding .load. need to move them in all plugins
      const style = document.createElement('style')
      style.setAttribute('data-id', _.module.nabnak.data.id)
      style.innerText = `
      .nabnak {}
      .nabnak .projects-container ul li {
        cursor: pointer;
      }
      .nabnak .projects-container .selected {
        text-decoration: underline;
      }
      .nabnak .projects-container .not-selected {}
      .nabnak .project-container {}

      .nabnak .home {
        display: grid;
        grid-template-columns: 1fr 8fr;
      }
      .nabnak .home .projects-container {
        border-right: 1px solid red;
      }
      .nabnak .home .project-container {
      
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
      groups: [],
      tasks: [],
      tags: [],
      comments: [],
    },
    // changed how 'stories' work last minute. I like task groups better; also makes it fit in more places instead of
    // 'stories'
    group: {
      id: null,
      date_created: null,
      date_updated: null,
      name: null,
      description: null,
      acceptanceCriteria: null,
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
    task: {
      fields: {
        projectId: { type: 'hidden' }, // we technically dont need this field in schema since tasks always live in project
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' },
        acceptanceCriteria: { type: 'textarea', displayName: 'Acceptance Criteria' },
        // had to set these values manually due to circular reference(or not yet initialized) error
        status: { type: 'select', required: true, values: ['todo','inprogress','done'] },
        priority: { type: 'select', required: true, values: ['low','medium','high'] }
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
    selectedTask: null,
    projects: []
  },
}