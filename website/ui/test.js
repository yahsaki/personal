const _ = {
  logger: {
    level: { debug: 'debug', info: 'info', warn: 'warn', error: 'error' },
    log: (text, level, blob) => {
      // I would like to automagically get the fn name and module name
      if (typeof text !== 'string') {
        console.error(`terminal.logger.log: log is not of type string`);return
      }
      if (!text.length) {
        console.error(`terminal.logger.log: log text is empty`);return
      }
      if (!_.logger.level[level]) {
        if (level) {
          // user sent a level value thats not one of the enum values. they probably sent a blob here
          console.log(`caller sent a non enum value in the level argument. the log was probably constructed incorrectly`, level)
        }
        level = _.logger.level.info
      }

      const string = `[${level}]:${text}`
      if (blob) { console.log(string, blob) }
      else { console.log(string) }
    },
  },
}
class NabnakDal {
  #boards = []
  //#boardMap = {} // going to try and live without these maps
  #groups = []
  //#groupMap = {}
  #tasks = []
  //#taskMap = {}
  // how about #tags and #comments? tags would ignore system tags, I would think
  constructor(args) {
    console.log('initialize', this.#schema.board)
  }
  // [de]hydrate dead for now; will save data as is to localstorage
  hydrate(projects) {}
  dehydrate() {}
  helper = {
    checkForTagDupes: (tags = []) => {
      const duplicates = []
      const checkedTags = []
      for (let i = 0; i < tags.length; i++) {
        const duplicate = checkedTags.find(x => x.toLowerCase() === tags[i].toLowerCase())
        if (duplicate) { duplicates.push(duplicate)}
        checkedTags.push(tags[i])
      }
      return duplicates
    }
  }
  validate = {
    board: {
      // essentially complete, I dont see any more changes needed to this
      create: (args) => {
        _.logger.log('validating board create', null, args)
        const errors = []
        const board = args.board
        if (!board) {errors.push('.board property missing');return errors}
        if (!board.name?.length) { errors.push('name required')}
        if (!board.slug?.length) { errors.push('slug required')}
        if (errors.length) { return errors }

        let existing = this.#boards.find(x => x.id === board.name.toLowerCase())
        if (existing) {errors.push(`board with name/id '${board.name.toLowerCase()}' already exists`)}
        existing = this.#boards.find(x => x.slug === board.slug.toUpperCase())
        if (existing) {errors.push(`board with slug '${board.slug.toUpperCase()}' already exists`)}

        if (board.tags?.length) {
          const dupes = this.helper.checkForTagDupes(board.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }

        return errors
      }
    }
  }
  api = {
    board: {
      // this get will be more involved than class get fns
      get: (args) => {
        // I legit have no idea how queries will work yet, simply too soon
      },
      create: (args) => {
        const errors = this.validate.board.create(args)
        if (errors.length) { return {success:false,errors} }
        
        const date = new Date()
        const board = structuredClone(this.#schema.board)
        board.id = args.board.name.toLowerCase()
        board.name = args.board.name
        board.slug = args.board.slug.toUpperCase()
        board.description = args.board.description
        board.date_created = date.toISOString()
        board.date_updated = date.toISOString()

        this.#boards.push(board)
        _.logger.log(`board '${board.name}' created`,null,board)
        return { success:true, data:{id:board.id} }
      },
      update: (args) => {
        // not allowing name/slug(and id of course) updates for now
      },
      delete: (args) => {},
      shift: (args) => {},
      tag: {
        add: (args) => {},
        remove: (args) => {},
      },
      group: {
        add: (args) => {},
        remove: (args) => {},
        shift: (args) => {},
      },
      task: {
        add: (args) => {},
        remove: (args) => {},
        shift: (args) => {},
      },
      comment: {
        add: (args) => {},
        update: (args) => {},
        remove: (args) => {},
      },
    },
    group: {
      get: (args) => {},
      create: (args) => {},
      update: (args) => {},
      delete: (args) => {},
      shift: (args) => {},
      tag: {
        add: (args) => {},
        remove: (args) => {},
      },
      column: {
        add: (args) => {},
        remove: (args) => {},
        shift: (args) => {},
      },
      group: {
        add: (args) => {},
        remove: (args) => {},
        shift: (args) => {},
      },
      task: {
        add: (args) => {},
        remove: (args) => {},
        shift: (args) => {},
      },
      comment: {
        add: (args) => {},
        update: (args) => {},
        remove: (args) => {},
      }
    },
    task: {
      get: (args) => {},
      create: (args) => {},
      update: (args) => {},
      delete: (args) => {},
      shift: (args) => {},
      tag: {
        add: (args) => {},
        remove: (args) => {},
      },
      comment: {
        add: (args) => {},
        update: (args) => {},
        remove: (args) => {},
      }
    }
  }
  #schema = {
    // enums dead, doing everything in my power to not use them this time around
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
    board: {
      id: null,
      slug: null,
      //guidId: null, // removing it until I find a reason to have it
      // increases every time a task is created, no matter what
      autoIncrementId: 0,
      // name and id would most likely be the same. fields are separate in case of
      // collision
      name: null,
      description: null,
      tags: [],
      date_created: null,
      date_updated: null,
      // shallow references to the objects
      groups: [],
      tasks: [],
      // feel more like logs in this context
      comments: [],
    },
    // will not be created by default when a board is created
    group: {
      // im not sure of the value splitting id/guidId here but ill continue
      // the pattern anyway
      id: null,
      name: null,
      //guidId: null,
      //slug: null, // I really dont see how this will work
      parentId: null,
      parentType: null,
      description: null,
      tags: [],
      date_created: null,
      date_updated: null,
      date_due: null, // only applies to certain group types
      date_completed: null, // only applies to certain group types
      groups: [],
      // instead of updating the task, we can save info to the shallow copy for
      // the task to this group
      tasks: [],
      comments: [],
      // instead of setting a status on task, the task will be assigned a 
      // column specified by the group the task is associated with. a group
      // will most likely default with todo,inprogress and done columns
      // how about we shift columns with command like 'mv col <index> <<'
      // meaning move col two spaces to the left
      columns: []
    },
    // cannot be moved between boards
    // not supporting subtasks. if you want to subtask, just group the tasks
    // in a sub group and treat the parent group as the parent task

    // alright, going to attempt to not add parentId to tasks since they can
    // live, or be referenced in multiple places-ish. dal will be responsible
    // for setting this value for the view being called
    task: {
      id: null, // would be something like YAHB-1
      //guidId: null, // seriously no need here
      boardId: null, // definitely keeping this association
      name: null,
      description: null,
      tags: [],
      date_created: null,
      date_updated: null,
      date_due: null,
      date_completed: null,
      comments: [],
    },
    comment: {
      id: null,
      value: null,
      date_created: null,
      date_updated: null,
      // why shouldnt we tag comments? not doing it at the moment. also not sorting
      // them, they should always be create date desc(until I change my mind)
      // tags: [],
    },
  }
}

;(async () => {
  const dal = new NabnakDal()
  const createBoardRes = dal.api.board.create({ board: {
    name: 'yahbsite',
    slug: 'YAHZ',
  }})
  if (!createBoardRes.success) { console.log('create board fail', createBoardRes);return }

})()