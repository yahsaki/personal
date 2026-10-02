// terminal was not designed to ever be unloaded so I originally built it in the infra but this time around im
// going to treat it as a plugin thats never unloaded(it doesnt need to know that)
_.tool.terminal = {
  // going to keep load/unload out of .fn since these are foundational logic that every tool/view shares
  load: (selector) => {
    // I really liked having the html and css split in their own functions. might go back to that, no reason not to
    const parentEl = document.querySelector(selector)
    if (!parentEl) {
      console.error(`terminal.load: failed to find the parent element via selector '${selector}'`);return
    }
    _.tool.terminal.data.parentSelector = selector
    // this will cause a bug if we create terminals on the same tick
    const id = _.tool.terminal.data.id = `${(+new Date())}`
    const html = document.createElement('div')
    html.setAttribute('id', `terminal-html-${id}`)
    html.setAttribute('class', 'terminal-container')
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
    console.log('terminal.load: load complete')
  },
  unload: () => {
    const selector = _.tool.terminal.data.parentSelector
    const id = _.tool.terminal.data.id
    const parentEl = document.querySelector(selector)
    if (!parentEl) {
      console.error(`terminal.unload: failed to find the parent element via selector '${selector}'`)
      // probably refresh browser or something

      // we arent even fetching the children of this parent, no need to escape logic
      //return
    }

    // terminal doesnt have any intervals floating around, but other than that, all the logic for a tool is isolated
    // to itself, or at least it should be
    const html = document.getElementById(`terminal-html-${id}`)
    const style = document.getElementById(`terminal-style-${id}`)
    if (html) { html.remove() }
    if (style) { style.remove() }
    _.tool.terminal.data.parentSelector = null
    _.tool.terminal.data.id = null
    // is that it?
    console.log(`terminal.unload: removed everything probably, good luck verifying that`)
  },
  // hopefully everything here is only what terminal needs to function besides global helpers
  fn: {},
  data: {
    parentSelector: null, // set from caller when .load is called
    id: null, // generated when .load is called
  },
}