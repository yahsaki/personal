_.tool.textScroller = {
  load: (selector, data) => {
    console.log(`textScroller.load: on load, WIP`)
  },
  unload: () => {},
  fn: {},
  data: {
    // shiza, just realized we cant instantiate more than one terminal tool due to data.parentSelector, need something
    // like this for that to work
    instances: [],
  }
}