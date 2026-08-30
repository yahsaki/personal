_.load.dialog = () => {
  _.current.css = () => {
    const style = document.createElement('style')
    style.setAttribute('id', 'dialog')
    style.innerText = `
    html {
      background-color: #222529;
      color: #e1e4e8;
    }
    .dialog-close-btn {
      cursor: pointer;
    }
    `
    document.head.append(style)
  }
  _.current.html = () => {
    const html = document.createElement('div')
    html.setAttribute('id', 'content')
    html.innerHTML = `
    <button id="open-dialog-btn">open dialog</button>
    `
    document.body.append(html)
  }
  _.current.script = () => {
    
  }

  _.mode = 'dialog'
}