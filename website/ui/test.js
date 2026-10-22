class NabnakDal {
  #projects = []
  #projectMap = {}
  #groups = []
  #groupMap = {}
  #tasks = []
  #taskMap = {}
  constructor(args) {
    console.log('initialize', this.#schema.project)
  }
  hydrate(projects) {

  }
  dehydrate() {
    // convert flattened objects back into tree structure
    return []
  }
  api = {
    project: {

    },
    group: {},
    task: {}
  }
  #schema = {
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
      slug: 'slugged'
    }
  }
}

;(async () => {
  const dal = new NabnakDal()
})()