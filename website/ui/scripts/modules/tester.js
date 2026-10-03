_.module.tester = {
  load: (selector) => {
    const module = { name: 'tester', displayName: 'tester', code: 'TSR', }
    // I would like a better way to set this but every idea is bad so far, leaving this as is(this is still way better
    // than before)
    if (_.module.terminal) { _.module.terminal.data.module[module.name] = module }

    console.log('tester.load: todo: load css, fetch data, BUILD EVERYTHING')
  },
  unload: () => {},
  fn: {
    cleanup: () => {
      // cleanup is not the same as unload. cleanup is called when the current tool in terminal switches. unload is
      // called when to tool is removed from the website(per say)
      // I guess we should rename it to .onToolUnloaded or something(something else please, terrible name)
      console.log('tester.fn.cleanup: cleanup called')
    }
  },
  data: {}
}