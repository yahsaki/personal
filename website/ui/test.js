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
    if (!args) { args = {} }
    console.log('initialize', this.#schema.board)
    if (Object.hasOwn(args, 'debug') && args.debug === true) {
      console.log('debug args', args)
      // currently gating hydrate behind a debug flag
      // THIS WILL LOSE TONS OF DATA AS IS. JUST BLINDLY AND DANGEROUSLY SET THE PRIVATE VARS INSTEAD
      for (const i in args.boards) {
        const res = this.api.board.create({board:args.boards[i]})
        if (!res.success) { throw Error(res.errors) }
      }
      for (const i in args.groups) {
        const res = this.api.group.create({group:args.groups[i],parentType:args.groups[i].parentType})
        if (!res.success) { throw Error(res.errors) }
      }
      for (const i in args.tasks) {
        const res = this.api.task.create({task:args.tasks[i]})
        if (!res.success) { throw Error(res.errors) }
      }
    }
    if (Object.hasOwn(args, 'hydrate') && args.hydrate === true) {
      this.#boards = args.boards
      this.#groups = args.groups
      this.#tasks = args.tasks
      // nabnak state would have to be stored elsewhere, makes no sense in the dal. I dont know
      // how state is working at the moment anyway
    }
  }
  get boards() { return structuredClone(this.#boards) }
  get groups() { return structuredClone(this.#groups) }
  get tasks() { return structuredClone(this.#tasks) }
  get data() {
    return {
      boards: structuredClone(this.#boards),
      groups: structuredClone(this.#groups),
      tasks: structuredClone(this.#tasks),
    }
  }
  // lets see if I can get away with not using this outside of this class
  //get parentType() { return this.#schema.group.parentType }

  // [de]hydrate dead for now; will save data as is to localstorage
  //hydrate(projects) {}
  //dehydrate() {}
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
    },
    valdateTags: (tags = []) => {
      // TODO: will need to actually validate format of tags since the tool is heavily
      // tag driven. tags like 'type--epic' would be invalid due to the one extra dash.
      // duplicate checks will be moved here
    },
    recursivelyUpdateAllParents: (id, type) => {
      let reachedTheTop = false
      const idsHit = []
      while (!reachedTheTop) {
        // groups must have a board as a parent... I hope
        let obj
        const date = new Date()
        if (type === this.#schema.enum.group.parentType.board) {
          if (idsHit.find(x => x === id)) { throw Error(`object '${id}'(${type}) already processed`) }
          obj = this.#boards.find(x => x.id === id)
          if (!obj) { throw Error(`board '${id}' does not exist`) }
          obj.date_updated = date.toISOString()
          idsHit.push(id)
          reachedTheTop = true
        } else if (type === this.#schema.enum.group.parentType.group) {
          if (idsHit.find(x => x === id)) { throw Error(`object '${id}'(${type}) already processed`) }
          obj = this.#groups.find(x => x.id === id)
          if (!obj) { throw Error(`group '${id}' does not exist`) }
          obj.date_updated = date.toISOString()
          idsHit.push(id)
          id = obj.parentId
          type = obj.parentType
        } else {
          throw Error(`type '${type}' not supported`)
        }
      }
      _.logger.log(`${idsHit.join(', ')} updated`)
      return
    },
    // walks a group's parents up to its board and returns the board id. returns null if
    // the chain is broken(unknown parent, cycle, etc)
    boardIdForGroup: (id) => {
      const idsHit = []
      let group = this.#groups.find(x => x.id === id)
      if (!group) { return null }
      while (group.parentType === this.#schema.enum.group.parentType.group) {
        if (idsHit.includes(group.id)) { return null }
        idsHit.push(group.id)
        group = this.#groups.find(x => x.id === group.parentId)
        if (!group) { return null }
      }
      return group.parentId
    },
  }
  validate = {
    board: {
      create: (args) => {
        const errors = []
        const board = args?.board
        if (!board) {errors.push('board property missing');return errors}
        if (!board.name?.length) { errors.push('name required')}
        if (!board.slug?.length) { errors.push('slug required')}
        if (errors.length) { return errors }

        let existing = this.#boards.find(x => x.id === board.name.toLowerCase())
        if (existing) {errors.push(`board with name/id '${board.name.toLowerCase()}' already exists`)}
        existing = this.#boards.find(x => x.slug === board.slug.toUpperCase())
        if (existing) {errors.push(`board with slug '${board.slug.toUpperCase()}' already exists`)}

        if (board.slug.length !== 4) { errors.push('we kinda require slugs to be 4 chars...') }
        if (Array.isArray(board.tags)) {//if (board.tags?.length) {
          const dupes = this.helper.checkForTagDupes(board.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }

        return errors
      },
      update: (args) => {
        const errors = []
        const board = args?.board
        if (!board) {errors.push('board property missing');return errors}
        const existing = this.#boards.find(x => x.id === board.id)
        if (!existing) { errors.push(`board not found by id '${board.id}'`);return errors}

        // not updating name/slug
        if (Array.isArray(board.tags)) {
          const dupes = this.helper.checkForTagDupes(board.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }
        return errors
      },
      shift: (args) => {
        const errors = []
        if (!args.id?.length) { errors.push('arg id required');return errors}

        if (this.#boards.length < 2) {errors.push('need at least 2 items in array to shift')}
        const itemIndex = this.#boards.findIndex(x => x.id === args.id)
        if (itemIndex < 0) { errors.push(`board with id '${args.id}' not found`)}

        if (isNaN(args.location)) { errors.push(`location should be int`) }
        if (args.location === 0) { errors.push(`location should be less than or greater than 0`) }
        
        //const targetIndex = itemIndex + args.location
        // we dont care about overshooting but trying to move the first/last object to the
        // same position is not allowed
        if (args.location < 0) {
          // moving left
          if (itemIndex === 0) {
            errors.push(`attempted to move zeroeth item left`)
          }
        } else {
          // moving right
          if (itemIndex+1 === this.#boards.length) {
            errors.push(`attempted to move the last object right`)
          }
        }
        return errors
      },
      // TODO: prevent delete if orphans will occur
      delete: (args) => {
        const errors = []
        if (!args.id?.length) { errors.push('arg id required');return errors}

        const existing = this.#boards.find(x => x.id === args.id)
        if (!existing) { errors.push(`board with id '${args.id}' not found`)}

        return errors
      },
      task: {
        add: (args) => {
          const errors = []
          if (!args?.boardId?.length) { errors.push('arg boardId required');return errors }
          if (!args?.taskId?.length) { errors.push('arg taskId required');return errors }

          const board = this.#boards.find(x => x.id === args.boardId)
          if (!board) { errors.push(`board with id '${args.boardId}' not found`);return errors }

          const task = this.#tasks.find(x => x.id === args.taskId)
          if (!task) { errors.push(`task with id '${args.taskId}' not found`);return errors }

          // tasks cannot be moved between boards(see schema.task comment)
          if (task.boardId !== board.id) {
            errors.push(`task '${task.id}' belongs to board '${task.boardId}', not '${board.id}'`)
          }
          return errors
        },
        remove: (args) => {
          const errors = []
          if (!args?.boardId?.length) { errors.push('arg boardId required');return errors }
          if (!args?.taskId?.length) { errors.push('arg taskId required');return errors }

          const board = this.#boards.find(x => x.id === args.boardId)
          if (!board) { errors.push(`board with id '${args.boardId}' not found`);return errors }

          if (!this.#tasks.find(x => x.id === args.taskId)) { errors.push(`task with id '${args.taskId}' not found`);return errors }
          if (!board.tasks.find(x => x.id === args.taskId)) {
            errors.push(`failed to find shallow ref for task id '${args.taskId}' in board '${board.id}'`)
          }
          return errors
        },
      },
      group: {
        create: (args) => {
          // I dont believe this is necessary yet
        }
      },
    },
    group: {
      create: (args) => {
        const errors = []
        const group = args?.group
        if (!group) {errors.push('group property missing');return errors}

        if (!group.name?.length) { errors.push('name required') }
        if (~group.name.indexOf('_')) { errors.push('group names cant have underscores. honestly shouldnt have much of any special chars')}
        // TODO: limit group names to just a-zA-Z0-9 and dash? honestly I dont want dashes either

        let existing = this.#groups.find(x => x.id === group.name.toLowerCase())
        if (existing) {errors.push(`group with name/id '${group.name.toLowerCase()}' already exists`)}

        if (Array.isArray(group.tags)) {
          const dupes = this.helper.checkForTagDupes(group.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }

        switch (args?.parentType) {
          case this.#schema.enum.group.parentType.board: {
            const board = this.#boards.find(x => x.id === group.parentId)
            if (!board) { errors.push(`failed to find parent board by id '${group.parentId}'(parentId)`)}
          } break
          case this.#schema.enum.group.parentType.group: {
            const parentGroup = this.#groups.find(x => x.id === group.parentId)
            if (!parentGroup) { errors.push(`failed to find parent group by id '${group.parentId}'(parentId)`)}
          } break
          default: {
            errors.push(`invalid parentType '${args?.parentType}'`)
          } break
        }

        return errors
      },
      update: (args) => {
        const errors = []
        const group = args?.group
        if (!group) { errors.push(`group property missing`);return errors}
        const existing = this.#groups.find(x => x.id === group.id)
        if (!existing) { errors.push(`group not found by id '${group.id}'`);return errors}

        // seriously only tags and description updateable?
        // date_due updateable but im not planning on using that soon
        if (Array.isArray(group.tags)) {
          const dupes = this.helper.checkForTagDupes(group.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }

        // we arent requiring caller to supply parent type. we can get group before validating of course,
        // dont care at the moment
        /*switch (group.parentType) {
          case this.#schema.enum.group.parentType.board: {
            const board = this.#boards.find(x => x.id === group.parentId)
            if (!board) { errors.push(`failed to find parent board by id '${group.parentId}'(parentId)`)}
          } break
          case this.#schema.enum.group.parentType.group: {
            const parentGroup = this.#groups.find(x => x.id === group.parentId)
            if (!parentGroup) { errors.push(`failed to find parent group by id '${parentGroup.parentId}'(parentId)`)}
            // TODO: should probably validate all parents up the chain
          } break
          default: {
            errors.push(`invalid parentType '${group.parentType}'`)
          } break
        }*/

        return errors
      },
      shift: (args) => {
        const errors = []
        if (!args.id?.length) { errors.push('arg id required');return errors}

        if (isNaN(args.location)) { errors.push(`location should be int`) }
        if (args.location === 0) { errors.push(`location should be less than or greater than 0`) }

        const group = this.#groups.find(x => x.id === args.id)
        if (!group) { errors.push(`group '${args.id}' not found`)}

        if (errors.length) { return errors }

        let indexedGroupIndex, parent
        if (group.parentType === this.#schema.enum.group.parentType.board) {
          parent = this.#boards.find(x => x.id === group.parentId)
          if (!parent) { errors.push(`board '${group.parentId}' not found`);return errors }
          if (parent.groups.length < 2) { errors.push(`board '${parent.id}' requires at least 2 groups to shift`) }
          indexedGroupIndex = parent.groups.findIndex(x => x.id === group.id)
          if (indexedGroupIndex < 0) { errors.push(`group '${group.id}' exists in global array but missing in board '${parent.id}', shits broke`)}
        } else if (group.parentType === this.#schema.enum.group.parentType.group) {
          parent = this.#groups.find(x => x.id === group.parentId)
          if (!parent) { errors.push(`group '${group.parentId}' not found`);return errors }
          if (parent.groups.length < 2) { errors.push(`group '${parent.id}' requires at least 2 groups to shift`) }
          indexedGroupIndex = parent.groups.findIndex(x => x.id === group.id)
          if (indexedGroupIndex < 0) { errors.push(`group '${group.id}' exists in global array but missing in group '${parent.id}', shits broke`)}
        } else {
          errors.push(`unknown parentType '${group.parentType}'`);return errors
        }

        if (args.location < 0) {
          // moving left
          if (indexedGroupIndex === 0) {
            errors.push(`attempted to move zeroeth item left`)
          }
        } else {
          // moving right
          if (indexedGroupIndex+1 === parent.groups.length) {
            errors.push(`attempted to move the last object right`)
          }
        }

        return errors
      },
      delete: (args) => {
        const errors = []
        if (!args.id?.length) { errors.push('arg id required');return errors}

        const group = this.#groups.find(x => x.id === args.id)
        if (!group) { errors.push(`board with id '${args.id}' not found`);return errors}

        if (group.parentType === this.#schema.enum.group.parentType.board) {
          const parent = this.#boards.find(x => x.id === group.parentId)
          if (!parent) { errors.push(`board '${group.parentId}' not found`);return errors }
          if (!parent.groups.find(x => x.id === group.id)) { errors.push(`failed to find shallow ref for group id '${group.id}'`) }
        } else if (group.parentType === this.#schema.enum.group.parentType.group) {
          const parent = this.#groups.find(x => x.id === group.parentId)
          if (!parent) { errors.push(`group '${group.parentId}' not found`);return errors }
          if (!parent.groups.find(x => x.id === group.id)) { errors.push(`failed to find shallow ref for group id '${group.id}'`) }
        } else {
          errors.push(`unknown parentType '${group.parentType}'`);return errors
        }

        return errors
      },
      task: {
        add: (args) => {
          const errors = []
          if (!args?.groupId?.length) { errors.push('arg groupId required');return errors }
          if (!args?.taskId?.length) { errors.push('arg taskId required');return errors }

          const group = this.#groups.find(x => x.id === args.groupId)
          if (!group) { errors.push(`group with id '${args.groupId}' not found`);return errors }

          const task = this.#tasks.find(x => x.id === args.taskId)
          if (!task) { errors.push(`task with id '${args.taskId}' not found`);return errors }

          // the group has to live on the same board as the task
          const groupBoardId = this.helper.boardIdForGroup(group.id)
          if (!groupBoardId) {
            errors.push(`failed to resolve board for group '${group.id}'`)
          } else if (groupBoardId !== task.boardId) {
            errors.push(`group '${group.id}' belongs to board '${groupBoardId}', not '${task.boardId}'`)
          }

          const column = args.column ?? 'todo'
          if (!group.columns.find(x => x.name === column)) {
            errors.push(`column '${column}' not found in group '${group.id}'`)
          }

          if (group.tasks.find(x => x.id === task.id)) {
            errors.push(`task '${task.id}' already belongs to group '${group.id}'`)
          }

          return errors
        },
        remove: (args) => {
          const errors = []
          if (!args?.groupId?.length) { errors.push('arg groupId required');return errors }
          if (!args?.taskId?.length) { errors.push('arg taskId required');return errors }

          const group = this.#groups.find(x => x.id === args.groupId)
          if (!group) { errors.push(`group with id '${args.groupId}' not found`);return errors }
          if (!this.#tasks.find(x => x.id === args.taskId)) { errors.push(`task with id '${args.taskId}' not found`);return errors }
          if (!group.tasks.find(x => x.id === args.taskId)) {
            errors.push(`failed to find shallow ref for task id '${args.taskId}' in group '${group.id}'`)
          }
          return errors
        },
        shift: (args) => {
          const errors = []
          if (!args?.groupId?.length) { errors.push('arg groupId required');return errors }
          if (!args?.taskId?.length) { errors.push('arg taskId required');return errors }

          if (isNaN(args.location)) { errors.push(`location should be int`) }
          if (args.location === 0) { errors.push(`location should be less than or greater than 0`) }

          const group = this.#groups.find(x => x.id === args.groupId)
          if (!group) { errors.push(`group with id '${args.groupId}' not found`);return errors }
          const task = this.#tasks.find(x => x.id === args.taskId)
          if (!task) { errors.push(`task with id '${args.taskId}' not found`);return errors }
          if (!group.tasks.find(x => x.id === task.id)) { errors.push(`task '${task.id}' doesnt belong to group '${group.id}'`);return errors }

          if (errors.length) { return errors }

          // tasks are ordered inside the column they currently sit in
          const column = group.columns.find(c => c.items.find(x => x.id === task.id))
          if (!column) { errors.push(`failed to find column for task '${task.id}' in group '${group.id}', shits broke`);return errors }

          if (column.items.length < 2) { errors.push(`column '${column.name}' requires at least 2 tasks to shift`) }
          const itemIndex = column.items.findIndex(x => x.id === task.id)

          if (args.location < 0) {
            // moving left
            if (itemIndex === 0) {
              errors.push(`attempted to move zeroeth item left`)
            }
          } else {
            // moving right
            if (itemIndex+1 === column.items.length) {
              errors.push(`attempted to move the last object right`)
            }
          }

          return errors
        },
      },
    },
    task: {
      create: (args) => {
        const errors = []
        const task = args?.task
        if (!task) { errors.push('task property missing');return errors }

        if (!task.name?.length) { errors.push('name required') }
        // tasks cannot be moved between boards, so the board must exist up front
        if (!task.boardId?.length) { errors.push('boardId required') }
        if (errors.length) { return errors }

        const board = this.#boards.find(x => x.id === task.boardId)
        if (!board) { errors.push(`board with id '${task.boardId}' not found`);return errors }

        // optional placement at creation time, 'column' defaults to 'todo'
        if (task.groupId?.length) {
          const group = this.#groups.find(x => x.id === task.groupId)
          if (!group) {
            errors.push(`group with id '${task.groupId}' not found`)
          } else {
            const groupBoardId = this.helper.boardIdForGroup(group.id)
            if (!groupBoardId) {
              errors.push(`failed to resolve board for group '${group.id}'`)
            } else if (groupBoardId !== task.boardId) {
              errors.push(`group '${group.id}' belongs to board '${groupBoardId}', not '${task.boardId}'`)
            }
            const column = task.column ?? 'todo'
            if (!group.columns.find(x => x.name === column)) {
              errors.push(`column '${column}' not found in group '${group.id}'`)
            }
          }
        }

        // ids are generated from the board but the caller is allowed to supply one
        // (hydrate/debug), in which case it still has to be unique
        if (task.id?.length && this.#tasks.find(x => x.id === task.id)) {
          errors.push(`task with id '${task.id}' already exists`)
        }

        if (Array.isArray(task.tags)) {
          const dupes = this.helper.checkForTagDupes(task.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }

        if (task.date_due != null && isNaN(new Date(task.date_due).getTime())) {
          errors.push(`invalid date_due '${task.date_due}'`)
        }
        if (task.date_completed != null && isNaN(new Date(task.date_completed).getTime())) {
          errors.push(`invalid date_completed '${task.date_completed}'`)
        }

        return errors
      },
      update: (args) => {
        const errors = []
        const task = args?.task
        if (!task) {errors.push('task property missing');return errors}
        const existing = this.#tasks.find(x => x.id === task.id)
        if (!existing) { errors.push(`task not found by id '${task.id}'`);return errors}

        // boardId is immutable once created(see schema.task comment)
        if (task.boardId?.length && task.boardId !== existing.boardId) {
          errors.push(`task '${task.id}' cannot be moved between boards ('${existing.boardId}' => '${task.boardId}')`)
        }

        if (task.name != null && !task.name.length) { errors.push('name required') }

        if (Array.isArray(task.tags)) {
          const dupes = this.helper.checkForTagDupes(task.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }

        if (Object.hasOwn(task, 'date_due') && task.date_due != null && isNaN(new Date(task.date_due).getTime())) {
          errors.push(`invalid date_due '${task.date_due}'`)
        }
        if (Object.hasOwn(task, 'date_completed') && task.date_completed != null && isNaN(new Date(task.date_completed).getTime())) {
          errors.push(`invalid date_completed '${task.date_completed}'`)
        }

        return errors
      },
      shift: (args) => {
        const errors = []
        if (!args.id?.length) { errors.push('arg id required');return errors}

        if (isNaN(args.location)) { errors.push(`location should be int`) }
        if (args.location === 0) { errors.push(`location should be less than or greater than 0`) }

        const task = this.#tasks.find(x => x.id === args.id)
        if (!task) { errors.push(`task with id '${args.id}' not found`) }

        if (errors.length) { return errors }

        // tasks are ordered inside their board's task list(see schema.board.tasks)
        const board = this.#boards.find(x => x.id === task.boardId)
        if (!board) { errors.push(`board '${task.boardId}' not found`);return errors }

        if (board.tasks.length < 2) { errors.push(`board '${board.id}' requires at least 2 tasks to shift`) }
        const itemIndex = board.tasks.findIndex(x => x.id === task.id)
        if (itemIndex < 0) { errors.push(`task '${task.id}' exists in global array but missing in board '${board.id}', shits broke`) }

        if (args.location < 0) {
          // moving left
          if (itemIndex === 0) {
            errors.push(`attempted to move zeroeth item left`)
          }
        } else {
          // moving right
          if (itemIndex+1 === board.tasks.length) {
            errors.push(`attempted to move the last object right`)
          }
        }

        return errors
      },
      delete: (args) => {
        const errors = []
        if (!args.id?.length) { errors.push('arg id required');return errors}

        const task = this.#tasks.find(x => x.id === args.id)
        if (!task) { errors.push(`task with id '${args.id}' not found`);return errors }

        // we are not requiring a shallow ref in board.tasks here since board.task.remove
        // can legitimately unlink a task from the board view
        return errors
      },
    }
  }
  api = {
    board: {
      // this get will be more involved than class get fns
      get: (args) => {
        // I legit have no idea how queries will work yet, simply too soon
        if (args?.id) {
          const board = this.#boards.find(x => x.id === args.id)
          if (board) { return {board:structuredClone(board)} }
          else return {}
        }
        return {boards:structuredClone(this.#boards)}
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
        if (Array.isArray(args.board.tags)) {
          board.tags = args.board.tags
        }

        this.#boards.push(board)
        _.logger.log(`board '${board.name}' created`,null,board)
        return { success:true, data:{id:board.id} }
      },
      update: (args) => {
        // not allowing name/slug(and id of course) updates for now
        // I wanted this to be RFC 6902 compliant but leaving it as 'everything goes' for now
        const errors = this.validate.board.update(args)
        if (errors.length) { return {success:false,errors} }

        const board = this.#boards.find(x => x.id === args.board.id)
        board.description = args.board.description
        board.tags = args.board.tags
        board.date_updated = new Date().toISOString()

        _.logger.log(`board '${board.name}' updated`)
        return {success:true}
      },
      delete: (args) => {
        const errors = this.validate.board.delete(args)
        if (errors.length) { return {success:false,errors} }

        const index = this.#boards.findIndex(x => x.id === args.id)
        const deletedBoard = this.#boards.splice(index, 1)[0]

        _.logger.log(`board '${deletedBoard.name}' deleted`)
        return {success:true}
      },
      shift: (args) => {
        const errors = this.validate.board.shift(args)
        if (errors.length) { return {success:false,errors} }

        const itemIndex = this.#boards.findIndex(x => x.id === args.id)
        const targetIndex = itemIndex + args.location
        const item = this.#boards.splice(itemIndex, 1)[0]
        this.#boards.splice(targetIndex, 0, item)

        item.date_updated = new Date().toISOString()
        _.logger.log(`successfully shifted board ${args.location < 0 ? 'left' : 'right'}`)
        return {success:true}
      },
      tag: {
        add: (args) => { /* needs implementation */ },
        remove: (args) => { /* needs implementation */ },
      },
      group: {
        // in order to prevent sending 'parentType' enum to callers, callers will execute
        // 'board.group.create()' instead of 'group.create()' to associate the group to
        // the board, and 'group.group.create()' to associate the group to another group
        create: (args) => {
          if (!args) { args = {} }
          args.parentType = this.#schema.enum.group.parentType.board
          return this.api.group.create(args)
        },
        remove: (args) => { /* needs implementation */ },
        shift: (args) => { /* needs implementation */ },
      },
      task: {
        // a task always belongs to exactly one board(boardId is immutable), so all
        // board.tasks holds is the ordering ref for the board view
        add: (args) => {
          const errors = this.validate.board.task.add(args)
          if (errors.length) { return {success:false,errors} }

          const board = this.#boards.find(x => x.id === args.boardId)
          if (!board.tasks.find(x => x.id === args.taskId)) {
            board.tasks.push({id:args.taskId})
          }

          board.date_updated = new Date().toISOString()
          _.logger.log(`task '${args.taskId}' added to board '${board.id}'`)
          return {success:true}
        },
        remove: (args) => {
          const errors = this.validate.board.task.remove(args)
          if (errors.length) { return {success:false,errors} }

          const board = this.#boards.find(x => x.id === args.boardId)
          const refIndex = board.tasks.findIndex(x => x.id === args.taskId)
          board.tasks.splice(refIndex, 1)[0]

          board.date_updated = new Date().toISOString()
          _.logger.log(`task '${args.taskId}' removed from board '${board.id}'`)
          return {success:true}
        },
        shift: (args) => {
          // ordering a board's tasks is exactly api.task.shift
          return this.api.task.shift({id:args.taskId, location:args.location})
        },
      },
      comment: {
        add: (args) => { /* needs implementation */ },
        update: (args) => { /* needs implementation */ },
        remove: (args) => { /* needs implementation */ },
      },
    },
    group: {
      get: (args) => {
        if (args?.id) {
          const group = this.#groups.find(x => x.id === args.id)
          if (group) { return {group:structuredClone(group)} }
          else return {}
        }
        return {groups:structuredClone(this.#groups)}
      },
      create: (args) => {
        const errors = this.validate.group.create(args)
        if (errors.length) { return {success:false,errors} }

        const date = new Date()
        const group = structuredClone(this.#schema.group)
        group.id = args.group.name
        group.name = args.group.name
        group.parentId = args.group.parentId
        group.parentType = args.parentType
        group.description = args.group.description
        if (Array.isArray(args.group.tags)) {
          group.tags = args.group.tags
        }
        group.date_created = date.toISOString()
        group.date_updated = date.toISOString()

        // we have no safeguards from accidentally pushing a group to the board array and
        // vice versa. mp2g is nice in that class inheritance covers this fully
        this.#groups.push(group)

        // currently the only reason we are adding a shallow ref to .groups prop is for positioning
        if (group.parentType === this.#schema.enum.group.parentType.board) {
          const parent = this.#boards.find(x => x.id === group.parentId)
          parent.groups.push({id:group.id})
        } else if (group.parentType === this.#schema.enum.group.parentType.group) {
          const parent = this.#groups.find(x => x.id === group.parentId)
          parent.groups.push({id:group.id})
        }
        this.helper.recursivelyUpdateAllParents(group.parentId, group.parentType)
        _.logger.log(`group '${group.name}' created`,null,group)
        return {success:true,data:{id:group.id}}
      },
      update: (args) => {
        const errors = this.validate.group.update(args)
        if (errors.length) { return {success:false,errors}}

        const group = this.#groups.find(x => x.id === args.group.id)
        group.description = args.group.description
        if (Array.isArray(args.group.tags)) {
          group.tags = args.group.tags
        }
        
        group.date_updated = new Date().toISOString()
        this.helper.recursivelyUpdateAllParents(group.parentId, group.parentType)
        _.logger.log(`group '${group.name}' updated`,null,group)
        return {success:true}
      },
      delete: (args) => {
        const errors = this.validate.group.delete(args)
        if (errors.length) { return {success:false,errors} }

        const index = this.#groups.findIndex(x => x.id === args.id)
        const deletedGroup = this.#groups.splice(index, 1)[0]

        // I know I had ideas of groups/tasks having references in other locations. doesnt work that way
        // atm but keep note
        if (deletedGroup.parentType === this.#schema.enum.group.parentType.board) {
          const parent = this.#boards.find(x => x.id === deletedGroup.parentId)
          const shallowRefIndex = parent.groups.findIndex(x => x.id === args.id)
          parent.groups.splice(shallowRefIndex, 1)[0]
        } else if (deletedGroup.parentType === this.#schema.enum.group.parentType.group) {
          const parent = this.#groups.find(x => x.id === deletedGroup.parentId)
          const shallowRefIndex = parent.groups.findIndex(x => x.id === args.id)
          parent.groups.splice(shallowRefIndex, 1)[0]
        }

        this.helper.recursivelyUpdateAllParents(deletedGroup.parentId, deletedGroup.parentType)
        _.logger.log(`group '${deletedGroup.name}' deleted`)
        return {success:true}
      },
      shift: (args) => {
        const errors = this.validate.group.shift(args)
        if (errors.length) { return {success:false,errors}}

        const group = this.#groups.find(x => x.id === args.id)
        let itemIndex, parent
        if (group.parentType === this.#schema.enum.group.parentType.board) {
          parent = this.#boards.find(x => x.id === group.parentId)
          itemIndex = parent.groups.findIndex(x => x.id === args.id)
        } else if (group.parentType === this.#schema.enum.group.parentType.group) {
          parent = this.#groups.find(x => x.id === group.parentId)
          itemIndex = parent.groups.findIndex(x => x.id === args.id)
        }
        const targetIndex = itemIndex + args.location
        const item = parent.groups.splice(itemIndex, 1)[0]
        parent.groups.splice(targetIndex, 0, item)
        
        group.date_updated = new Date().toISOString()
        this.helper.recursivelyUpdateAllParents(group.parentId, group.parentType)
        _.logger.log(`group '${group.name}' updated(shifted)`,null,group)

        return {success:true}
      },
      tag: {
        add: (args) => { /* needs implementation */ },
        remove: (args) => { /* needs implementation */ },
      },
      column: {
        add: (args) => { /* needs implementation */ },
        remove: (args) => { /* needs implementation */ },
        shift: (args) => { /* needs implementation */ },
      },
      group: {
        create: (args) => {
          if (!args) { args = {} }
          args.parentType = this.#schema.enum.group.parentType.group
          return this.api.group.create(args)
        },
        remove: (args) => { /* needs implementation */ },
        shift: (args) => { /* needs implementation */ },
      },
      task: {
        // tasks can be referenced in several groups/columns(schema comment on task), we
        // only ever manage this group's refs. 'column' defaults to 'todo'.
        add: (args) => {
          const errors = this.validate.group.task.add(args)
          if (errors.length) { return {success:false,errors} }

          const group = this.#groups.find(x => x.id === args.groupId)
          const task = this.#tasks.find(x => x.id === args.taskId)
          const column = group.columns.find(x => x.name === (args.column ?? 'todo'))

          group.tasks.push({id:task.id})
          column.items.push({id:task.id})

          task.date_updated = new Date().toISOString()
          this.helper.recursivelyUpdateAllParents(group.id, this.#schema.enum.group.parentType.group)
          _.logger.log(`task '${task.name}' added to group '${group.name}'(${column.name})`)
          return {success:true}
        },
        remove: (args) => {
          const errors = this.validate.group.task.remove(args)
          if (errors.length) { return {success:false,errors} }

          const group = this.#groups.find(x => x.id === args.groupId)
          const task = this.#tasks.find(x => x.id === args.taskId)

          const refIndex = group.tasks.findIndex(x => x.id === task.id)
          if (refIndex >= 0) { group.tasks.splice(refIndex, 1) }
          // the task only sits in one column, but we dont know(or care) which one
          for (const column of group.columns) {
            const itemIndex = column.items.findIndex(x => x.id === task.id)
            if (itemIndex >= 0) { column.items.splice(itemIndex, 1) }
          }

          task.date_updated = new Date().toISOString()
          this.helper.recursivelyUpdateAllParents(group.id, this.#schema.enum.group.parentType.group)
          _.logger.log(`task '${task.name}' removed from group '${group.name}'`)
          return {success:true}
        },
        shift: (args) => {
          const errors = this.validate.group.task.shift(args)
          if (errors.length) { return {success:false,errors} }

          const group = this.#groups.find(x => x.id === args.groupId)
          const task = this.#tasks.find(x => x.id === args.taskId)
          const column = group.columns.find(c => c.items.find(x => x.id === task.id))
          const itemIndex = column.items.findIndex(x => x.id === task.id)
          // we dont care about overshooting, splice clamps to the start/end of the array
          const targetIndex = itemIndex + args.location
          const item = column.items.splice(itemIndex, 1)[0]
          column.items.splice(targetIndex, 0, item)

          task.date_updated = new Date().toISOString()
          this.helper.recursivelyUpdateAllParents(group.id, this.#schema.enum.group.parentType.group)
          _.logger.log(`successfully shifted task '${task.name}' in group '${group.name}'(${column.name}) ${args.location < 0 ? 'left' : 'right'}`)
          return {success:true}
        },
      },
      comment: {
        add: (args) => { /* needs implementation */ },
        update: (args) => { /* needs implementation */ },
        remove: (args) => { /* needs implementation */ },
      }
    },
    task: {
      // queries are still up in the air(see board.get) so this is just a straight read
      get: (args) => {
        if (args?.id) {
          const task = this.#tasks.find(x => x.id === args.id)
          if (task) { return {task:structuredClone(task)} }
          else return {}
        }
        return {tasks:structuredClone(this.#tasks)}
      },
      create: (args) => {
        const errors = this.validate.task.create(args)
        if (errors.length) { return {success:false,errors} }

        const date = new Date()
        const board = this.#boards.find(x => x.id === args.task.boardId)
        const task = structuredClone(this.#schema.task)
        // autoIncrementId increases every time a task is created, no matter what, so
        // ids stay unique even if a caller supplies an id of their own
        board.autoIncrementId += 1
        // ids look like '<board slug>-<autoIncrementId>', ex 'YAHZ-1'
        task.id = args.task.id?.length ? args.task.id : `${board.slug}-${board.autoIncrementId}`
        task.boardId = board.id
        task.name = args.task.name
        task.description = args.task.description
        if (Array.isArray(args.task.tags)) {
          task.tags = args.task.tags
        }
        if (args.task.metadata) {
          task.metadata = args.task.metadata
        }
        task.date_due = args.task.date_due ?? null
        task.date_completed = args.task.date_completed ?? null
        task.date_created = date.toISOString()
        task.date_updated = date.toISOString()

        this.#tasks.push(task)

        // currently the only reason we are adding a shallow ref to .tasks prop is for positioning
        board.tasks.push({id:task.id})

        // optional placement into a group/column(validated above), same refs
        // group.task.add would create so a caller can create + place in one call
        if (args.task.groupId?.length) {
          const group = this.#groups.find(x => x.id === args.task.groupId)
          const column = group.columns.find(x => x.name === (args.task.column ?? 'todo'))
          group.tasks.push({id:task.id})
          column.items.push({id:task.id})
          this.helper.recursivelyUpdateAllParents(group.id, this.#schema.enum.group.parentType.group)
        }

        this.helper.recursivelyUpdateAllParents(board.id, this.#schema.enum.group.parentType.board)
        _.logger.log(`task '${task.name}' created`,null,task)
        return {success:true,data:{id:task.id}}
      },
      update: (args) => {
        const errors = this.validate.task.update(args)
        if (errors.length) { return {success:false,errors} }

        const task = this.#tasks.find(x => x.id === args.task.id)
        if (args.task.name?.length) { task.name = args.task.name }
        if (Object.hasOwn(args.task, 'description')) { task.description = args.task.description }
        if (Array.isArray(args.task.tags)) {
          task.tags = args.task.tags
        }
        if (Object.hasOwn(args.task, 'date_due')) { task.date_due = args.task.date_due }
        if (Object.hasOwn(args.task, 'date_completed')) { task.date_completed = args.task.date_completed }
        if (Object.hasOwn(args.task, 'metadata')) { task.metadata = args.task.metadata }

        task.date_updated = new Date().toISOString()
        this.helper.recursivelyUpdateAllParents(task.boardId, this.#schema.enum.group.parentType.board)
        _.logger.log(`task '${task.name}' updated`,null,task)
        return {success:true}
      },
      delete: (args) => {
        const errors = this.validate.task.delete(args)
        if (errors.length) { return {success:false,errors} }

        const index = this.#tasks.findIndex(x => x.id === args.id)
        const deletedTask = this.#tasks.splice(index, 1)[0]

        // remove our own shallow ref from the board
        const board = this.#boards.find(x => x.id === deletedTask.boardId)
        if (board) {
          const shallowRefIndex = board.tasks.findIndex(x => x.id === deletedTask.id)
          if (shallowRefIndex >= 0) { board.tasks.splice(shallowRefIndex, 1) }
        }

        // tasks can be referenced in multiple places(schema.group.tasks and group.columns),
        // nothing writes those refs yet but clean them up so we cant orphan anything
        for (const group of this.#groups) {
          const groupRefIndex = group.tasks.findIndex(x => x.id === deletedTask.id)
          if (groupRefIndex >= 0) { group.tasks.splice(groupRefIndex, 1) }
          for (const column of group.columns) {
            const itemRefIndex = column.items.findIndex(x => x.id === deletedTask.id)
            if (itemRefIndex >= 0) { column.items.splice(itemRefIndex, 1) }
          }
        }

        this.helper.recursivelyUpdateAllParents(deletedTask.boardId, this.#schema.enum.group.parentType.board)
        _.logger.log(`task '${deletedTask.name}' deleted`)
        return {success:true}
      },
      shift: (args) => {
        const errors = this.validate.task.shift(args)
        if (errors.length) { return {success:false,errors} }

        const task = this.#tasks.find(x => x.id === args.id)
        const board = this.#boards.find(x => x.id === task.boardId)
        const itemIndex = board.tasks.findIndex(x => x.id === args.id)
        // we dont care about overshooting, splice clamps to the start/end of the array
        const targetIndex = itemIndex + args.location
        const item = board.tasks.splice(itemIndex, 1)[0]
        board.tasks.splice(targetIndex, 0, item)

        task.date_updated = new Date().toISOString()
        this.helper.recursivelyUpdateAllParents(task.boardId, this.#schema.enum.group.parentType.board)
        _.logger.log(`successfully shifted task '${task.name}' ${args.location < 0 ? 'left' : 'right'}`)
        return {success:true}
      },
      tag: {
        add: (args) => { /* needs implementation */ },
        remove: (args) => { /* needs implementation */ },
      },
      comment: {
        add: (args) => { /* needs implementation */ },
        update: (args) => { /* needs implementation */ },
        remove: (args) => { /* needs implementation */ },
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
      },
      // crap im adding one but its valid: not used for UI rendering
      group: {
        parentType: {
          board: 'board',
          group: 'group',
        }
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
      metadata: {},
    },
    // will not be created by default when a board is created
    group: {
      // keeping same pattern as board for id/name
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
      // only applies to certain group types. I wanted to make these tags but date tags 
      // seem funky, more like tags that are driven by data values that can change by
      // accident seems... funky. IE, doing 'type-bug' seems... cleaner than doing
      // 'field-date_due-270101'. putting that in a metadata prop is much more proper.
      date_due: null,
      // only applies to certain group types
      date_completed: null,
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
      // 261023: decided to keep columns in this structure at this level. will have to
      // maintain a shallow copy of object here and in the group/tasks
      columns: [
        {name:'todo',items:[]},
        {name:'inprogress',items:[]},
        {name:'done',items:[]},
      ],
      metadata: {},
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
      // for now im putting repro steps and acceptance criteria in description
      description: null,
      tags: [],
      date_created: null,
      date_updated: null,
      date_due: null,
      date_completed: null,
      comments: [],
      metadata: {},
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
  testDalClass()
  //testShifting()
  //recursivelyUpdateObjects()
})()

function testDalClass() {
  const dal = new NabnakDal()
  const createBoardRes = dal.api.board.create({ board: {
    name: 'yahbsite',
    slug: 'YAHZ',
  }})
  if (!createBoardRes.success) { console.log('create board fail', createBoardRes);return }
  console.log('data', dal.data)
  const getAllBoardsRes = dal.api.board.get()
  console.log('all boards', getAllBoardsRes)
  const getBoardRes = dal.api.board.get({id:createBoardRes.data.id})
  console.log('get board res', getBoardRes)

  const updateBoardRes = dal.api.board.update({ board: {
      ...getBoardRes.board,
      description: 'updated description',
      // prev nabnak sent a string at this point. we could prolly send .tagString instead
      // to be completely clear
      tags: ['tag0','butt'],
    }
  })
  if (!updateBoardRes.success) { console.log('failed to update board',updateBoardRes);return }

  console.log('board after update', dal.api.board.get({id:createBoardRes.data.id}))

  //const createGroupForBoardRes = dal.api.group.create

  const createDeleteBoardRes = dal.api.board.create({ board: {
    name: 'deleteMe',
    slug: 'DLME',
  }})
  if (!createDeleteBoardRes.success) { console.log('failed to create project for delete',createDeleteBoardRes);return }

  const shiftDeleteBoardRes = dal.api.board.shift({
    id: createDeleteBoardRes.data.id,
    location: -1,
  })
  if (!shiftDeleteBoardRes.success) { console.log('failed to shift delete board', shiftDeleteBoardRes);return }

  console.log('boards after shifting', dal.api.board.get())

  const deleteBoardRes = dal.api.board.delete({id: createDeleteBoardRes.data.id})
  if (!deleteBoardRes.success) { console.log('failed to delete board', deleteBoardRes);return}

  console.log('boards after delete', dal.api.board.get())

  // groups
  const createGroupForBoardRes = dal.api.board.group.create({ group: {
    name: 'nabnak',
    parentId: createBoardRes.data.id,
  }})
  if (!createGroupForBoardRes.success) {console.log('failed to create group for board',createGroupForBoardRes);return}

  const updateGroupForBoardRes = dal.api.group.update({ group : {
    id: 'nabnak',
    description: 'description updated'
  }})
  if (!updateGroupForBoardRes.success) { console.log(`failed to update board group '${createGroupForBoardRes.data.id}'`, updateGroupForBoardRes.errors);return}
  console.log('updated group', dal.data.groups.find(x => x.id === createGroupForBoardRes.data.id))
  console.log('board', JSON.stringify(dal.data,' ',2))

  const createGroupForShiftAndDeleteRes = dal.api.board.group.create({ group: {
    name: 'group-delete',
    parentId: createBoardRes.data.id,
  }})
  if (!createGroupForShiftAndDeleteRes.success) {console.log('failed to create shift/delete group for board',createGroupForShiftAndDeleteRes);return}

  const shiftGroupForShiftAndDeleteRes = dal.api.group.shift({
    id: createGroupForShiftAndDeleteRes.data.id,
    location: -1,
  })
  if (!shiftGroupForShiftAndDeleteRes.success) { console.log('failed to shift delete group',shiftGroupForShiftAndDeleteRes);return}
  console.log('data after shift', JSON.stringify(dal.data,' ',2))
  // need to shift groups in groups on top of groups in a board

  const deleteGroupRes = dal.api.group.delete({ id: createGroupForShiftAndDeleteRes.data.id, })
  if (!deleteGroupRes.success) { console.log('failed to delete group', deleteGroupRes);return}
  console.log(`board after delete, '${createGroupForShiftAndDeleteRes.data.id}' should be gone fully`, JSON.stringify(dal.data,' ',2))

  
  // tasks
  const createTaskRes = dal.api.task.create({ task: {
    boardId: createBoardRes.data.id,
    name: 'first task',
    description: 'task description',
  }})
  if (!createTaskRes.success) { console.log('failed to create task', createTaskRes.errors);return }
  console.log('created task id(expecting YAHZ-1)', createTaskRes.data.id)

  const getTaskRes = dal.api.task.get({id: createTaskRes.data.id})
  if (!getTaskRes.task) { console.log(`failed to get task '${createTaskRes.data.id}'`);return }
  console.log('got task', getTaskRes)
  console.log('all tasks', dal.api.task.get())

  const updateTaskRes = dal.api.task.update({ task: {
    ...getTaskRes.task,
    name: 'first task updated',
    description: 'task description updated',
    tags: ['tag0','tag1'],
  }})
  if (!updateTaskRes.success) { console.log('failed to update task', updateTaskRes.errors);return }
  console.log('task after update', dal.api.task.get({id:createTaskRes.data.id}))
  console.log('board date_updated should have bumped', dal.api.board.get({id:createBoardRes.data.id}).board.date_updated)

  // boardId is immutable, this has to fail
  const moveTaskToBoardRes = dal.api.task.update({ task: {
    id: createTaskRes.data.id,
    boardId: 'someotherboard',
  }})
  if (moveTaskToBoardRes.success) { console.log('updating task boardId should have failed');return }
  console.log('task boardId update correctly failed', moveTaskToBoardRes.errors)

  const createTaskForShiftAndDeleteRes = dal.api.task.create({ task: {
    boardId: createBoardRes.data.id,
    name: 'task-delete',
  }})
  if (!createTaskForShiftAndDeleteRes.success) {console.log('failed to create task for shift/delete',createTaskForShiftAndDeleteRes.errors);return}

  const shiftTaskRes = dal.api.task.shift({ id: createTaskForShiftAndDeleteRes.data.id, location: -1 })
  if (!shiftTaskRes.success) { console.log('failed to shift task', shiftTaskRes.errors);return }
  console.log('board tasks after shift', dal.api.board.get({id:createBoardRes.data.id}).board.tasks)

  const deleteTaskRes = dal.api.task.delete({ id: createTaskForShiftAndDeleteRes.data.id })
  if (!deleteTaskRes.success) { console.log('failed to delete task', deleteTaskRes.errors);return }
  console.log(`board after task delete, '${createTaskForShiftAndDeleteRes.data.id}' should be gone fully`, JSON.stringify(dal.data,' ',2))

  // required args
  const createTaskWithoutBoardRes = dal.api.task.create({ task: { name: 'orphan' } })
  if (createTaskWithoutBoardRes.success) { console.log('creating a task without boardId should have failed');return }
  console.log('task create without boardId correctly failed', createTaskWithoutBoardRes.errors)

  const deleteMissingTaskRes = dal.api.task.delete({ id: 'YAHZ-999' })
  if (deleteMissingTaskRes.success) { console.log('deleting a missing task should have failed');return }
  console.log('task delete of missing id correctly failed', deleteMissingTaskRes.errors)

  // group/column task placement
  const createTaskInGroupRes = dal.api.task.create({ task: {
    boardId: createBoardRes.data.id,
    groupId: createGroupForBoardRes.data.id,
    column: 'inprogress',
    name: 'task in progress',
  }})
  if (!createTaskInGroupRes.success) { console.log('failed to create task in group', createTaskInGroupRes.errors);return }
  console.log('group after task create', JSON.stringify(dal.data.groups.find(x => x.id === createGroupForBoardRes.data.id),' ',2))

  const addTaskToGroupRes = dal.api.group.task.add({
    groupId: createGroupForBoardRes.data.id,
    taskId: createTaskRes.data.id,
    column: 'inprogress',
  })
  if (!addTaskToGroupRes.success) { console.log('failed to add task to group', addTaskToGroupRes.errors);return }

  // the task is already in the group, this has to fail
  const addTaskToGroupAgainRes = dal.api.group.task.add({
    groupId: createGroupForBoardRes.data.id,
    taskId: createTaskRes.data.id,
  })
  if (addTaskToGroupAgainRes.success) { console.log('adding a task to the same group twice should have failed');return }
  console.log('duplicate group task add correctly failed', addTaskToGroupAgainRes.errors)

  const createTaskBadColumnRes = dal.api.task.create({ task: {
    boardId: createBoardRes.data.id,
    groupId: createGroupForBoardRes.data.id,
    column: 'bogus',
    name: 'bad column task',
  }})
  if (createTaskBadColumnRes.success) { console.log('creating a task in a bogus column should have failed');return }
  console.log('task create in bogus column correctly failed', createTaskBadColumnRes.errors)

  const shiftGroupTaskRes = dal.api.group.task.shift({
    groupId: createGroupForBoardRes.data.id,
    taskId: createTaskRes.data.id,
    location: -1,
  })
  if (!shiftGroupTaskRes.success) { console.log('failed to shift task in group', shiftGroupTaskRes.errors);return }
  console.log('group columns after shift', JSON.stringify(dal.data.groups.find(x => x.id === createGroupForBoardRes.data.id).columns,' ',2))

  const removeGroupTaskRes = dal.api.group.task.remove({
    groupId: createGroupForBoardRes.data.id,
    taskId: createTaskInGroupRes.data.id,
  })
  if (!removeGroupTaskRes.success) { console.log('failed to remove task from group', removeGroupTaskRes.errors);return }
  console.log('group after task remove', JSON.stringify(dal.data.groups.find(x => x.id === createGroupForBoardRes.data.id),' ',2))

  const removeBoardTaskRefRes = dal.api.board.task.remove({
    boardId: createBoardRes.data.id,
    taskId: createTaskInGroupRes.data.id,
  })
  if (!removeBoardTaskRefRes.success) { console.log('failed to remove task ref from board', removeBoardTaskRefRes.errors);return }
  console.log('board tasks after ref remove', dal.api.board.get({id:createBoardRes.data.id}).board.tasks)

  const addBoardTaskRefRes = dal.api.board.task.add({
    boardId: createBoardRes.data.id,
    taskId: createTaskInGroupRes.data.id,
  })
  if (!addBoardTaskRefRes.success) { console.log('failed to add task ref to board', addBoardTaskRefRes.errors);return }
  console.log('board tasks after ref add', dal.api.board.get({id:createBoardRes.data.id}).board.tasks)

  // TODO: add/remove/update comments to board, group and task via dal.<type>.comment.fn()
  
  // TODO: add and remove tags to board, group and task via dal.<type>.tag.fn()
}



function testShifting() {
  //shift([{id: 0},{id: 1}], 1, -1)
  // this needs to fail gracefully. just tried to move the right most object right
  //shift([{id: 0},{id: 1}], 1, 1)
  shift([{id: 0},{id: 1},{id: 2},{id: 3}], 3, -1)
  
  function shift(arr, id, location) {
    let itemIndex = arr.findIndex(x => x.id === id) // lets assume we always find for now
    console.log('args', arr, id, location)
    console.log('item index', itemIndex)
    let targetIndex = itemIndex + location
    console.log('target index', targetIndex)

    if (location < 0) {
      console.log('moving to the left')
      if (targetIndex < 0) {
        console.log('overshot, just move item to zeroeth spot')
        targetindex = 0
      }
      const item = arr.splice(itemIndex, 1)[0]
      arr.splice(targetIndex, 0, item)
      console.log('move left operation complete', arr)
    } else {
      console.log('moving to the right')
      const item = arr.splice(itemIndex, 1)[0]
      arr.splice(targetIndex, 0, item)
      console.log(`move right operation complete`, arr)
    }
  }
}
function recursivelyUpdateObjects() {
  const dal = new NabnakDal({
    debug: true,
    boards: [
      { id: 'yahbsite', name: 'yahbsite', slug: 'yahz'}
    ],
    groups: [
      { id: 'nabnak', name: 'nabnak', parentId: 'yahbsite', parentType: 'board' },
      { id: 'future-tasks', name: 'future-tasks', parentId: 'nabnak', parentType: 'group' },
      { id: 'ideas', name: 'ideas', parentId: 'nabnak', parentType: 'group' },
      { id: 'active', name: 'active', parentId: 'nabnak', parentType: 'group' },
      { id: 'batch-0', name: 'batch-0', parentId: 'active', parentType: 'group' },
    ],
  })
  console.log('data', dal.data)
  dal.helper.recursivelyUpdateAllParents('batch-0', 'group')
}