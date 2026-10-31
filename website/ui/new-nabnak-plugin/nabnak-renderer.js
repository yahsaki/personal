// draws whatever dal.format.* hands it. never reads dal state directly and never writes to the
// dal, so every mutation still goes through dal.api(cli first) and then you call render().
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
  }
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
  }
  onClick = {
    boards: () => this.api.showBoards(),
    board: (e, data) => this.api.select({ boardId: data.id }),
    group: (e, data) => this.api.select({ groupId: data.id }),
    task: (e, data) => this.api.selectTask(data.id),
    lane: (e, data) => this.api.toggleLane(data.id),
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
    const main = this.state.view === 'kanban' ? this.#kanban(view) : this.#overview(all)
    this.#root.replaceChildren(this.#sidebar(all), main)
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
    if (!all.boards.length) { main.append(this.#el('div', 'nabnak-muted', 'no boards yet')); return main }
    for (const board of all.boards) {
      const card = this.#el('section', 'nabnak-board-card')
      const head = this.#el('div', 'nabnak-card-head', null, { 'data-action': 'board', 'data-id': board.id })
      head.append(this.#el('span', 'nabnak-board-name single-line', `${board.slug} ${board.name}`), this.#counts(board.counts, board.total))
      card.append(head)
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
    tools.append(this.#el('span', 'nabnak-link', 'expand all', { 'data-action': 'expandAll' }), this.#el('span', 'nabnak-link', 'collapse all', { 'data-action': 'collapseAll' }))
    crumbs.append(tools)
    header.append(crumbs)
    if (view.node.description) { header.append(this.#el('div', 'nabnak-desc', view.node.description)) }
    main.append(header)

    const grid = this.#el('div', 'nabnak-grid')
    grid.style.gridTemplateColumns = `repeat(${view.columns.length}, minmax(180px, 1fr))`
    for (const column of view.columns) {
      const head = this.#el('div', `nabnak-col-head nabnak-col-${column}`)
      head.append(this.#el('span', null, this.#columnLabel(column)), this.#el('span', 'nabnak-muted', ` ${view.counts[column]}`))
      grid.append(head)
    }

    const lanes = view.lanes.filter(l => l.type === 'group' || l.total > 0)
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
        grid.append(cellEl)
      })
    }
    main.append(grid)
    return main
  }

  #card(task) {
    const selected = task.id === this.state.taskId
    const card = this.#el('div', `nabnak-card ${selected ? 'selected-task' : ''}`, null, { 'data-action': 'task', 'data-id': task.id })
    const meta = this.#el('div', 'nabnak-card-meta single-line')
    meta.append(this.#el('span', 'nabnak-task-id', task.id))
    for (const p of (selected ? task.fullPath : task.path)) { meta.append(this.#el('span', 'nabnak-group-name', ` ${p.name}`)) }
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
    for (const [k, v] of Object.entries(attrs ?? {})) { node.setAttribute(k, v) }
    return node
  }
  #columnLabel(name) {
    return { todo: 'TODO', inprogress: 'In Progress', done: 'Done' }[name] ?? name
  }
  #day(iso) { return iso ? iso.slice(0, 10) : '' }
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { NabnakRenderer } }
