// run with: node dal.test.js
// loads the same nabnak-dal.js the page uses, so this can't drift from what's rendered
const { NabnakDal } = require('./nabnak-dal.js')

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`) }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`) }
}
function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected)
  if (a !== b) { throw Error(`${msg} expected ${b}, got ${a}`) }
}
function ok(res, msg = '') { if (!res?.success) { throw Error(`${msg} ${JSON.stringify(res?.errors ?? res)}`) } return res }
function fails(res, includes) {
  if (res?.success) { throw Error(`expected failure containing '${includes}'`) }
  if (!res.errors.join('|').includes(includes)) { throw Error(`errors ${JSON.stringify(res.errors)} dont mention '${includes}'`) }
}

// yahbsite
//   nabnak
//     dal
//       tests
//     renderer
//   ideas
// kikosaki
//   ideas            <- same name, different board, must be allowed
function seed() {
  const dal = new NabnakDal({ quiet: true })
  ok(dal.api.board.create({ board: { name: 'yahbsite', slug: 'YAHZ' } }))
  ok(dal.api.board.create({ board: { name: 'kikosaki', slug: 'KIKO' } }))
  const nabnak = ok(dal.api.board.group.create({ group: { name: 'nabnak', parentId: 'yahbsite' } })).data.id
  const dalG = ok(dal.api.group.group.create({ group: { name: 'dal', parentId: nabnak } })).data.id
  const tests = ok(dal.api.group.group.create({ group: { name: 'tests', parentId: dalG } })).data.id
  const renderer = ok(dal.api.group.group.create({ group: { name: 'renderer', parentId: nabnak } })).data.id
  const ideas = ok(dal.api.board.group.create({ group: { name: 'ideas', parentId: 'yahbsite' } })).data.id
  const kIdeas = ok(dal.api.board.group.create({ group: { name: 'Ideas', parentId: 'kikosaki' } })).data.id
  const t = (name, groupId, column, boardId = 'yahbsite') =>
    ok(dal.api.task.create({ task: { boardId, groupId, column, name } })).data.id
  const ids = {
    nabnakTask: t('nabnak direct', nabnak, 'todo'),
    dalTask: t('dal work', dalG, 'inprogress'),
    testTask: t('write tests', tests, 'done'),
    renderTask: t('draw lanes', renderer, 'todo'),
    ideaTask: t('an idea', ideas, 'todo'),
    loose: t('loose task', undefined, undefined),
    kikoTask: t('kiko idea', kIdeas, 'todo', 'kikosaki'),
  }
  return { dal, g: { nabnak, dal: dalG, tests, renderer, ideas, kIdeas }, ids }
}

console.log('\ngroup ids and names')
test('group ids are scoped to the board', () => {
  const { g } = seed()
  eq(g.nabnak, 'yahbsite/nabnak'); eq(g.tests, 'yahbsite/tests'); eq(g.kIdeas, 'kikosaki/ideas')
})
test('same group name on one board is rejected (case insensitive)', () => {
  const { dal } = seed()
  fails(dal.api.board.group.create({ group: { name: 'IDEAS', parentId: 'yahbsite' } }), 'already')
  // nested groups count too, names are unique per board not per parent
  fails(dal.api.group.group.create({ group: { name: 'Tests', parentId: 'yahbsite/ideas' } }), 'already')
})
test('missing group name returns an error instead of throwing', () => {
  const { dal } = seed()
  fails(dal.api.board.group.create({ group: { parentId: 'yahbsite' } }), 'name required')
})
test('group.update writes description to description (not name)', () => {
  const { dal, g } = seed()
  ok(dal.api.group.update({ group: { id: g.dal, description: 'data access' } }))
  const group = dal.api.group.get({ id: g.dal }).group
  eq(group.name, 'dal'); eq(group.description, 'data access')
})
test('group rename refuses a name already on the board', () => {
  const { dal, g } = seed()
  fails(dal.api.group.update({ group: { id: g.dal, name: 'Renderer' } }), 'already has')
  ok(dal.api.group.update({ group: { id: g.dal, name: 'data layer' } }))
})

