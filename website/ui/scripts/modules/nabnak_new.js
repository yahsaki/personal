// ive been trying to prevent anything being instantiated in the global scope besides _, oh well
class NabnakDal {
  #projects = []
  #projectMap = {}
  #groups = []
  #groupMap = {}
  #tasks = []
  #taskMap = {}
  constructor(args) {}
  hydrate(projects) {

  }
  dehydrate() {
    // convert flattened objects back into tree structure
    return []
  }
  api = {
    project: {},
    group: {},
    task: {}
  }
}
_.module.nabnak = {
  load: (selector) => {
    // I like the idea of being able to load nabnak and renderer in any order so im going to build it that way
    _.logger.log('nabnak loading', parentSelector)

    const module = { name: 'nabnak', displayName: 'nabnak', code: 'NBK', shortcuts: ['n'] }
    if (_.module.terminal) { _.module.terminal.data.module[module.name] = module }

    _.fn.updateTitle('NABNAK')
    _.module.nabnak.dal = new NabnakDal()

    if (_.module.nabnak_render) {
      
    }
  },
  dal: null,
  fn: {

  }
}