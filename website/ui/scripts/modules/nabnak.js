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

    // TODO: move this logic to a global fn
    let title = document.querySelector('title')
    if (title) { title.innerText = 'YAHSAKI | NABNAK' }
    else {
      title = document.createElement('title')
      title.innerText = 'YAHSAKI | NABNAK'
      document.head.append(title)
    }
    // end logic

    const html = document.createElement('div') 
    html.setAttribute('class', 'nabnak-container')
    // wait a min... wtf is the html supposed to even be at this point?
  },
  unload: () => {},
  fn: {
    // not sold on fn.render pattern yet
    render: {
      projects: () => {},
      project: (projectId) => {}
    },
    // sold
    command: {
      help: () => {},
      // delete project data from browser storage
      wipe: () => {},
    }
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
      }
    }
  },
  data: {
    parentSelector: null,
    // damn man I hate always doing data.data but .projects is a child prop of what I need
    data: {
      date_updated: null,
      version: null,
      projects: []
    },
  },
}