console.log('\nmoving groups')
test('move group into another group', () => {
  const { dal, g } = seed()
  ok(dal.api.group.move({ id: g.ideas, toGroupId: g.nabnak, index: 0 }))
  const nabnak = dal.api.group.get({ id: g.nabnak }).group
  eq(nabnak.groups.map(x => x.id), [g.ideas, g.dal, g.renderer])
  eq(dal.api.board.get({ id: 'yahbsite' }).board.groups.map(x => x.id), [g.nabnak])
  eq(dal.helper.verify(), [])
})
test('move group back to the board top level', () => {
  const { dal, g } = seed()
  ok(dal.api.group.move({ id: g.tests, toBoardId: 'yahbsite' }))
  eq(dal.api.board.get({ id: 'yahbsite' }).board.groups.map(x => x.id), [g.nabnak, g.ideas, g.tests])
  eq(dal.helper.verify(), [])
})
test('cant move a group into itself or its own subgroup', () => {
  const { dal, g } = seed()
  fails(dal.api.group.move({ id: g.nabnak, toGroupId: g.nabnak }), 'into itself')
  fails(dal.api.group.move({ id: g.nabnak, toGroupId: g.tests }), 'own subgroup')
})
test('cant move a group to another board', () => {
  const { dal, g } = seed()
  fails(dal.api.group.move({ id: g.ideas, toGroupId: g.kIdeas }), 'cant move it to board')
  fails(dal.api.group.move({ id: g.ideas, toBoardId: 'kikosaki' }), 'cant move it to board')
})
test('nested group shift via group.group.shift', () => {
  const { dal, g } = seed()
  ok(dal.api.group.group.shift({ groupId: g.renderer, location: -1 }))
  eq(dal.api.group.get({ id: g.nabnak }).group.groups.map(x => x.id), [g.renderer, g.dal])
})

console.log('\ndeleting')
test('group delete refuses to orphan children', () => {
  const { dal, g } = seed()
  fails(dal.api.group.delete({ id: g.dal }), 'subgroup')
})
test('recursive group delete removes subtree, tasks become ungrouped', () => {
  const { dal, g, ids } = seed()
  ok(dal.api.group.delete({ id: g.dal, recursive: true }))
  eq(dal.api.group.get({ id: g.tests }), {})
  eq(dal.helper.verify(), [])
  const view = dal.format.view({ boardId: 'yahbsite' })
  const ungrouped = view.lanes.find(l => l.type === 'ungrouped').cells.flat().map(t => t.id)
  eq(ungrouped.sort(), [ids.dalTask, ids.loose, ids.testTask].sort())
})
test('board delete refuses unless recursive, recursive cleans everything', () => {
  const { dal } = seed()
  fails(dal.api.board.delete({ id: 'kikosaki' }), 'recursive')
  ok(dal.api.board.delete({ id: 'kikosaki', recursive: true }))
  eq(dal.data.groups.filter(x => x.id.startsWith('kikosaki/')), [])
  eq(dal.data.tasks.filter(x => x.boardId === 'kikosaki'), [])
  eq(dal.helper.verify(), [])
})

console.log('\nmoving tasks')
test('change a task column (status)', () => {
  const { dal, g, ids } = seed()
  ok(dal.api.group.task.move({ groupId: g.renderer, taskId: ids.renderTask, column: 'done' }))
  eq(dal.format.view({ groupId: g.renderer }).lanes[0].counts, { todo: 0, inprogress: 0, done: 1 })
  eq(dal.helper.verify(), [])
})
test('move a task to another group keeps its column', () => {
  const { dal, g, ids } = seed()
  ok(dal.api.group.task.move({ groupId: g.dal, taskId: ids.dalTask, toGroupId: g.renderer }))
  const lane = dal.format.view({ groupId: g.renderer }).lanes[0]
  eq(lane.counts, { todo: 1, inprogress: 1, done: 0 })
  eq(dal.helper.verify(), [])
})
test('cant move a task to a group on another board', () => {
  const { dal, g, ids } = seed()
  fails(dal.api.group.task.move({ groupId: g.dal, taskId: ids.dalTask, toGroupId: g.kIdeas }), 'not on board')
})

