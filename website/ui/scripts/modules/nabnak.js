// hmmmm whats the actual difference between a view and a tool in the scope of my project? they are literally the exact
// same thing so far. not going to change anything due to this yet because im sure the difference will highlight itself
// during this build
_.module.nabnak = {
  load: (selector) => {
    const parentEl = document.querySelector(selector)
    if (!parentEl) { throw Error(`nabnak.load: failed to find parent element via selector '${selector}'`) }

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
  },
  unload: () => {},
  fn: {},
  data: {
    parentSelector: null,
    // damn man I hate always doing data.data but .projects is a child prop of what I need
    data: {},
  },
}