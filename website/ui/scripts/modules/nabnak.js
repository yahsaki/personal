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
    _.module.nabnak.fn.render.projects()
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
        _.logger.log(`nabnak.get: fetched ${projects.length} projects`)
      } else {
        _.logger.log(`nabnak.get: no projects found`)
      }
    },
    onProjectClick: () => {
      _.logger.log('project clicked',_.logger.level.debug)
    },
    // not sold on fn.render pattern yet
    render: {
      projects: () => {
        const data = _.module.nabnak.data
        const parentEl = document.querySelector(data.parentSelector)
        const html = document.createElement('div')
        html.setAttribute('data-id', data.id)
        html.setAttribute('class', 'nabnak-projects-container')
        html.innerHTML = `
        <h1>PROJECT COUNT: ${data.projects.length}</h1>
        <ul>
        ${renderProjectList()}
        </ul>
        `
        parentEl.append(html)

        function renderProjectList() {
          let string = ''
          for (let i = 0; i < data.projects.length; i++) {
            const project = data.projects[i]
            string += `
            <li onclick="_.module.nabnak.fn.onProjectClick()" data-projectId="${project.id}" data-tempId="${i}">
              <b>${i}</b>: ${project.name}
            </li>
            `
          }
          return string
        }
      },
      project: (projectId) => {}
    },
    // sold
    command: {
      help: () => {},
      // delete project data from browser storage
      wipe: () => {},
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
        default: {
          _.logger.log(`nabnak.handleInput: unknown command '${args[0]}'. they are case sensitive at the moment so yeah`,_.logger.level.warn)
        } break
      }
    },
    onSubmit: {
      projectCreate: (args) => {
        _.logger.log('nabnak.fn.onSubmit.projectCreate: project submitted!',_.logger.level.debug, args)
      }
    },
    setCss: () => {
      // dont want this crowding .load. need to move them in all plugins
      const style = document.createElement('style')
      style.setAttribute('data-id', _.module.nabnak.data.id)
      style.innerText = `
      .nabnak-projects-container ul li {
        cursor: pointer;
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
  form: {
    project: {
      fields: {
        name: { type: 'text', required: true },
        description: { type: 'text' },
        tags: { type: 'tags' }, // text field with comma separated unique strings, spaces are squashed
      },
    }
  },
  data: {
    id: `nabnak-${crypto.randomUUID()}`,
    storageKey: 'nabnak-projects',
    parentSelector: null,
    projects: []
  },
}