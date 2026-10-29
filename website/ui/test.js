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
      // tag driven. tags like 'type--epic' would be invalid, one extra dash.
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

        if (this.#boards.length > 2) {errors.push('need at least 2 items in array to shift')}
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

        _.logger.log(`successfully shifted board ${args.location < 0 ? 'left' : 'right'}`)
        return {success:true}
      },
      tag: {
        add: (args) => {},
        remove: (args) => {},
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
        create: (args) => {
          if (!args) { args = {} }
          args.parentType = this.#schema.enum.group.parentType.group
          return this.api.group.create(args)
        },
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
  //testShifting()
  dalStuff()
  //recursivelyUpdateObjects()
})()

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
function dalStuff() {
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