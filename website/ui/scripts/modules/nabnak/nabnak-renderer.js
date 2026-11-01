// draws whatever dal.format.* hands it. never reads dal state directly. it re-renders itself
// whenever the dal reports a change(dal.subscribe), so a cli command just calls dal.api.* and
// the view follows. the only write it does is the editor's save, through dal.api.edit.
//
// update workflow(replaces terminal.js _.form for nabnak)
//   open    api.edit({ taskId } | { groupId } | { boardId }), no args = whatever is selected.
//           also: 'edit' links, double click a card. one edit at a time
//   fields  come from dal.describe.<type>, so the dal owns labels, kinds, options and rules.
//           the status options follow the group pick right here, no setup() round trip
//   draft   state.edit.draft holds raw input strings. typing never re-renders
//   save    api.saveEdit(): only dirty fields go to dal.api.edit along with the values they
//           had when the editor opened(base). errors come back per field and render under
//           the field, a field someone else changed meanwhile comes back as a conflict
//   keys    enter saves(ctrl+enter inside the description), esc cancels
//   create  same panel and rules. api.create({ type, ...where }) opens it with defaults from where
//           you clicked: '+ add' at the bottom of a lane cell(that group + that status), '+ task'
//           / '+ group' in the header(current group), '+ board' on the overview. fields come from
//           dal.template.<type>, the save goes to dal.api.create. 'create + another' keeps the
//           group/status and clears the rest for typing a batch(ctrl+shift+enter)
//   cli     edit YAHZ-3 => view.api.edit({ taskId:'YAHZ-3' })
//           create task / create group => view.api.create({ type:'task' }), then set/save as below
//           set status done / save / cancel => view.api.setField('column','done'), saveEdit(), cancelEdit()
//           one shot without the editor => dal.api.edit({ type:'task', id:'YAHZ-3', changes:{ column:'done' } })
//
// views
//   boards: every board as a card with its group tree and rollup counts(all-boards-mockup)
//   kanban: one board or group. columns across the top, one swimlane per child group with
//           that child's whole subtree rolled up into it. this is what fixes the overflow:
//           a lane collapses to a single row of counts, and done lanes start collapsed
class NabnakRenderer {
  #dal
  #root
  // selection lives here, not in the dal(same reasoning as the old _.state comment)
  state = {
    view: 'boards',   // 'boards' | 'kanban'
    boardId: null,
    groupId: null,    // null while viewing a whole board
    taskId: null,     // expanded card
    lanes: {},        // laneId => true(collapsed)/false(expanded), only what the user toggled
    edit: null,       // { mode:'update'|'create', type, id, context, title, fields, draft, errors:{ key:[] }, general:[] }
    notice: null,     // one line of feedback after a save
  }
  #focusField = null  // field to focus after the next render(editor just opened)
  constructor(args) {
    if (!args?.dal) { throw Error('NabnakRenderer needs { dal }') }
    this.#dal = args.dal
    this.#root = args.root ?? document.body
    this.#root.classList.add('nabnak')
    // one listener for the whole module, elements just carry data-action/data-id
    this.#root.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]')
      if (!target || !this.#root.contains(target)) { return }
      const handler = this.onClick[target.dataset.action]
      if (handler) { e.preventDefault(); handler(e, target.dataset) }
    })
    // editor input: update the draft in place, no re-render(it would steal the caret).
    // the one exception is the group pick, the status options depend on it
    const onInput = (e) => {
      const key = e.target.dataset?.field
      if (!key || !this.state.edit) { return }
      this.#setDraft(key, e.target.value)
      if (key === 'groupId') { this.#render(); return }
      const wrap = e.target.closest('.nabnak-field')
      wrap?.classList.toggle('dirty', this.#isDirty(key))
      wrap?.classList.remove('has-error')
      wrap?.querySelector('.nabnak-field-error')?.remove()
      this.#updateSaveLabel()
    }
    this.#root.addEventListener('input', onInput)
    this.#root.addEventListener('keydown', (e) => {
      if (!this.state.edit || !e.target.closest?.('.nabnak-editor')) { return }
      const inTextarea = e.target.tagName === 'TEXTAREA'
      if (e.key === 'Escape') { e.preventDefault(); this.api.cancelEdit() }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); this.api.saveEdit({ another:true }) }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (!inTextarea && !e.shiftKey && e.target.tagName !== 'BUTTON'))) {
        e.preventDefault(); this.api.saveEdit()
      }
    })
    this.#dal.subscribe(() => this.#render())
  }
  // what a cli command calls. every method re-renders so callers dont have to
  api = {
    render: () => this.#render(),
    showBoards: () => { this.state.view = 'boards'; this.state.taskId = null; this.#render() },
    // { boardId } for a whole board, { groupId } for a group(board is worked out)
    select: (args) => {
      if (args?.groupId) {
        const view = this.#dal.format.view({ groupId: args.groupId })
        if (!view.success) { return view }
        this.state.boardId = view.node.boardId
        this.state.groupId = args.groupId
      } else if (args?.boardId) {
        if (!this.#dal.format.view({ boardId: args.boardId }).success) { return {success:false,errors:[`board '${args.boardId}' not found`]} }
        this.state.boardId = args.boardId
        this.state.groupId = null
      }
      this.state.view = 'kanban'
      this.state.taskId = null
      this.#render()
      return {success:true}
    },
    selectTask: (id) => { this.state.taskId = this.state.taskId === id ? null : id; this.#render() },
    // id is the lane key: the group id for a subgroup lane, 'direct:<id>' / 'ungrouped:<id>' otherwise
    toggleLane: (id) => {
      const view = this.#currentView()
      const lane = view?.lanes.find(l => this.#laneKey(l) === id)
      this.state.lanes[id] = !(lane ? this.#isCollapsed(lane, view.columns) : this.state.lanes[id])
      this.#render()
    },
    collapseAll: () => this.#setAllLanes(true),
    expandAll: () => this.#setAllLanes(false),

    // ---- update workflow ----
    edit: (args) => {
      let type, id
      if (args?.taskId) { type = 'task'; id = args.taskId }
      else if (args?.groupId) { type = 'group'; id = args.groupId }
      else if (args?.boardId) { type = 'board'; id = args.boardId }
      else if (this.state.taskId) { type = 'task'; id = this.state.taskId }
      else if (this.state.groupId) { type = 'group'; id = this.state.groupId }
      else if (this.state.boardId) { type = 'board'; id = this.state.boardId }
      else { return {success:false, errors:['nothing selected to edit']} }

      const current = this.state.edit
      if (current?.mode === 'update' && current?.type === type && current?.id === id) { return {success:true} }
      const busy = this.#refuseIfDirty()
      if (busy) { return busy }
      const d = this.#dal.describe[type]({ id })
      if (!d.success) { return d }
      this.state.edit = {
        mode:'update', type, id, title:d.title, fields:d.fields,
        draft:Object.fromEntries(d.fields.map(f => [f.key, this.#toInput(f.value)])),
        errors:{}, general:[],
      }
      if (type === 'task') { this.state.taskId = id }
      this.state.notice = null
      this.#focusField = d.fields.find(f => !f.readonly)?.key ?? null
      this.#render()
      return {success:true}
    },
    // { type:'task'|'group'|'board', boardId?, groupId?, parentGroupId?, column? }. anything left
    // out comes from the current selection: a task goes in the group you're looking at, a group
    // under it
    create: (args = {}) => {
      const type = args.type ?? 'task'
      const boardId = args.boardId ?? this.state.boardId
      const context = type === 'task' ? { boardId, groupId:args.groupId ?? this.state.groupId ?? undefined, column:args.column }
        : type === 'group' ? { boardId, parentGroupId:args.parentGroupId ?? this.state.groupId ?? undefined }
        : {}
      if (type !== 'board' && !boardId) { return {success:false, errors:[`open a board first to create a ${type}`]} }
      const busy = this.#refuseIfDirty()
      if (busy) { return busy }
      const t = this.#dal.template[type]?.(context)
      if (!t?.success) { return t ?? {success:false, errors:[`type '${type}' cant be created`]} }
      this.state.edit = {
        mode:'create', type, id:null, context, title:t.title, fields:t.fields,
        draft:Object.fromEntries(t.fields.map(f => [f.key, this.#toInput(f.value)])),
        errors:{}, general:[],
      }
      this.state.notice = null
      this.#focusField = 'name'
      this.#render()
      return {success:true}
    },
    // what 'set <field> <value>' calls. accepts the label too('status' for column)
    setField: (key, value) => {
      if (!this.state.edit) { return {success:false, errors:['no edit open']} }
      const field = this.state.edit.fields.find(f => f.key === key || f.label === key)
      if (!field) { return {success:false, errors:[`no field '${key}', fields: ${this.state.edit.fields.map(f => f.label).join(', ')}`]} }
      this.#setDraft(field.key, Array.isArray(value) ? value.join(', ') : String(value ?? ''))
      this.#render()
      return {success:true}
    },
    // { another:true } on a create keeps the panel open for the next one
    saveEdit: (opts = {}) => {
      const edit = this.state.edit
      if (!edit) { return {success:false, errors:['no edit open']} }
      if (edit.mode === 'create') { return this.#saveCreate(edit, opts.another === true) }
      const keys = this.#dirtyKeys()
      if (!keys.length) { this.api.cancelEdit(); return {success:true, changed:[]} }
      const changes = Object.fromEntries(keys.map(k => [k, edit.draft[k]]))
      const base = Object.fromEntries(keys.map(k => [k, edit.fields.find(f => f.key === k).value]))
      // close first: the dal notifies during the call and the render should show the result
      this.state.edit = null
      const res = this.#dal.api.edit({ type:edit.type, id:edit.id, changes, base })
      if (!res.success) {
        // conflicts: take the current value as the new base, so saving again is a deliberate
        // 'keep mine' instead of failing forever
        const fresh = this.#dal.describe[edit.type]({ id:edit.id })
        const errors = res.fields ?? {}
        const fields = edit.fields.map(f => {
          const now = fresh.success && fresh.fields.find(x => x.key === f.key)
          if (!now || !errors[f.key]?.some(m => m.startsWith('changed elsewhere'))) { return f }
          errors[f.key] = errors[f.key].map(m => m.startsWith('changed elsewhere') ? `${m}. save again to keep yours` : m)
          return { ...f, value:now.value }
        })
        this.state.edit = { ...edit, fields, errors, general:res.errors ?? [] }
        this.#focusField = Object.keys(res.fields ?? {})[0] ?? null
      } else {
        this.state.notice = `saved ${edit.type} '${edit.title}': ${res.changed.map(k => edit.fields.find(f => f.key === k)?.label ?? k).join(', ')}`
      }
      this.#render()
      return res
    },
    cancelEdit: () => {
      if (!this.state.edit) { return {success:false, errors:['no edit open']} }
      this.state.edit = null
      this.#render()
      return {success:true}
    },
  }
  onClick = {
    boards: () => this.api.showBoards(),
    board: (e, data) => this.api.select({ boardId: data.id }),
    group: (e, data) => this.api.select({ groupId: data.id }),
    // the first click re-renders the card, so a real dblclick event never fires on it. the
    // second click's detail count survives the re-render
    task: (e, data) => e.detail >= 2 ? this.api.edit({ taskId: data.id }) : this.api.selectTask(data.id),
    lane: (e, data) => this.api.toggleLane(data.id),
    edit: (e, data) => this.api.edit({ [`${data.type}Id`]: data.id }),
    save: () => this.api.saveEdit(),
    saveAnother: () => this.api.saveEdit({ another:true }),
    create: (e, data) => this.api.create({ type:data.type, boardId:data.board, groupId:data.group, parentGroupId:data.parent, column:data.column }),
    cancel: () => this.api.cancelEdit(),
    expandAll: () => this.api.expandAll(),
    collapseAll: () => this.api.collapseAll(),
  }

  #currentView() {
    if (this.state.view !== 'kanban') { return null }
    const view = this.state.groupId
      ? this.#dal.format.view({ groupId: this.state.groupId })
      : this.#dal.format.view({ boardId: this.state.boardId })
    return view.success ? view : null
  }
  #setAllLanes(collapsed) {
    for (const lane of this.#currentView()?.lanes ?? []) { this.state.lanes[this.#laneKey(lane)] = collapsed }
    this.#render()
  }
  // a group's own tasks(direct lane) and the group's rolled up lane in its parent's view
  // share an id, so they need different keys or collapsing one collapses the other
  #laneKey(lane) { return lane.type === 'group' ? lane.id : `${lane.type}:${lane.id}` }
  // empty lanes and lanes where everything is in the last column start collapsed
  #isCollapsed(lane, columns) {
    const key = this.#laneKey(lane)
    if (Object.hasOwn(this.state.lanes, key)) { return this.state.lanes[key] }
    if (lane.type !== 'group') { return false }
    return lane.total === 0 || lane.counts[columns[columns.length - 1]] === lane.total
  }

  #render() {
    const all = this.#dal.format.all()
    // selection can go stale after a delete, fall back instead of drawing nothing
    let view = this.#currentView()
    if (this.state.view === 'kanban' && !view) {
      this.state.groupId = null
      this.state.boardId = all.boards.find(b => b.id === this.state.boardId)?.id ?? null
      view = this.state.boardId ? this.#currentView() : null
      if (!view) { this.state.view = 'boards' }
    }
    // a re-render(dal change from the cli, group pick) shouldnt yank the caret out of the editor
    const active = document.activeElement
    const keep = this.#root.contains(active) && active.dataset?.field
      ? { key:active.dataset.field, start:active.selectionStart, end:active.selectionEnd } : null

    const main = this.state.view === 'kanban' ? this.#kanban(view) : this.#overview(all)
    this.#root.replaceChildren(this.#sidebar(all), main)

    const focusKey = this.#focusField ?? keep?.key
    this.#focusField = null
    const input = focusKey && this.#root.querySelector(`.nabnak-editor [data-field="${focusKey}"]`)
    if (input) {
      input.focus()
      try {
        const end = input.value?.length ?? 0
        if (keep?.key === focusKey && keep.start != null) { input.setSelectionRange(keep.start, keep.end) }
        else if (input.setSelectionRange && input.type !== 'date') { input.setSelectionRange(end, end) }
      } catch { /* selects and date inputs dont do selection ranges */ }
    }
  }

  // ---------- sidebar ----------
  #sidebar(all) {
    const side = this.#el('nav', 'nabnak-side')
    const boards = this.#el('div', 'nabnak-side-boards')
    boards.append(this.#el('div', `nabnak-row ${this.state.view === 'boards' ? 'selected' : ''}`, 'all boards', { 'data-action': 'boards' }))
    for (const board of all.boards) {
      const row = this.#el('div', `nabnak-row nabnak-board-name ${board.id === this.state.boardId && this.state.view === 'kanban' && !this.state.groupId ? 'selected' : ''}`,
        null, { 'data-action': 'board', 'data-id': board.id, title: board.description ?? '' })
      row.append(this.#el('span', 'single-line', `${board.slug} ${board.name}`), this.#counts(board.counts, board.total))
      boards.append(row)
    }
    side.append(boards)

    const board = all.boards.find(b => b.id === this.state.boardId)
    if (board && this.state.view === 'kanban') {
      const tree = this.#el('div', 'nabnak-side-tree')
      const ancestors = new Set(this.#currentView()?.breadcrumb.map(b => b.id))
      const walk = (node) => {
        const selected = node.id === this.state.groupId
        const row = this.#el('div', `nabnak-row nabnak-group-name ${selected ? 'selected' : ''} ${ancestors.has(node.id) && !selected ? 'ancestor' : ''}`,
          null, { 'data-action': 'group', 'data-id': node.id, title: node.description ?? '' })
        row.style.paddingLeft = `${4 + node.depth * 12}px`
        row.append(this.#el('span', 'single-line', node.name), this.#counts(node.counts, node.total))
        tree.append(row)
        node.groups.forEach(walk)
      }
      board.groups.forEach(walk)
      if (!board.groups.length) { tree.append(this.#el('div', 'nabnak-muted', 'no groups yet')) }
      side.append(tree)
    }
    return side
  }

  // ---------- all boards ----------
  #overview(all) {
    const main = this.#el('main', 'nabnak-main nabnak-overview')
    const tools = this.#el('div', 'nabnak-overview-tools')
    tools.append(this.#el('span', 'nabnak-link', '+ board', { 'data-action': 'create', 'data-type': 'board' }))
    if (this.state.notice) { tools.append(this.#el('span', 'nabnak-notice', this.state.notice)) }
    main.append(tools)
    if (this.state.edit) { main.append(this.#editor()) }
    if (!all.boards.length) { main.append(this.#el('div', 'nabnak-muted', 'no boards yet')); return main }
    for (const board of all.boards) {
      const editing = this.state.edit?.type === 'board' && this.state.edit.id === board.id
      const card = this.#el('section', `nabnak-board-card ${editing ? 'editing' : ''}`)
      const head = this.#el('div', 'nabnak-card-head', null, { 'data-action': 'board', 'data-id': board.id })
      head.append(this.#el('span', 'nabnak-board-name single-line', `${board.slug} ${board.name}`), this.#counts(board.counts, board.total))
      card.append(head)
      card.append(this.#el('span', 'nabnak-link nabnak-small', 'edit', { 'data-action': 'edit', 'data-type': 'board', 'data-id': board.id }))
      if (board.description) { card.append(this.#el('div', 'nabnak-desc single-line', board.description)) }
      if (board.tags.length) { card.append(this.#tags(board.tags)) }
      const list = this.#el('div', 'nabnak-overview-groups')
      const walk = (node) => {
        const row = this.#el('div', 'nabnak-row nabnak-group-name', null, { 'data-action': 'group', 'data-id': node.id })
        row.style.paddingLeft = `${4 + node.depth * 12}px`
        row.append(this.#el('span', 'single-line', node.name), this.#counts(node.counts, node.total))
        list.append(row)
        node.groups.forEach(walk)
      }
      board.groups.forEach(walk)
      if (board.ungrouped) { list.append(this.#el('div', 'nabnak-muted', `${board.ungrouped} ungrouped task(s)`)) }
      if (!board.groups.length && !board.ungrouped) { list.append(this.#el('div', 'nabnak-muted', 'empty')) }
      card.append(list)
      main.append(card)
    }
    return main
  }

  // ---------- kanban ----------
  #kanban(view) {
    const main = this.#el('main', 'nabnak-main nabnak-kanban')

    const header = this.#el('header', 'nabnak-kanban-head')
    const crumbs = this.#el('div', 'nabnak-crumbs')
    view.breadcrumb.forEach((c, i) => {
      if (i) { crumbs.append(this.#el('span', 'nabnak-muted', ' / ')) }
      crumbs.append(this.#el('span', c.type === 'board' ? 'nabnak-board-name' : 'nabnak-group-name', c.name, { 'data-action': c.type, 'data-id': c.id }))
    })
    const tools = this.#el('span', 'nabnak-tools')
    const here = view.node.type === 'group' ? view.node.id : undefined
    tools.append(
      this.#el('span', 'nabnak-link', '+ task', { 'data-action': 'create', 'data-type': 'task', 'data-board': view.node.boardId, 'data-group': here }),
      this.#el('span', 'nabnak-link', '+ group', { 'data-action': 'create', 'data-type': 'group', 'data-board': view.node.boardId, 'data-parent': here }),
      this.#el('span', 'nabnak-link', `edit ${view.node.type}`, { 'data-action': 'edit', 'data-type': view.node.type, 'data-id': view.node.id }),
      this.#el('span', 'nabnak-link', 'expand all', { 'data-action': 'expandAll' }),
      this.#el('span', 'nabnak-link', 'collapse all', { 'data-action': 'collapseAll' }))
    crumbs.append(tools)
    header.append(crumbs)
    if (view.node.description) { header.append(this.#el('div', 'nabnak-desc nabnak-pre', view.node.description)) }
    if (this.state.notice) { header.append(this.#el('div', 'nabnak-notice', this.state.notice)) }
    main.append(header)
    if (this.state.edit) { main.append(this.#editor()) }

    const grid = this.#el('div', 'nabnak-grid')
    grid.style.gridTemplateColumns = `repeat(${view.columns.length}, minmax(180px, 1fr))`
    for (const column of view.columns) {
      const head = this.#el('div', `nabnak-col-head nabnak-col-${column}`)
      head.append(this.#el('span', null, this.#columnLabel(column)), this.#el('span', 'nabnak-muted', ` ${view.counts[column]}`))
      grid.append(head)
    }

    // the direct lane is noise when empty, unless there are no subgroups(then it's the only
    // place a '+ add' can live)
    const hasGroupLanes = view.lanes.some(l => l.type === 'group')
    const lanes = view.lanes.filter(l => l.type === 'group' || l.total > 0 || (l.type === 'direct' && !hasGroupLanes))
    if (!lanes.length) {
      const empty = this.#el('div', 'nabnak-muted nabnak-span', 'no tasks here yet')
      grid.append(empty)
    }
    for (const lane of lanes) {
      const collapsed = this.#isCollapsed(lane, view.columns)
      const head = this.#el('div', `nabnak-lane-head nabnak-span ${collapsed ? 'collapsed' : ''}`)
      head.append(this.#el('span', 'nabnak-caret', collapsed ? '▸' : '▾', { 'data-action': 'lane', 'data-id': this.#laneKey(lane) }))
      if (lane.type === 'group') {
        head.append(this.#el('span', 'nabnak-group-name nabnak-lane-name', lane.name, { 'data-action': 'group', 'data-id': lane.id, title: 'open this group' }))
        if (lane.subgroupCount) { head.append(this.#el('span', 'nabnak-muted', `+${lane.subgroupCount} subgroup${lane.subgroupCount > 1 ? 's' : ''}`)) }
      } else {
        head.append(this.#el('span', 'nabnak-muted nabnak-lane-name', lane.type === 'ungrouped' ? 'ungrouped (no group, so no status yet)' : `directly in ${lane.name}`,
          { 'data-action': 'lane', 'data-id': this.#laneKey(lane) }))
      }
      head.append(this.#counts(lane.counts, lane.total, view.columns))
      grid.append(head)
      if (collapsed) { continue }
      lane.cells.forEach((cell, i) => {
        const cellEl = this.#el('div', `nabnak-cell nabnak-col-${view.columns[i]}`)
        for (const task of cell) { cellEl.append(this.#card(task)) }
        // ungrouped tasks have no status, so only one '+' for that lane
        if (lane.type !== 'ungrouped' || i === 0) {
          cellEl.append(this.#el('div', 'nabnak-add', '+ add', { 'data-action': 'create', 'data-type': 'task', 'data-board': view.node.boardId,
            'data-group': lane.type === 'ungrouped' ? '' : lane.id, 'data-column': lane.type === 'ungrouped' ? undefined : view.columns[i] }))
        }
        grid.append(cellEl)
      })
    }
    main.append(grid)
    return main
  }

  #card(task) {
    const selected = task.id === this.state.taskId
    const editing = this.state.edit?.type === 'task' && this.state.edit.id === task.id
    const card = this.#el('div', `nabnak-card ${selected ? 'selected-task' : ''} ${editing ? 'editing' : ''}`, null, { 'data-action': 'task', 'data-id': task.id, title: 'double click to edit' })
    const meta = this.#el('div', 'nabnak-card-meta nabnak-card-meta-row')
    const metaText = this.#el('span', 'single-line')
    metaText.append(this.#el('span', 'nabnak-task-id', task.id))
    for (const p of (selected ? task.fullPath : task.path)) { metaText.append(this.#el('span', 'nabnak-group-name', ` ${p.name}`)) }
    meta.append(metaText)
    if (selected && !editing) { meta.append(this.#el('span', 'nabnak-link', 'edit', { 'data-action': 'edit', 'data-type': 'task', 'data-id': task.id })) }
    if (editing) { meta.append(this.#el('span', 'nabnak-editing-tag', 'editing')) }
    card.append(meta)
    card.append(this.#el('div', `nabnak-task-name ${selected ? '' : 'single-line'}`, task.name))

    const dates = this.#el('div', 'nabnak-card-dates')
    dates.append(this.#el('span', null, 'created '), this.#el('b', null, this.#day(task.date_created)))
    if (task.date_due) {
      const overdue = !task.date_completed && new Date(task.date_due) < new Date()
      dates.append(this.#el('span', null, ' · due '), this.#el('b', overdue ? 'nabnak-overdue' : null, this.#day(task.date_due)))
    }
    if (selected && task.date_updated) { dates.append(this.#el('span', null, ' · updated '), this.#el('b', null, this.#day(task.date_updated))) }
    card.append(dates)

    if (task.tags.length) { card.append(this.#tags(task.tags)) }
    if (task.description) { card.append(this.#el('div', `nabnak-desc ${selected ? 'nabnak-pre' : 'single-line'}`, task.description)) }
    return card
  }

  #refuseIfDirty() {
    const current = this.state.edit
    if (!current || !this.#dirtyKeys().length) { return null }
    current.general = [`save or cancel your ${current.mode === 'create' ? `new ${current.type}` : `changes to '${current.title}'`} first`]
    this.#render()
    return {success:false, errors:current.general}
  }
  #saveCreate(edit, another) {
    const values = Object.fromEntries(edit.fields.filter(f => !f.readonly).map(f => [f.key, edit.draft[f.key]]))
    this.state.edit = null
    const res = this.#dal.api.create({ type:edit.type, context:edit.context, values })
    if (!res.success) {
      this.state.edit = { ...edit, errors:res.fields ?? {}, general:res.errors ?? [] }
      this.#focusField = Object.keys(res.fields ?? {})[0] ?? null
      this.#render()
      return res
    }
    this.state.notice = `created ${edit.type} ${edit.type === 'task' ? `${res.id} ` : ''}'${values.name}'`
    if (edit.type === 'board' && !another) {
      this.api.select({ boardId:res.id })
      this.state.notice = `created board '${values.name}'`
    }
    if (edit.type === 'task') {
      this.state.taskId = res.id
      // make sure the new card is visible: open the lane it landed in
      const view = this.#currentView()
      const lane = view?.lanes.find(l => l.cells.some(c => c.some(t => t.id === res.id)))
      if (lane) { this.state.lanes[this.#laneKey(lane)] = false }
    }
    if (another) {
      // same place, blank fields: the group/status(or parent) the user ended up picking stays
      // '' is a real answer(ungrouped / top level), so it doesnt fall back to the selection
      const next = edit.type === 'task' ? { type:'task', boardId:edit.context.boardId, groupId:values.groupId, column:values.column }
        : edit.type === 'group' ? { type:'group', boardId:edit.context.boardId, parentGroupId:values.parent }
        : { type:'board' }
      const notice = this.state.notice
      this.api.create(next)
      this.state.notice = notice
      this.#render()
    } else {
      this.#render()
    }
    return res
  }

  // ---------- editor ----------
  #editor() {
    const edit = this.state.edit
    const panel = this.#el('section', 'nabnak-editor')
    // re-describe on every render: tells us if the target vanished or a field changed underneath
    const creating = edit.mode === 'create'
    const fresh = creating ? { success:true, fields:[] } : this.#dal.describe[edit.type]({ id: edit.id })

    const head = this.#el('div', 'nabnak-editor-head')
    if (creating) {
      head.append(this.#el('span', 'nabnak-muted', `new ${edit.type}${edit.type === 'board' ? '' : ' in '}`))
      if (edit.type !== 'board') { head.append(this.#el('span', 'nabnak-group-name', edit.title)) }
    } else {
      head.append(this.#el('span', 'nabnak-muted', `editing ${edit.type} `),
        this.#el('span', edit.type === 'task' ? 'nabnak-task-name' : edit.type === 'group' ? 'nabnak-group-name' : 'nabnak-board-name',
          edit.type === 'task' ? `${edit.id} ${edit.title}` : edit.title))
    }
    const actions = this.#el('span', 'nabnak-editor-actions')
    if (fresh.success) { actions.append(this.#el('button', 'nabnak-save', this.#saveLabel(), { 'data-action': 'save', type: 'button' })) }
    if (creating && edit.type !== 'board') { actions.append(this.#el('button', null, 'create + another', { 'data-action': 'saveAnother', type: 'button' })) }
    actions.append(this.#el('button', null, 'cancel', { 'data-action': 'cancel', type: 'button' }),
      this.#el('span', 'nabnak-muted', creating
        ? 'enter create · ctrl+shift+enter create + another · esc cancel'
        : 'enter save · ctrl+enter in description · esc cancel'))
    head.append(actions)
    panel.append(head)

    const general = [...edit.general]
    if (!fresh.success) { general.push(`this ${edit.type} no longer exists, cancel to close`) }
    for (const msg of general) { panel.append(this.#el('div', 'nabnak-field-error', msg)) }
    if (!fresh.success) { return panel }

    const grid = this.#el('div', 'nabnak-editor-grid')
    const left = this.#el('div', 'nabnak-editor-col'), right = this.#el('div', 'nabnak-editor-col')
    for (const field of edit.fields) {
      const wide = field.kind === 'textarea' || field.key === 'name'
      ;(wide ? left : right).append(this.#field(field, fresh.fields.find(f => f.key === field.key)))
    }
    grid.append(left, right)
    panel.append(grid)
    return panel
  }
  #field(field, now) {
    const edit = this.state.edit
    const errors = edit.errors[field.key] ?? []
    const label = field.key === 'column' ? 'status' : field.label
    const wrap = this.#el('label', `nabnak-field ${this.#isDirty(field.key) ? 'dirty' : ''} ${errors.length ? 'has-error' : ''}`)
    wrap.append(this.#el('span', 'nabnak-field-label', `${label}${field.required ? ' *' : ''}`))

    let input
    const value = edit.draft[field.key]
    if (field.readonly) {
      input = this.#el('span', 'nabnak-readonly', value)
    } else if (field.kind === 'textarea') {
      input = this.#el('textarea', null, null, { rows: 8 })
      input.value = value
    } else if (field.kind === 'select') {
      input = this.#el('select')
      const options = this.#optionsFor(field)
      if (!options.length) { input.disabled = true; options.push({ value:'', label:'(pick a group first)' }) }
      for (const o of options) {
        const opt = this.#el('option', null, field.key === 'column' ? this.#columnLabel(o.label) : o.label, { value: o.value })
        if (o.value === value) { opt.selected = true }
        input.append(opt)
      }
    } else {
      input = this.#el('input', null, null, { type: field.kind === 'date' ? 'date' : 'text' })
      if (field.kind === 'tags') { input.placeholder = 'comma, separated' }
      input.value = value
    }
    input.dataset.field = field.key
    wrap.append(input)
    for (const msg of errors) { wrap.append(this.#el('div', 'nabnak-field-error', msg)) }
    // someone(the cli) changed this field since the editor opened
    if (!errors.length && now && JSON.stringify(now.value) !== JSON.stringify(field.value)) {
      wrap.append(this.#el('div', 'nabnak-field-warn', `changed elsewhere, now '${this.#toInput(now.value) || 'empty'}'`))
    }
    return wrap
  }
  // the status options belong to whichever group is picked in the draft
  #optionsFor(field) {
    if (field.dependsOn !== 'groupId') { return [...field.options] }
    const groupField = this.state.edit.fields.find(f => f.key === 'groupId')
    const group = groupField.options.find(o => o.value === this.state.edit.draft.groupId)
    return (group?.columns ?? []).map(c => ({ value:c, label:c }))
  }
  #setDraft(key, value) {
    const edit = this.state.edit
    edit.draft[key] = value
    delete edit.errors[key]
    edit.general = []
    // switching groups: keep the status if the new group has it, else its first column(same
    // rule the dal applies), none when ungrouped
    if (key === 'groupId') {
      const columns = this.#optionsFor(edit.fields.find(f => f.key === 'column')).map(o => o.value)
      if (!columns.includes(edit.draft.column)) { edit.draft.column = columns[0] ?? '' }
      delete edit.errors.column
    }
  }
  #toInput(value) { return Array.isArray(value) ? value.join(', ') : (value ?? '') }
  #isDirty(key) {
    const edit = this.state.edit
    const field = edit?.fields.find(f => f.key === key)
    if (!field || field.readonly) { return false }
    // compare normalized-ish so 'a,b' vs 'a, b' or trailing spaces dont count as changes
    const norm = (v) => field.kind === 'tags' ? v.split(',').map(t => t.trim()).filter(Boolean).join(',')
      : field.kind === 'textarea' ? v.replace(/\s+$/, '') : field.kind === 'text' ? v.trim() : v
    return norm(edit.draft[key]) !== norm(this.#toInput(field.value))
  }
  #dirtyKeys() { return (this.state.edit?.fields ?? []).filter(f => this.#isDirty(f.key)).map(f => f.key) }
  #saveLabel() {
    if (this.state.edit?.mode === 'create') { return 'create' }
    const n = this.#dirtyKeys().length
    return n ? `save (${n})` : 'save'
  }
  #updateSaveLabel() { const btn = this.#root.querySelector('.nabnak-save'); if (btn) { btn.textContent = this.#saveLabel() } }

  #tags(tags) {
    const wrap = this.#el('div', 'nabnak-tags')
    for (const t of tags) { wrap.append(this.#el('span', 'nabnak-tag', t)) }
    return wrap
  }
  // '3 · 1 · 4' colored per column. columns default to whatever keys the counts have
  #counts(counts, total, columns) {
    const wrap = this.#el('span', 'nabnak-counts', null, { title: `${total} task(s)` })
    const names = columns ?? ['todo', 'inprogress', 'done', ...Object.keys(counts).filter(k => !['todo', 'inprogress', 'done'].includes(k))]
    names.forEach((name, i) => {
      if (i) { wrap.append(this.#el('span', 'nabnak-muted', '·')) }
      wrap.append(this.#el('span', `nabnak-count nabnak-col-${name}`, String(counts[name] ?? 0), { title: this.#columnLabel(name) }))
    })
    return wrap
  }

  // tiny dom helper. textContent only(readme todo: no innerText/innerHTML)
  #el(tag, className, text, attrs) {
    const node = document.createElement(tag)
    if (className) { node.className = className.trim().replace(/\s+/g, ' ') }
    if (text != null) { node.textContent = text }
    for (const [k, v] of Object.entries(attrs ?? {})) { if (v != null) { node.setAttribute(k, v) } }
    return node
  }
  #columnLabel(name) {
    return { todo: 'TODO', inprogress: 'In Progress', done: 'Done' }[name] ?? name
  }
  #day(iso) { return iso ? iso.slice(0, 10) : '' }
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { NabnakRenderer } }
