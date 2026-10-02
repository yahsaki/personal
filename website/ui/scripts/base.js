_.fn.clean = () => {
  const head = document.querySelector('head')
  while(head.firstChild) head.removeChild(head.firstChild)
  const body = document.querySelector('body')
  for (let i = 0; i < body.children.length; i++) {
    if (body.children[i].localName !== 'script') {
      body.children[i].remove()
    }
  }
}
_.fn.load = (viewName) => {
  console.log(`_.fn.load: attempting to load view '${viewName}'`)
  if (!_.view[viewName]) {
    console.error(`_.fn.load: failed to find view '${viewName}'`);return
  }
}

_.fn.buildBase = () => {
  _.fn.clean()

  const title = document.createElement('title')
  title.innerText = 'YAHSAKI | BASE'
  document.head.append(title)

  const charset = document.createElement('meta')
  charset.setAttribute('charset', 'utf-8')
  document.head.append(charset)

  const html = document.createElement('div')
  html.setAttribute('class', 'base-container')

  html.innerHTML = `
<div class="base-item base-section-content"></div>
<div class="base-item base-section-terminal"></div>
<div class="base-item base-section-text-scroller0 text-scroller"></div>
<div class="base-item base-section-text-scroller1 text-scroller"></div>
<div class="base-item base-section-tester"></div>
  `
  document.body.append(html)

  const style = document.createElement('style')
  style.setAttribute('id', 'base-css')
  style.innerText = `
html {
  background-color: #222529;
  color: #e1e4e8;
  font-size: 12px;
}
.base-container {
  display: grid;
  grid-template-columns: repeat(19, minmax(50px, auto));
  grid-auto-rows: 10px;
  border 1px solid black;
  column-gap: 2px;
  row-gap: 2px;
}
.base-item {
  box-sizing: border-box;
}
.base-section-content {
  border: 1px solid red;
  grid-column: 1 / 16;
  grid-row: 1 / 18;
}
.base-section-terminal {
  border: 1px solid blue;
  overflow-y:auto;
  grid-column: 16 / 20;
  grid-row: 1 /16;
}
.text-scroller {
  max-height: 30px;
}
.base-section-text-scroller0 {
  border: 1px solid yellow;
  grid-column: 1 / 8;
  grid-row: 18 / 20;
}
.base-section-text-scroller1 {
  border: 1px solid yellow;
  grid-column: 8 / 16;
  grid-row: 18 / 20;
}
.base-section-tester {
  border: 1px solid green;
  grid-column: 16 / 20;
  grid-row: 16 / 20;
}
  `
  document.head.append(style)

  // this assumes .html was already executed
  document.querySelector('.base-container').setAttribute('style', `height:${window.innerHeight - 20}px;`)
  window.addEventListener('resize', () => {
    // TODO: fix this dupe code. also we need to be able to unbind this if home is ever unloaded
    document.querySelector('.base-container').setAttribute('style', `height:${window.innerHeight - 20}px;`)
  })
}