console.log('\nformat (what the renderer reads)')
test('format.all rolls counts up the tree', () => {
  const { dal } = seed()
  const yah = dal.format.all().boards[0]
  eq(yah.counts, { todo: 3, inprogress: 1, done: 1 }, 'grouped')
  eq(yah.ungrouped, 1); eq(yah.total, 6)
  const nabnak = yah.groups[0]
  eq(nabnak.counts, { todo: 2, inprogress: 1, done: 1 })
  eq(nabnak.groups.map(x => [x.name, x.depth, x.total]), [['dal', 1, 2], ['renderer', 1, 1]])
  eq(nabnak.groups[0].groups[0].name, 'tests')
})
test('format.view on a group: direct lane + one lane per child', () => {
  const { dal, g, ids } = seed()
  const v = dal.format.view({ groupId: g.nabnak })
  eq(v.columns, ['todo', 'inprogress', 'done'])
  eq(v.breadcrumb.map(x => x.name), ['yahbsite', 'nabnak'])
  eq(v.lanes.map(l => [l.type, l.name, l.total]), [['direct', 'nabnak', 1], ['group', 'dal', 2], ['group', 'renderer', 1]])
  const dalLane = v.lanes[1]
  eq(dalLane.subgroupCount, 1)
  // the tests task sits in dal/tests: path shows 'tests' (the lane itself is implied)
  const testCard = dalLane.cells[2][0]
  eq([testCard.id, testCard.path.map(p => p.name)], [ids.testTask, ['tests']])
})
test('format.view on a board: ungrouped lane first', () => {
  const { dal, ids } = seed()
  const v = dal.format.view({ boardId: 'yahbsite' })
  eq(v.lanes.map(l => l.name), ['ungrouped', 'nabnak', 'ideas'])
  eq(v.lanes[0].cells[0].map(t => t.id), [ids.loose])
  eq(v.total, 6)
})
test('a task gets one home group: add refuses a second one', () => {
  const { dal, g, ids } = seed()
  fails(dal.api.group.task.add({ groupId: g.renderer, taskId: ids.dalTask }), 'already lives in group')
  fails(dal.api.group.task.add({ groupId: g.dal, taskId: ids.dalTask }), 'already belongs to group')
})
test('an ungrouped task can be given a home with add', () => {
  const { dal, g, ids } = seed()
  ok(dal.api.group.task.add({ groupId: g.ideas, taskId: ids.loose, column: 'inprogress' }))
  eq(dal.format.task({ id: ids.loose }).task.column, 'inprogress')
  eq(dal.format.view({ boardId: 'yahbsite' }).lanes[0].total, 0)
  eq(dal.helper.verify(), [])
})
test('format.task reports the single home and its column', () => {
  const { dal, g, ids } = seed()
  const t = dal.format.task({ id: ids.testTask }).task
  eq([t.groupId, t.column, t.path.map(p => p.name)], [g.tests, 'done', ['nabnak', 'dal', 'tests']])
  eq(dal.format.task({ id: ids.loose }).task.groupId, null)
})
test('hydrate rejects a task with two home groups', () => {
  const { dal, g, ids } = seed()
  const data = dal.data
  const renderer = data.groups.find(x => x.id === g.renderer)
  renderer.tasks.push({ id: ids.dalTask }); renderer.columns[0].items.push({ id: ids.dalTask })
  let threw = null
  try { new NabnakDal({ hydrate: true, quiet: true, ...data }) } catch (e) { threw = e.message }
  if (!threw?.includes('one home group')) { throw Error(`expected one-home failure, got ${threw}`) }
})
test('subgroup column not in parent gets appended', () => {
  const { dal, g } = seed()
  // no column api yet, so poke one in through hydrate
  const data = dal.data
  data.groups.find(x => x.id === g.renderer).columns.push({ name: 'blocked', items: [] })
  const dal2 = new NabnakDal({ hydrate: true, quiet: true, ...data })
  eq(dal2.format.view({ groupId: g.nabnak }).columns, ['todo', 'inprogress', 'done', 'blocked'])
})
test('format output is a copy, mutating it doesnt touch the dal', () => {
  const { dal, g } = seed()
  const v = dal.format.view({ groupId: g.nabnak })
  v.lanes[1].cells[1][0].name = 'hacked'
  eq(dal.format.view({ groupId: g.nabnak }).lanes[1].cells[1][0].name, 'dal work')
})

console.log('\nhydrate')
test('round trip through dal.data', () => {
  const { dal, g } = seed()
  const dal2 = new NabnakDal({ hydrate: true, quiet: true, ...dal.data })
  eq(dal2.format.all(), dal.format.all())
  eq(dal2.format.view({ groupId: g.nabnak }), dal.format.view({ groupId: g.nabnak }))
})
test('hydrate rejects broken refs (the old test data had one)', () => {
  const { dal, g } = seed()
  const data = dal.data
  // child says its parent is 'ideas' but nabnak still lists it
  data.groups.find(x => x.id === g.dal).parentId = g.ideas
  let threw = null
  try { new NabnakDal({ hydrate: true, quiet: true, ...data }) } catch (e) { threw = e.message }
  if (!threw?.includes('integrity')) { throw Error('expected integrity failure') }
})
test('hydrate rejects a parent cycle', () => {
  const { dal, g } = seed()
  const data = dal.data
  const nabnak = data.groups.find(x => x.id === g.nabnak)
  nabnak.parentType = 'group'; nabnak.parentId = g.tests
  let threw = null
  try { new NabnakDal({ hydrate: true, quiet: true, ...data }) } catch (e) { threw = e.message }
  if (!threw?.includes('never reaches a board')) { throw Error(`expected cycle failure, got ${threw}`) }
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
