class NabnakDal {
  #boards = []
  #groups = []
  #tasks = []
  #quiet = false
  // the dal lives in its own file now, so it can't assume the page's '_' exists. 'const _'
  // isnt a window prop, but classic scripts share one global scope so typeof still sees it
  #log = (text, level, blob) => {
    if (this.#quiet) { return }
    if (typeof _ !== 'undefined' && _?.logger?.log) { return _.logger.log(text, level, blob) }
    if (blob) { console.log(`[${level ?? 'info'}]:${text}`, blob) } else { console.log(`[${level ?? 'info'}]:${text}`) }
  }
  constructor(args) {
    if (!args) { args = {} }
    this.#quiet = args.quiet === true
    this.#wrapApi(this.api, 'api')
    if (Object.hasOwn(args, 'debug') && args.debug === true) {
      console.log('debug args', args)
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
      // clone so the caller cant mutate our private state through the arrays they handed us
      this.#boards = structuredClone(args.boards ?? [])
      this.#groups = structuredClone(args.groups ?? [])
      this.#tasks = structuredClone(args.tasks ?? [])
      // hydrate skips every validator, so this is the only thing standing between bad data
      // and a renderer that loops forever on a parent cycle
      const issues = this.helper.verify()
      if (issues.length) { throw Error(`hydrate failed integrity check:\n- ${issues.join('\n- ')}`) }
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

  // change notifications. fn({ action }) runs after any api call that succeeded and changed
  // something(everything except .get). nested calls(edit => task.update => ...) only fire once,
  // for the outermost call. the renderer re-renders on it, a saver can debounce on it
  #listeners = new Set()
  #depth = 0
  subscribe(fn) {
    this.#listeners.add(fn)
    return () => this.#listeners.delete(fn)
  }
  #wrapApi(obj, path) {
    for (const key of Object.keys(obj)) {
      const fn = obj[key]
      if (typeof fn === 'object' && fn !== null) { this.#wrapApi(fn, `${path}.${key}`); continue }
      if (typeof fn !== 'function' || key === 'get') { continue }
      obj[key] = (...args) => {
        this.#depth++
        let res
        try { res = fn(...args) } finally { this.#depth-- }
        if (this.#depth === 0 && res?.success === true && res.changed?.length !== 0) {
          for (const listener of this.#listeners) {
            try { listener({ action: `${path}.${key}`, args: args[0] }) }
            catch (e) { this.#log(`subscriber threw on ${path}.${key}: ${e.message}`, 'error') }
          }
        }
        return res
      }
    }
  }
  
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
      this.#log(`${idsHit.join(', ')} updated`)
      return
    },
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
    // 'Adelle Spiritual Website' => 'adelle-spiritual-website'
    slugify: (text = '') => {
      return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    },
    // group ids are scoped to their board('yahbsite/ideas') so every board can have an 'ideas'
    groupIdFor: (boardId, name) => `${boardId}/${this.helper.slugify(name)}`,
    // the board or group object that holds the group's shallow ref
    parentOf: (group) => {
      if (group.parentType === this.#schema.enum.group.parentType.board) {
        return this.#boards.find(x => x.id === group.parentId)
      }
      if (group.parentType === this.#schema.enum.group.parentType.group) {
        return this.#groups.find(x => x.id === group.parentId)
      }
      return undefined
    },
    // every group below this one(not including itself), depth first in display order
    descendantGroupIds: (id) => {
      const ids = []
      const walk = (groupId, guard) => {
        const group = this.#groups.find(x => x.id === groupId)
        if (!group) { return }
        for (const ref of group.groups) {
          if (guard.includes(ref.id)) { continue } // cycle, verify() reports it
          ids.push(ref.id)
          walk(ref.id, [...guard, ref.id])
        }
      }
      walk(id, [id])
      return ids
    },
    // [top level group, ..., this group]. empty if the chain is broken
    groupChain: (id) => {
      const chain = []
      let group = this.#groups.find(x => x.id === id)
      while (group) {
        if (chain.includes(group)) { return [] }
        chain.unshift(group)
        if (group.parentType !== this.#schema.enum.group.parentType.group) { break }
        group = this.#groups.find(x => x.id === group.parentId)
        if (!group) { return [] }
      }
      return chain
    },
    // 'YYYY-MM-DD' from anything date-ish, null for empty
    dateOnly: (value) => {
      if (value == null || value === '') { return null }
      const date = new Date(value)
      return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
    },
    fieldText: (value) => Array.isArray(value) ? value.join(', ') : (value ?? ''),
    // raw input => canonical value for a describe.* field. { value, errors }
    normalizeField: (field, raw) => {
      const errors = []
      let value
      switch (field.kind) {
        case 'text':
          value = String(raw ?? '').trim()
          if (field.required && !value.length) { errors.push(`${field.label} required`) }
          break
        case 'textarea':
          // keep line breaks and indentation, just drop trailing whitespace
          value = String(raw ?? '').replace(/\s+$/, '')
          break
        case 'tags': {
          const list = Array.isArray(raw) ? raw : String(raw ?? '').split(',')
          value = list.map(t => String(t).trim()).filter(t => t.length)
          const spaced = value.filter(t => /\s/.test(t))
          if (spaced.length) { errors.push(`tags cant contain spaces('${spaced.join("', '")}'), use dashes`) }
          const dupes = this.helper.checkForTagDupes(value)
          if (dupes.length) { errors.push(`duplicate tags '${dupes.join(', ')}'`) }
          break
        }
        case 'date':
          if (raw == null || raw === '') { value = null; break }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw)) || isNaN(new Date(raw).getTime())) {
            errors.push(`'${raw}' is not a date(YYYY-MM-DD)`); value = null; break
          }
          value = String(raw)
          break
        case 'select':
          value = String(raw ?? '')
          // dependent selects(status) are checked against the chosen group when applying
          if (!field.dependsOn && !field.options.find(o => o.value === value)) { errors.push(`'${value}' is not an option for ${field.label}`) }
          break
        default:
          errors.push(`unknown field kind '${field.kind}'`)
      }
      return { value, errors }
    },
    // a task has exactly one home group(or none, ungrouped). the column it sits in there is
    // its status, so a second home would mean two statuses
    homeGroupOf: (taskId) => {
      return this.#groups.find(g => g.columns.some(c => c.items.some(x => x.id === taskId)))
    },
    // checks every cross reference. returns a list of human readable issues, empty is good.
    // hydrate runs this, you can run it any time to catch drift between the shallow refs
    verify: () => {
      const issues = []
      const P = this.#schema.enum.group.parentType
      const dupes = (arr, key) => arr.map(x => x[key]).filter((v, i, a) => a.indexOf(v) !== i)
      for (const id of dupes(this.#boards, 'id')) { issues.push(`duplicate board id '${id}'`) }
      for (const slug of dupes(this.#boards, 'slug')) { issues.push(`duplicate board slug '${slug}'`) }
      for (const id of dupes(this.#groups, 'id')) { issues.push(`duplicate group id '${id}'`) }
      for (const id of dupes(this.#tasks, 'id')) { issues.push(`duplicate task id '${id}'`) }

      for (const board of this.#boards) {
        for (const ref of board.groups ?? []) {
          const group = this.#groups.find(x => x.id === ref.id)
          if (!group) { issues.push(`board '${board.id}' references missing group '${ref.id}'`); continue }
          if (group.parentType !== P.board || group.parentId !== board.id) {
            issues.push(`board '${board.id}' lists group '${group.id}' but the group's parent is ${group.parentType} '${group.parentId}'`)
          }
        }
        for (const ref of board.tasks ?? []) {
          const task = this.#tasks.find(x => x.id === ref.id)
          if (!task) { issues.push(`board '${board.id}' references missing task '${ref.id}'`); continue }
          if (task.boardId !== board.id) { issues.push(`board '${board.id}' lists task '${task.id}' that belongs to board '${task.boardId}'`) }
        }
      }

      for (const group of this.#groups) {
        const parent = this.helper.parentOf(group)
        if (!parent) {
          issues.push(`group '${group.id}' has missing parent ${group.parentType} '${group.parentId}'`)
        } else if (!parent.groups?.find(x => x.id === group.id)) {
          issues.push(`group '${group.id}' says its parent is '${parent.id}' but '${parent.id}' doesnt list it`)
        }
        const boardId = this.helper.boardIdForGroup(group.id)
        if (!boardId) { issues.push(`group '${group.id}' never reaches a board(cycle or broken chain)`) }
        for (const ref of group.groups ?? []) {
          const child = this.#groups.find(x => x.id === ref.id)
          if (!child) { issues.push(`group '${group.id}' references missing group '${ref.id}'`); continue }
          if (child.parentType !== P.group || child.parentId !== group.id) {
            issues.push(`group '${group.id}' lists group '${child.id}' but the child's parent is ${child.parentType} '${child.parentId}'`)
          }
        }
        const inColumns = []
        for (const column of group.columns ?? []) {
          for (const ref of column.items) {
            const task = this.#tasks.find(x => x.id === ref.id)
            if (!task) { issues.push(`group '${group.id}' column '${column.name}' references missing task '${ref.id}'`); continue }
            if (inColumns.includes(ref.id)) { issues.push(`task '${ref.id}' sits in more than one column of group '${group.id}'`) }
            inColumns.push(ref.id)
            if (boardId && task.boardId !== boardId) { issues.push(`group '${group.id}'(board '${boardId}') holds task '${task.id}' from board '${task.boardId}'`) }
          }
        }
        // group.tasks is a second copy of what the columns already say, they have to agree
        const listed = (group.tasks ?? []).map(x => x.id)
        for (const id of listed) { if (!inColumns.includes(id)) { issues.push(`group '${group.id}'.tasks lists '${id}' but no column holds it`) } }
        for (const id of inColumns) { if (!listed.includes(id)) { issues.push(`group '${group.id}' column holds '${id}' but .tasks doesnt list it`) } }
      }

      for (const task of this.#tasks) {
        const homes = this.#groups.filter(g => g.columns.some(c => c.items.some(x => x.id === task.id)))
        if (homes.length > 1) { issues.push(`task '${task.id}' lives in ${homes.length} groups('${homes.map(g => g.id).join("', '")}'), a task gets one home group`) }
        const board = this.#boards.find(x => x.id === task.boardId)
        if (!board) { issues.push(`task '${task.id}' has missing board '${task.boardId}'`); continue }
        if (!board.tasks.find(x => x.id === task.id)) { issues.push(`task '${task.id}' missing from board '${board.id}'.tasks`) }
      }
      return issues
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
        if (Array.isArray(board.tags)) {
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
        
        if (args.location < 0) {
          if (itemIndex === 0) {
            errors.push(`attempted to move zeroeth item left`)
          }
        } else {
          if (itemIndex+1 === this.#boards.length) {
            errors.push(`attempted to move the last object right`)
          }
        }
        return errors
      },
      // refuses to orphan children unless the caller explicitly asks for { recursive:true }
      delete: (args) => {
        const errors = []
        if (!args.id?.length) { errors.push('arg id required');return errors}

        const existing = this.#boards.find(x => x.id === args.id)
        if (!existing) { errors.push(`board with id '${args.id}' not found`);return errors}

        if (args.recursive !== true) {
          if (existing.groups.length) { errors.push(`board '${existing.id}' still has ${existing.groups.length} group(s), pass recursive:true to delete them too`) }
          const taskCount = this.#tasks.filter(x => x.boardId === existing.id).length
          if (taskCount) { errors.push(`board '${existing.id}' still has ${taskCount} task(s), pass recursive:true to delete them too`) }
        }

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

        // used to crash here on a missing name since indexOf ran on undefined
        if (!group.name?.length) { errors.push('name required');return errors }
        if (~group.name.indexOf('_')) { errors.push('group names cant have underscores. honestly shouldnt have much of any special chars')}
        if (!this.helper.slugify(group.name).length) { errors.push(`group name '${group.name}' needs at least one letter or number`) }
        // TODO: limit group names to just a-zA-Z0-9 and dash? honestly I dont want dashes either

        // names only have to be unique inside a board(case insensitive), not globally
        const boardId = args?.parentType === this.#schema.enum.group.parentType.group
          ? this.helper.boardIdForGroup(group.parentId)
          : group.parentId
        if (boardId) {
          const id = group.id?.length ? group.id : this.helper.groupIdFor(boardId, group.name)
          if (this.#groups.find(x => x.id === id)) { errors.push(`group with id '${id}' already exists`) }
          const sameName = this.#groups.find(x =>
            x.name.toLowerCase() === group.name.toLowerCase() && this.helper.boardIdForGroup(x.id) === boardId)
          if (sameName && sameName.id !== id) { errors.push(`board '${boardId}' already has a group named '${sameName.name}'`) }
        }

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

        // renaming keeps the id, so the only rule is the board scoped name uniqueness
        if (Object.hasOwn(group, 'name')) {
          if (!group.name?.length) { errors.push('name required') }
          else if (~group.name.indexOf('_')) { errors.push('group names cant have underscores') }
          else {
            const boardId = this.helper.boardIdForGroup(existing.id)
            const sameName = this.#groups.find(x => x.id !== existing.id &&
              x.name.toLowerCase() === group.name.toLowerCase() && this.helper.boardIdForGroup(x.id) === boardId)
            if (sameName) { errors.push(`board '${boardId}' already has a group named '${sameName.name}'`) }
          }
        }

        if (Array.isArray(group.tags)) {
          const dupes = this.helper.checkForTagDupes(group.tags)
          if (dupes.length) {
            errors.push(`duplicate tags '${dupes.join(', ')}' found`)
          }
        }

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
          if (indexedGroupIndex === 0) {
            errors.push(`attempted to move zeroeth item left`)
          }
        } else {
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
        if (!group) { errors.push(`group with id '${args.id}' not found`);return errors}

        // deleting a group with children used to leave the children pointing at a parent that
        // no longer exists, which made recursivelyUpdateAllParents throw on their next update
        if (args.recursive !== true) {
          if (group.groups.length) { errors.push(`group '${group.id}' still has ${group.groups.length} subgroup(s), pass recursive:true to delete them too`) }
          if (group.tasks.length) { errors.push(`group '${group.id}' still has ${group.tasks.length} task(s), pass recursive:true to unlink them(tasks stay on the board)`) }
        }

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
      // reparent a group. exactly one of toGroupId/toBoardId(keeps parentType out of callers hands)
      move: (args) => {
        const errors = []
        if (!args?.id?.length) { errors.push('arg id required');return errors }
        const hasGroup = !!args.toGroupId?.length, hasBoard = !!args.toBoardId?.length
        if (hasGroup === hasBoard) { errors.push('exactly one of toGroupId or toBoardId required');return errors }

        const group = this.#groups.find(x => x.id === args.id)
        if (!group) { errors.push(`group '${args.id}' not found`);return errors }
        const fromBoardId = this.helper.boardIdForGroup(group.id)

        let toBoardId
        if (hasGroup) {
          const target = this.#groups.find(x => x.id === args.toGroupId)
          if (!target) { errors.push(`group '${args.toGroupId}' not found`);return errors }
          // the whole point of nesting: dont let a group end up inside itself
          if (target.id === group.id) { errors.push(`cant move group '${group.id}' into itself`);return errors }
          if (this.helper.descendantGroupIds(group.id).includes(target.id)) {
            errors.push(`cant move group '${group.id}' into its own subgroup '${target.id}'`);return errors
          }
          toBoardId = this.helper.boardIdForGroup(target.id)
        } else {
          if (!this.#boards.find(x => x.id === args.toBoardId)) { errors.push(`board '${args.toBoardId}' not found`);return errors }
          toBoardId = args.toBoardId
        }
        // tasks cant change boards, so neither can the groups holding them
        if (toBoardId !== fromBoardId) { errors.push(`group '${group.id}' belongs to board '${fromBoardId}', cant move it to board '${toBoardId}'`) }
        if (args.index != null && (!Number.isInteger(args.index) || args.index < 0)) { errors.push('index should be a positive int') }
        return errors
      },
      task: {
        // change a task's column inside a group, and/or move it to another group on the same board
        move: (args) => {
          const errors = []
          if (!args?.groupId?.length) { errors.push('arg groupId required');return errors }
          if (!args?.taskId?.length) { errors.push('arg taskId required');return errors }
          if (!args.column?.length && !args.toGroupId?.length) { errors.push('column and/or toGroupId required');return errors }

          const group = this.#groups.find(x => x.id === args.groupId)
          if (!group) { errors.push(`group with id '${args.groupId}' not found`);return errors }
          const task = this.#tasks.find(x => x.id === args.taskId)
          if (!task) { errors.push(`task with id '${args.taskId}' not found`);return errors }
          if (!group.tasks.find(x => x.id === task.id)) { errors.push(`task '${task.id}' doesnt belong to group '${group.id}'`);return errors }

          const target = args.toGroupId?.length ? this.#groups.find(x => x.id === args.toGroupId) : group
          if (!target) { errors.push(`group with id '${args.toGroupId}' not found`);return errors }
          if (target !== group) {
            if (this.helper.boardIdForGroup(target.id) !== task.boardId) { errors.push(`group '${target.id}' is not on board '${task.boardId}'`) }
          }
          // moving groups without naming a column keeps the column the task is in now
          const currentColumn = group.columns.find(c => c.items.find(x => x.id === task.id))?.name
          const column = args.column ?? currentColumn
          if (!target.columns.find(x => x.name === column)) { errors.push(`column '${column}' not found in group '${target.id}'`) }
          if (args.index != null && (!Number.isInteger(args.index) || args.index < 0)) { errors.push('index should be a positive int') }
          return errors
        },
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

          // one home group per task. moving it is group.task.move, not add
          const home = this.helper.homeGroupOf(task.id)
          if (home) {
            errors.push(home.id === group.id
              ? `task '${task.id}' already belongs to group '${group.id}'`
              : `task '${task.id}' already lives in group '${home.id}', use group.task.move({ groupId:'${home.id}', taskId:'${task.id}', toGroupId:'${group.id}' })`)
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
            if (itemIndex === 0) {
              errors.push(`attempted to move zeroeth item left`)
            }
          } else {
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
          if (itemIndex === 0) {
            errors.push(`attempted to move zeroeth item left`)
          }
        } else {
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
    // the update workflow's single write path. one call per save, whatever the editor touched:
    //   { type:'task'|'group'|'board', id, changes:{ key:rawValue }, base:{ key:valueWhenOpened } }
    // keys/values come from describe.*. raw values can be what an input holds('a, b' for tags,
    // '' for an empty date), they get normalized here. everything is validated before anything
    // is applied, so a save never half lands. base is optional: when given, a key whose current
    // value no longer matches base is a conflict(someone changed it while you were editing)
    // returns { success:true, changed:[keys] } or
    //         { success:false, errors:[general], fields:{ key:[messages] } }
    // the create half of the workflow. same field rules as edit, values default to the template's:
    //   { type:'task'|'group'|'board', context:{ ...template args }, values:{ key:rawValue } }
    // returns { success:true, type, id } or { success:false, errors:[general], fields:{ key:[] } }
    create: (args) => {
      const { type, context = {}, values = {} } = args ?? {}
      const template = typeof this.template[type] === 'function' ? this.template[type] : null
      if (!template) { return {success:false, errors:[`type '${type}' cant be created`], fields:{}} }
      const t = template(context)
      if (!t.success) { return {success:false, errors:t.errors, fields:{}} }

      const errors = [], fields = {}, clean = {}
      for (const key of Object.keys(values)) {
        const field = t.fields.find(f => f.key === key)
        if (!field) { errors.push(`'${key}' is not a ${type} field`) }
        else if (field.readonly && values[key] !== field.value) { (fields[key] ??= []).push('set by where you create it') }
      }
      for (const field of t.fields) {
        if (field.readonly) { continue }
        const res = this.helper.normalizeField(field, Object.hasOwn(values, field.key) ? values[field.key] : field.value)
        if (res.errors.length) { fields[field.key] = res.errors } else { clean[field.key] = res.value }
      }
      if (errors.length || Object.keys(fields).length) { return {success:false, errors, fields} }
      return this.#applyCreate[type](t, clean)
    },
    edit: (args) => {
      const { type, id, changes = {}, base } = args ?? {}
      const describe = typeof this.describe[type] === 'function' ? this.describe[type] : null
      if (!describe) { return {success:false, errors:[`type '${type}' is not editable`], fields:{}} }
      const d = describe({ id })
      if (!d.success) { return {success:false, errors:d.errors, fields:{}} }

      const errors = [], fields = {}, patch = {}
      const fieldErr = (key, msg) => { (fields[key] ??= []).push(msg) }
      for (const [key, raw] of Object.entries(changes)) {
        const field = d.fields.find(x => x.key === key)
        if (!field) { errors.push(`'${key}' is not an editable ${type} field`); continue }
        if (field.readonly) { fieldErr(key, 'read only'); continue }
        if (base && Object.hasOwn(base, key) && JSON.stringify(base[key]) !== JSON.stringify(field.value)) {
          fieldErr(key, `changed elsewhere to '${this.helper.fieldText(field.value)}' while you were editing`); continue
        }
        const res = this.helper.normalizeField(field, raw)
        for (const msg of res.errors) { fieldErr(key, msg) }
        if (!res.errors.length && JSON.stringify(res.value) !== JSON.stringify(field.value)) { patch[key] = res.value }
      }
      if (errors.length || Object.keys(fields).length) { return {success:false, errors, fields} }
      if (!Object.keys(patch).length) { return {success:true, changed:[]} }
      return this.#applyEdit[type](d, patch)
    },
    board: {
      get: (args) => {
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
        this.#log(`board '${board.name}' created`,null,board)
        return { success:true, data:{id:board.id} }
      },
      update: (args) => {
        // not allowing name/slug(and id of course) updates for now
        const errors = this.validate.board.update(args)
        if (errors.length) { return {success:false,errors} }

        const board = this.#boards.find(x => x.id === args.board.id)
        if (Object.hasOwn(args.board, 'description')) { board.description = args.board.description }
        if (Array.isArray(args.board.tags)) {
          board.tags = args.board.tags
        }
        board.date_updated = new Date().toISOString()

        this.#log(`board '${board.name}' updated`)
        return {success:true}
      },
      delete: (args) => {
        const errors = this.validate.board.delete(args)
        if (errors.length) { return {success:false,errors} }

        const index = this.#boards.findIndex(x => x.id === args.id)
        const deletedBoard = this.#boards.splice(index, 1)[0]

        // validate already refused unless recursive:true, so anything left here goes with it
        const doomed = this.#groups.filter(g => this.helper.boardIdForGroup(g.id) === deletedBoard.id).map(g => g.id)
        this.#groups = this.#groups.filter(g => !doomed.includes(g.id))
        this.#tasks = this.#tasks.filter(t => t.boardId !== deletedBoard.id)

        this.#log(`board '${deletedBoard.name}' deleted`)
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
        this.#log(`successfully shifted board ${args.location < 0 ? 'left' : 'right'}`)
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
        // ordering a board's groups is exactly api.group.shift
        shift: (args) => this.api.group.shift({id:args.groupId ?? args.id, location:args.location}),
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
          this.#log(`task '${args.taskId}' added to board '${board.id}'`)
          return {success:true}
        },
        remove: (args) => {
          const errors = this.validate.board.task.remove(args)
          if (errors.length) { return {success:false,errors} }

          const board = this.#boards.find(x => x.id === args.boardId)
          const refIndex = board.tasks.findIndex(x => x.id === args.taskId)
          board.tasks.splice(refIndex, 1)[0]

          board.date_updated = new Date().toISOString()
          this.#log(`task '${args.taskId}' removed from board '${board.id}'`)
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
        const boardId = args.parentType === this.#schema.enum.group.parentType.group
          ? this.helper.boardIdForGroup(args.group.parentId)
          : args.group.parentId
        // caller may supply an id(debug/import), otherwise 'boardid/slugified-name'
        group.id = args.group.id?.length ? args.group.id : this.helper.groupIdFor(boardId, args.group.name)
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
        this.#log(`group '${group.name}' created`,null,group)
        return {success:true,data:{id:group.id}}
      },
      update: (args) => {
        const errors = this.validate.group.update(args)
        if (errors.length) { return {success:false,errors}}

        const group = this.#groups.find(x => x.id === args.group.id)
        if (Object.hasOwn(args.group, 'name')) { group.name = args.group.name }
        // was writing the description into group.name
        if (Object.hasOwn(args.group, 'description')) { group.description = args.group.description }
        if (Array.isArray(args.group.tags)) {
          group.tags = args.group.tags
        }
        
        group.date_updated = new Date().toISOString()
        this.helper.recursivelyUpdateAllParents(group.parentId, group.parentType)
        this.#log(`group '${group.name}' updated`,null,group)
        return {success:true}
      },
      delete: (args) => {
        const errors = this.validate.group.delete(args)
        if (errors.length) { return {success:false,errors} }

        // recursive:true(validate refused otherwise). subgroups go with it, task refs live inside
        // the groups so they go too, the tasks themselves stay on the board as ungrouped
        const descendants = this.helper.descendantGroupIds(args.id)
        this.#groups = this.#groups.filter(g => !descendants.includes(g.id))

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
        this.#log(`group '${deletedGroup.name}' deleted`)
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
        this.#log(`group '${group.name}' updated(shifted)`,null,group)

        return {success:true}
      },
      // reparent: { id, toGroupId } or { id, toBoardId }, optional index(default end of list)
      move: (args) => {
        const errors = this.validate.group.move(args)
        if (errors.length) { return {success:false,errors} }

        const P = this.#schema.enum.group.parentType
        const group = this.#groups.find(x => x.id === args.id)
        const oldParent = this.helper.parentOf(group)
        const oldRefIndex = oldParent.groups.findIndex(x => x.id === group.id)
        const ref = oldParent.groups.splice(oldRefIndex, 1)[0] ?? {id:group.id}
        // the old chain changed too, bump it before we rewire
        this.helper.recursivelyUpdateAllParents(group.parentId, group.parentType)

        group.parentType = args.toGroupId?.length ? P.group : P.board
        group.parentId = args.toGroupId?.length ? args.toGroupId : args.toBoardId
        const newParent = this.helper.parentOf(group)
        const index = args.index ?? newParent.groups.length
        newParent.groups.splice(index, 0, ref)

        group.date_updated = new Date().toISOString()
        this.helper.recursivelyUpdateAllParents(group.parentId, group.parentType)
        this.#log(`group '${group.name}' moved to ${group.parentType} '${group.parentId}'`)
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
        shift: (args) => this.api.group.shift({id:args.groupId ?? args.id, location:args.location}),
      },
      task: {
        // the status change: { groupId, taskId, column } moves it between columns. add
        // toGroupId to move it to another group too(column defaults to its current one).
        // index is its position in the target column, default is the end
        move: (args) => {
          const errors = this.validate.group.task.move(args)
          if (errors.length) { return {success:false,errors} }

          const group = this.#groups.find(x => x.id === args.groupId)
          const task = this.#tasks.find(x => x.id === args.taskId)
          const target = args.toGroupId?.length ? this.#groups.find(x => x.id === args.toGroupId) : group
          const fromColumn = group.columns.find(c => c.items.find(x => x.id === task.id))
          const toColumn = target.columns.find(x => x.name === (args.column ?? fromColumn.name))

          fromColumn.items.splice(fromColumn.items.findIndex(x => x.id === task.id), 1)
          if (target !== group) {
            group.tasks.splice(group.tasks.findIndex(x => x.id === task.id), 1)
            target.tasks.push({id:task.id})
            this.helper.recursivelyUpdateAllParents(group.id, this.#schema.enum.group.parentType.group)
          }
          toColumn.items.splice(args.index ?? toColumn.items.length, 0, {id:task.id})

          task.date_updated = new Date().toISOString()
          this.helper.recursivelyUpdateAllParents(target.id, this.#schema.enum.group.parentType.group)
          this.#log(`task '${task.name}' moved to '${target.name}'(${toColumn.name})`)
          return {success:true}
        },
        // gives an ungrouped task its home group. a task that already has one is refused,
        // use group.task.move instead. 'column' defaults to 'todo'.
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
          this.#log(`task '${task.name}' added to group '${group.name}'(${column.name})`)
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
          this.#log(`task '${task.name}' removed from group '${group.name}'`)
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
          this.#log(`successfully shifted task '${task.name}' in group '${group.name}'(${column.name}) ${args.location < 0 ? 'left' : 'right'}`)
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
        this.#log(`task '${task.name}' created`,null,task)
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
        // only updating .metadata prop per child property
        //if (Object.hasOwn(args.task, 'metadata')) { task.metadata = args.task.metadata }

        task.date_updated = new Date().toISOString()
        // the groups showing this task changed too, not just the board
        const home = this.helper.homeGroupOf(task.id)
        if (home) { this.helper.recursivelyUpdateAllParents(home.id, this.#schema.enum.group.parentType.group) }
        this.helper.recursivelyUpdateAllParents(task.boardId, this.#schema.enum.group.parentType.board)
        this.#log(`task '${task.name}' updated`,null,task)
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

        // drop the home group's refs(group.tasks and its column) so nothing is orphaned
        for (const group of this.#groups) {
          const groupRefIndex = group.tasks.findIndex(x => x.id === deletedTask.id)
          if (groupRefIndex >= 0) { group.tasks.splice(groupRefIndex, 1) }
          for (const column of group.columns) {
            const itemRefIndex = column.items.findIndex(x => x.id === deletedTask.id)
            if (itemRefIndex >= 0) { column.items.splice(itemRefIndex, 1) }
          }
        }

        this.helper.recursivelyUpdateAllParents(deletedTask.boardId, this.#schema.enum.group.parentType.board)
        this.#log(`task '${deletedTask.name}' deleted`)
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
        this.#log(`successfully shifted task '${task.name}' ${args.location < 0 ? 'left' : 'right'}`)
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
  // read side for the renderer. everything here is a fresh plain object(safe to mutate, never
  // touches private state) and already stitched together, so the renderer never has to chase
  // shallow refs or know parentType exists.
  //
  // rollup rule: a group's numbers include every task in its subtree. every task has one home
  // group(or none), so nothing can show up twice and the counts are plain sums
  format = {
    // no parameter structure: every board with its full group tree and rollup counts.
    // enough to draw the sidebar and the all boards overview
    all: () => {
      return { boards: this.#boards.map(board => this.#formatBoardNode(board)) }
    },
    // kanban model for one node: { boardId } or { groupId }
    //   columns: column names(the group's own, plus any extra its subgroups use)
    //   lanes:   [direct tasks of the node, then one lane per child group with that child's
    //            whole subtree rolled up]. cells line up with columns
    view: (args) => {
      let board, group
      if (args?.groupId) {
        group = this.#groups.find(x => x.id === args.groupId)
        if (!group) { return {success:false,errors:[`group '${args.groupId}' not found`]} }
        board = this.#boards.find(x => x.id === this.helper.boardIdForGroup(group.id))
      } else {
        board = this.#boards.find(x => x.id === args?.boardId)
      }
      if (!board) { return {success:false,errors:[`board '${args?.boardId ?? args?.groupId}' not found`]} }

      const chain = group ? this.helper.groupChain(group.id) : []
      const breadcrumb = [
        {type:'board', id:board.id, name:board.name},
        ...chain.map(g => ({type:'group', id:g.id, name:g.name})),
      ]
      const node = group ?? board
      const childGroups = node.groups.map(ref => this.#groups.find(x => x.id === ref.id)).filter(Boolean)

      // gather entries lane by lane, then decide the columns once we know every name in use
      const laneSources = []
      if (group) {
        laneSources.push({type:'direct', id:group.id, name:group.name, entries:this.#collect(group, false)})
      } else {
        laneSources.push({type:'ungrouped', id:board.id, name:'ungrouped', entries:this.#ungrouped(board)})
      }
      for (const child of childGroups) {
        laneSources.push({type:'group', id:child.id, name:child.name, description:child.description,
          tags:[...child.tags], subgroupCount:this.helper.descendantGroupIds(child.id).length,
          entries:this.#collect(child, true)})
      }

      // node's own columns first, then any extra a subgroup defines(even while empty)
      const columns = group ? group.columns.map(c => c.name) : []
      const subtree = group
        ? this.helper.descendantGroupIds(group.id)
        : childGroups.flatMap(c => [c.id, ...this.helper.descendantGroupIds(c.id)])
      for (const id of subtree) {
        for (const c of this.#groups.find(x => x.id === id)?.columns ?? []) {
          if (!columns.includes(c.name)) { columns.push(c.name) }
        }
      }
      if (!columns.length) { columns.push(...this.#schema.group.columns.map(c => c.name)) }

      const lanes = laneSources.map(src => {
        const cells = columns.map(() => [])
        for (const e of src.entries) {
          // ungrouped tasks have no column(no status), they sit in the first one
          cells[e.column ? columns.indexOf(e.column) : 0].push(this.#formatTask(e, board))
        }
        const counts = Object.fromEntries(columns.map((c, i) => [c, cells[i].length]))
        const {entries, ...rest} = src
        return {...rest, counts, total:cells.reduce((n, c) => n + c.length, 0), cells}
      })

      const counts = Object.fromEntries(columns.map(c => [c, lanes.reduce((n, l) => n + l.counts[c], 0)]))
      return {
        success: true,
        node: {type:group ? 'group' : 'board', id:node.id, name:node.name, description:node.description ?? null,
          tags:[...(node.tags ?? [])], boardId:board.id, boardName:board.name, slug:board.slug},
        breadcrumb, columns, lanes, counts,
        total: lanes.reduce((n, l) => n + l.total, 0),
      }
    },
    // one task with everything the detail panel needs
    task: (args) => {
      const task = this.#tasks.find(x => x.id === args?.id)
      if (!task) { return {success:false,errors:[`task '${args?.id}' not found`]} }
      const board = this.#boards.find(x => x.id === task.boardId)
      const home = this.helper.homeGroupOf(task.id)
      return {success:true, task:{
        ...structuredClone(task),
        boardName: board?.name ?? null,
        // null while ungrouped
        groupId: home?.id ?? null,
        path: home ? this.helper.groupChain(home.id).map(x => ({id:x.id, name:x.name})) : [],
        column: home?.columns.find(c => c.items.find(x => x.id === task.id)).name ?? null,
      }}
    },
  }
  // entries for every task in a group: its own columns, then(if deep) its subgroups depth first.
  // path is the chain of groups from the group passed in down to where the task actually sits
  #collect(root, deep) {
    const out = []
    const walk = (group, path, guard) => {
      const here = [...path, {id:group.id, name:group.name}]
      for (const column of group.columns) {
        for (const ref of column.items) {
          out.push({id:ref.id, column:column.name, groupId:group.id, groupName:group.name, path:here})
        }
      }
      if (!deep) { return }
      for (const ref of group.groups) {
        if (guard.includes(ref.id)) { continue }
        const child = this.#groups.find(x => x.id === ref.id)
        if (child) { walk(child, here, [...guard, ref.id]) }
      }
    }
    walk(root, [], [root.id])
    return out
  }
  // board tasks no group on that board references, in board.tasks order
  #ungrouped(board) {
    const grouped = new Set()
    for (const g of this.#groups) {
      if (this.helper.boardIdForGroup(g.id) !== board.id) { continue }
      for (const c of g.columns) { for (const ref of c.items) { grouped.add(ref.id) } }
    }
    return board.tasks.filter(ref => !grouped.has(ref.id)).map(ref => ({id:ref.id, column:null, groupId:null, groupName:null, path:[]}))
  }
  #formatTask(entry, board) {
    const task = this.#tasks.find(x => x.id === entry.id)
    return {
      id: task.id,
      name: task.name,
      description: task.description ?? '',
      tags: [...task.tags],
      date_created: task.date_created,
      date_updated: task.date_updated,
      date_due: task.date_due,
      date_completed: task.date_completed,
      boardId: board.id,
      boardName: board.name,
      groupId: entry.groupId,
      column: entry.column,
      // groups between the lane and the task, lane group itself excluded(the lane header says it)
      path: entry.path.slice(1),
      fullPath: entry.path,
    }
  }
  #counts(entries) {
    const counts = {}
    for (const e of entries) { counts[e.column] = (counts[e.column] ?? 0) + 1 }
    return {counts, total:entries.length}
  }
  #formatGroupNode(group, depth) {
    const {counts, total} = this.#counts(this.#collect(group, true))
    return {
      type: 'group',
      id: group.id,
      name: group.name,
      description: group.description ?? null,
      tags: [...group.tags],
      depth,
      columns: group.columns.map(c => c.name),
      counts, total,
      groups: group.groups
        .map(ref => this.#groups.find(x => x.id === ref.id)).filter(Boolean)
        .map(child => this.#formatGroupNode(child, depth + 1)),
    }
  }
  #formatBoardNode(board) {
    const groups = board.groups.map(ref => this.#groups.find(x => x.id === ref.id)).filter(Boolean)
    const entries = groups.flatMap(g => this.#collect(g, true))
    const {counts, total} = this.#counts(entries)
    const ungrouped = this.#ungrouped(board).length
    return {
      type: 'board',
      id: board.id,
      name: board.name,
      slug: board.slug,
      description: board.description ?? null,
      tags: [...board.tags],
      counts, ungrouped,
      total: total + ungrouped,
      groups: groups.map(g => this.#formatGroupNode(g, 0)),
    }
  }
  // what the editor is allowed to touch, with current values and options. no setup fns: the
  // options are worked out here from live data. a field looks like
  //   { key, label, kind:'text'|'textarea'|'tags'|'date'|'select', value, required?, readonly?,
  //     options?:[{ value, label, columns? }], dependsOn? }
  // value is canonical(tags array, date 'YYYY-MM-DD' or null, select value string)
  describe = {
    task: (args) => {
      const task = this.#tasks.find(x => x.id === args?.id)
      if (!task) { return {success:false, errors:[`task '${args?.id}' not found`]} }
      const board = this.#boards.find(x => x.id === task.boardId)
      const home = this.helper.homeGroupOf(task.id)
      const column = home?.columns.find(c => c.items.find(x => x.id === task.id))?.name ?? ''
      // every group on the board in tree order, each carrying its columns so the editor can
      // swap the status options when the group changes without asking us again
      const groupOptions = this.#groupOptions(board.id)
      return {
        success: true, type:'task', id:task.id, title:task.name, boardId:board.id,
        fields: [
          { key:'name', label:'name', kind:'text', value:task.name, required:true },
          { key:'description', label:'description', kind:'textarea', value:task.description ?? '' },
          { key:'tags', label:'tags', kind:'tags', value:[...task.tags] },
          { key:'groupId', label:'group', kind:'select', value:home?.id ?? '', options:groupOptions },
          { key:'column', label:'status', kind:'select', value:column, dependsOn:'groupId',
            options:(home?.columns ?? []).map(c => ({ value:c.name, label:c.name })) },
          { key:'date_due', label:'due', kind:'date', value:this.helper.dateOnly(task.date_due) },
          { key:'date_completed', label:'completed', kind:'date', value:this.helper.dateOnly(task.date_completed) },
        ],
      }
    },
    group: (args) => {
      const group = this.#groups.find(x => x.id === args?.id)
      if (!group) { return {success:false, errors:[`group '${args?.id}' not found`]} }
      const boardId = this.helper.boardIdForGroup(group.id)
      // can't become a child of itself or anything below it
      const blocked = new Set([group.id, ...this.helper.descendantGroupIds(group.id)])
      const parentOptions = this.#parentOptions(boardId, blocked)
      return {
        success: true, type:'group', id:group.id, title:group.name, boardId,
        fields: [
          { key:'name', label:'name', kind:'text', value:group.name, required:true },
          { key:'description', label:'description', kind:'textarea', value:group.description ?? '' },
          { key:'tags', label:'tags', kind:'tags', value:[...group.tags] },
          { key:'parent', label:'parent', kind:'select', options:parentOptions,
            value:group.parentType === this.#schema.enum.group.parentType.group ? group.parentId : '' },
        ],
      }
    },
    board: (args) => {
      const board = this.#boards.find(x => x.id === args?.id)
      if (!board) { return {success:false, errors:[`board '${args?.id}' not found`]} }
      return {
        success: true, type:'board', id:board.id, title:board.name, boardId:board.id,
        fields: [
          // name/slug changes arent supported yet(ids and task ids derive from them)
          { key:'name', label:'name', kind:'text', value:board.name, readonly:true },
          { key:'slug', label:'slug', kind:'text', value:board.slug, readonly:true },
          { key:'description', label:'description', kind:'textarea', value:board.description ?? '' },
          { key:'tags', label:'tags', kind:'tags', value:[...board.tags] },
        ],
      }
    },
  }
  // same field shapes as describe.*, but for something that doesnt exist yet. args are the
  // context it is being created in, they only pick defaults(the user can still change them):
  //   task:  { boardId, groupId?, column? }   group: { boardId, parentGroupId? }   board: {}
  // fields marked readonly are context shown for orientation, create ignores them
  template = {
    task: (args) => {
      const board = this.#boards.find(x => x.id === args?.boardId)
      if (!board) { return {success:false, errors:[`board '${args?.boardId}' not found`]} }
      let group = null
      if (args.groupId) {
        group = this.#groups.find(x => x.id === args.groupId)
        if (!group || this.helper.boardIdForGroup(group.id) !== board.id) { return {success:false, errors:[`group '${args.groupId}' not found on board '${board.id}'`]} }
      }
      const columns = group?.columns.map(c => c.name) ?? []
      // a lane's '+' can pass a column the group doesnt have(rolled up custom column), fall back
      const column = columns.includes(args.column) ? args.column : (columns[0] ?? '')
      return {
        success: true, type:'task', boardId:board.id,
        title: group ? this.helper.groupChain(group.id).map(x => x.name).join(' / ') : `${board.name} (ungrouped)`,
        fields: [
          { key:'board', label:'board', kind:'text', value:board.name, readonly:true },
          { key:'name', label:'name', kind:'text', value:'', required:true },
          { key:'description', label:'description', kind:'textarea', value:'' },
          { key:'tags', label:'tags', kind:'tags', value:[] },
          { key:'groupId', label:'group', kind:'select', value:group?.id ?? '', options:this.#groupOptions(board.id) },
          { key:'column', label:'status', kind:'select', value:column, dependsOn:'groupId', options:columns.map(c => ({ value:c, label:c })) },
          { key:'date_due', label:'due', kind:'date', value:null },
        ],
      }
    },
    group: (args) => {
      const board = this.#boards.find(x => x.id === args?.boardId)
      if (!board) { return {success:false, errors:[`board '${args?.boardId}' not found`]} }
      if (args.parentGroupId && this.helper.boardIdForGroup(args.parentGroupId) !== board.id) {
        return {success:false, errors:[`group '${args.parentGroupId}' not found on board '${board.id}'`]}
      }
      return {
        success: true, type:'group', boardId:board.id,
        title: args.parentGroupId ? this.helper.groupChain(args.parentGroupId).map(x => x.name).join(' / ') : board.name,
        fields: [
          { key:'board', label:'board', kind:'text', value:board.name, readonly:true },
          { key:'name', label:'name', kind:'text', value:'', required:true },
          { key:'parent', label:'parent', kind:'select', value:args.parentGroupId ?? '', options:this.#parentOptions(board.id, new Set()) },
          { key:'description', label:'description', kind:'textarea', value:'' },
          { key:'tags', label:'tags', kind:'tags', value:[] },
        ],
      }
    },
    board: () => ({
      success: true, type:'board', boardId:null, title:'all boards',
      fields: [
        { key:'name', label:'name', kind:'text', value:'', required:true },
        // task ids are '<slug>-<n>', so this is forever
        { key:'slug', label:'slug (4 chars, task ids use it)', kind:'text', value:'', required:true },
        { key:'description', label:'description', kind:'textarea', value:'' },
        { key:'tags', label:'tags', kind:'tags', value:[] },
      ],
    }),
  }
  // every group on the board in tree order, each carrying its columns so the editor can
  // swap the status options when the group changes without asking us again
  #groupOptions(boardId) {
    const options = [{ value:'', label:'(ungrouped)', columns:[] }]
    for (const g of this.#boardGroupsInOrder(boardId)) {
      options.push({ value:g.id, label:this.helper.groupChain(g.id).map(x => x.name).join(' / '), columns:g.columns.map(c => c.name) })
    }
    return options
  }
  #parentOptions(boardId, blocked) {
    const options = [{ value:'', label:`${boardId} (top level)` }]
    for (const g of this.#boardGroupsInOrder(boardId)) {
      if (!blocked.has(g.id)) { options.push({ value:g.id, label:this.helper.groupChain(g.id).map(x => x.name).join(' / ') }) }
    }
    return options
  }
  // the older validators return plain strings. route them to the field they talk about so the
  // editor can show them in place, anything unrecognized stays general
  #routeErrors(messages, rules, fields, general) {
    for (const msg of messages) {
      const rule = rules.find(([pattern]) => pattern.test(msg))
      if (rule) { (fields[rule[1]] ??= []).push(msg) } else { general.push(msg) }
    }
  }
  #applyCreate = {
    task: (t, v) => {
      const fields = {}, errors = []
      const task = { boardId:t.boardId, name:v.name, description:v.description, tags:v.tags, date_due:v.date_due }
      if (v.groupId) {
        const group = this.#groups.find(x => x.id === v.groupId)
        const columns = group?.columns.map(c => c.name) ?? []
        task.groupId = v.groupId
        task.column = v.column || columns[0]
        if (group && !columns.includes(task.column)) { fields.column = [`'${task.column}' is not a status in '${group.name}'`] }
      } else if (v.column) {
        fields.column = ['ungrouped tasks have no status, pick a group first']
      }
      this.#routeErrors(this.validate.task.create({ task }),
        [[/column/, 'column'], [/group/, 'groupId'], [/date_due/, 'date_due'], [/tag/, 'tags'], [/name/, 'name']], fields, errors)
      if (errors.length || Object.keys(fields).length) { return {success:false, errors, fields} }
      const res = this.api.task.create({ task })
      return res.success ? {success:true, type:'task', id:res.data.id} : {...res, fields:{}}
    },
    group: (t, v) => {
      const fields = {}, errors = []
      const P = this.#schema.enum.group.parentType
      const group = { name:v.name, description:v.description, tags:v.tags, parentId:v.parent || t.boardId }
      const parentType = v.parent ? P.group : P.board
      this.#routeErrors(this.validate.group.create({ group, parentType }),
        [[/parent/, 'parent'], [/tag/, 'tags'], [/name|already/, 'name']], fields, errors)
      if (errors.length || Object.keys(fields).length) { return {success:false, errors, fields} }
      const res = this.api.group.create({ group, parentType })
      return res.success ? {success:true, type:'group', id:res.data.id} : {...res, fields:{}}
    },
    board: (t, v) => {
      const fields = {}, errors = []
      const board = { name:v.name, slug:v.slug.toUpperCase(), description:v.description, tags:v.tags }
      this.#routeErrors(this.validate.board.create({ board }),
        [[/slug/, 'slug'], [/tag/, 'tags'], [/name/, 'name']], fields, errors)
      if (errors.length || Object.keys(fields).length) { return {success:false, errors, fields} }
      const res = this.api.board.create({ board })
      return res.success ? {success:true, type:'board', id:res.data.id} : {...res, fields:{}}
    },
  }
  #boardGroupsInOrder(boardId) {
    const board = this.#boards.find(x => x.id === boardId)
    const out = []
    for (const ref of board?.groups ?? []) {
      const top = this.#groups.find(x => x.id === ref.id)
      if (!top) { continue }
      out.push(top)
      for (const id of this.helper.descendantGroupIds(top.id)) { out.push(this.#groups.find(x => x.id === id)) }
    }
    return out.filter(Boolean)
  }
  // turns a normalized patch into existing api calls. validates every piece first, applies after
  #applyEdit = {
    task: (d, patch) => {
      const errors = [], fields = {}
      const fieldErr = (key, msg) => { (fields[key] ??= []).push(msg) }
      const taskId = d.id
      const update = { id:taskId }
      for (const key of ['name', 'description', 'tags', 'date_due', 'date_completed']) {
        if (Object.hasOwn(patch, key)) { update[key] = patch[key] }
      }

      // placement: group and status are one decision since the status options belong to the group
      const home = this.helper.homeGroupOf(taskId)
      const currentColumn = home?.columns.find(c => c.items.find(x => x.id === taskId))?.name ?? null
      let op = null
      if (Object.hasOwn(patch, 'groupId') || Object.hasOwn(patch, 'column')) {
        const targetId = Object.hasOwn(patch, 'groupId') ? patch.groupId : (home?.id ?? '')
        const target = targetId ? this.#groups.find(x => x.id === targetId) : null
        let column = Object.hasOwn(patch, 'column') ? patch.column : currentColumn
        if (target && !target.columns.find(c => c.name === column)) {
          // changing only the group: keep the status if the new group has it, else its first column
          if (Object.hasOwn(patch, 'column')) { fieldErr('column', `'${column}' is not a status in '${target.name}'`) }
          else { column = target.columns[0]?.name }
        }
        if (!target && Object.hasOwn(patch, 'column') && patch.column) { fieldErr('column', 'ungrouped tasks have no status, pick a group first') }

        if (!target && home) {
          op = { validate:this.validate.group.task.remove, run:this.api.group.task.remove, args:{ groupId:home.id, taskId } }
        } else if (target && !home) {
          op = { validate:this.validate.group.task.add, run:this.api.group.task.add, args:{ groupId:target.id, taskId, column } }
        } else if (target && home && (target !== home || column !== currentColumn)) {
          op = { validate:this.validate.group.task.move, run:this.api.group.task.move,
            args:{ groupId:home.id, taskId, column, ...(target !== home ? { toGroupId:target.id } : {}) } }
        }
      }

      const hasUpdate = Object.keys(update).length > 1
      if (hasUpdate) { errors.push(...this.validate.task.update({ task:update })) }
      if (op) { errors.push(...op.validate(op.args)) }
      if (errors.length || Object.keys(fields).length) { return {success:false, errors, fields} }

      if (hasUpdate) { const res = this.api.task.update({ task:update }); if (!res.success) { return {...res, fields:{}} } }
      if (op) { const res = op.run(op.args); if (!res.success) { return {...res, fields:{}} } }
      return {success:true, changed:Object.keys(patch)}
    },
    group: (d, patch) => {
      const errors = []
      const update = { id:d.id }
      for (const key of ['name', 'description', 'tags']) { if (Object.hasOwn(patch, key)) { update[key] = patch[key] } }
      const hasUpdate = Object.keys(update).length > 1
      const move = Object.hasOwn(patch, 'parent')
        ? (patch.parent ? { id:d.id, toGroupId:patch.parent } : { id:d.id, toBoardId:d.boardId })
        : null
      if (hasUpdate) { errors.push(...this.validate.group.update({ group:update })) }
      if (move) { errors.push(...this.validate.group.move(move)) }
      if (errors.length) { return {success:false, errors, fields:{}} }
      if (hasUpdate) { const res = this.api.group.update({ group:update }); if (!res.success) { return {...res, fields:{}} } }
      if (move) { const res = this.api.group.move(move); if (!res.success) { return {...res, fields:{}} } }
      return {success:true, changed:Object.keys(patch)}
    },
    board: (d, patch) => {
      const update = { id:d.id, ...patch }
      const errors = this.validate.board.update({ board:update })
      if (errors.length) { return {success:false, errors, fields:{}} }
      const res = this.api.board.update({ board:update })
      if (!res.success) { return {...res, fields:{}} }
      return {success:true, changed:Object.keys(patch)}
    },
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
      // .id prop needs format validation, a-zA-Z0-9 dashes and underscores only
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
      comments: [],
      metadata: {},
    },
    group: {
      // keeping same pattern as board for id/name
      id: null,
      name: null,
      parentId: null,
      parentType: null,
      description: null,
      tags: [],
      date_created: null,
      date_updated: null,
      date_due: null,
      date_completed: null,
      groups: [],
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
    // a task has one home group(or none = ungrouped). the column it sits in there is its
    // status. the home is tracked by the group's refs, not a field on the task
    task: {
      id: null, // would be something like YAHZ-1
      boardId: null, // definitely keeping this association
      name: null,
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
    },
  }
}


// lets node(dal.test.js) load the exact same file the browser does
if (typeof module !== 'undefined' && module.exports) { module.exports = { NabnakDal } }
