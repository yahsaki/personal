_.module.cpicker = {
  load: (selector) => {
    const root = document.querySelector(selector)
    if (!root) { throw Error(`cpicker.load: failed to find parent element via selector '${selector}'`) }
    
    const parentEl = document.createElement('div')
    parentEl.setAttribute('id', 'cpicker')
    root.append(parentEl)

    const module = { name: 'cpicker', displayName: 'color picker', code: 'CLP', shortcuts: ['cp'] }
    if (_.module.terminal) { _.module.terminal.data.module[module.name] = module }

    _.module.cpicker.setting.parentSelector = selector

    _.fn.updateTitle('Color Picker')
    _.module.cpicker.setCss()
  },
  unload: () => {
    const mod = _.module.cpicker
    const root = document.querySelector(mod.setting.parentSelector)
    if (!root) { throw Error(`cpicker.unload: failed to find parent '${mod.setting.parentSelector}'`) }

    document.getElementById('cpicker').remove()
    document.getElementById('cpicker-style').remove()
  },
  fn: {},
  setCss: () => {
    const style = document.createElement('style')
    style.setAttribute('data-module', 'cpicker')
    style.setAttribute('id', 'cpicker-style')
    style.innerText = `
    :root {
      --bg: #f4f4f6; --panel: #ffffff; --text: #1c1c22; --muted: #6b6b76;
      --border: #dcdce2; --input: #fafafb; --focus: #3b6cf6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #141418; --panel: #1e1e24; --text: #ececf1; --muted: #9a9aa6;
        --border: #33333c; --input: #26262d; --focus: #6d92ff;
      }
    }
    * { box-sizing: border-box; }
    .cpicker {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: var(--bg); color: var(--text);
      font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
    }
    .cpicker .picker {
      width: 100%; max-width: 340px; background: var(--panel);
      border: 1px solid var(--border); border-radius: 14px; padding: 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,.08); display: grid; gap: 14px;
    }
    .cpicker .checker {
      background-color: #fff;
      background-image:
        linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%),
        linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%);
      background-size: 12px 12px; background-position: 0 0, 6px 6px;
    }
    .cpicker #sv {
      position: relative; height: 200px; border-radius: 10px; cursor: crosshair;
      touch-action: none; outline: none;
      background-image: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
    }
    .cpicker #sv:focus-visible { box-shadow: 0 0 0 2px var(--focus); }
    .cpicker .thumb {
      position: absolute; width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.3);
      transform: translate(-50%, -50%); pointer-events: none;
    }
    .cpicker .row { display: flex; gap: 12px; align-items: center; }
    .cpicker .sliders { flex: 1; display: grid; gap: 10px; }
    .cpicker .slider {
      position: relative; height: 14px; border-radius: 7px; cursor: pointer;
      touch-action: none; outline: none;
    }
    .cpicker .slider:focus-visible { box-shadow: 0 0 0 2px var(--focus); }
    .cpicker .slider .thumb { top: 50%; width: 18px; height: 18px; }
    .cpicker #hue { background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
    .cpicker #alphaWrap { position: relative; border-radius: 7px; overflow: visible; }
    .cpicker #alpha { position: relative; }
    .cpicker #alphaFill { position: absolute; inset: 0; border-radius: 7px; }
    .cpicker .swatch {
      width: 44px; height: 44px; border-radius: 10px; border: 1px solid var(--border);
      position: relative; overflow: hidden; flex: none;
    }
    .cpicker .swatch > div { position: absolute; inset: 0; }
    .cpicker .fields { display: grid; gap: 8px; }
    .cpicker .field { display: grid; grid-template-columns: 44px 1fr auto; gap: 8px; align-items: center; }
    .cpicker .field label { color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: .04em; }
    .cpicker input[type=text] {
      width: 100%; min-width: 0; padding: 7px 9px; border-radius: 7px;
      border: 1px solid var(--border); background: var(--input); color: var(--text);
      font: 13px ui-monospace, "Cascadia Mono", Consolas, monospace;
    }
    .cpicker input[type=text]:focus { outline: none; border-color: var(--focus); }
    .cpicker input.invalid { border-color: #e5484d; }
    .cpicker button {
      border: 1px solid var(--border); background: var(--input); color: var(--text);
      border-radius: 7px; padding: 6px 10px; font: inherit; font-size: 12px; cursor: pointer;
    }
    .cpicker button:hover { border-color: var(--focus); }
    .cpicker .section-title { font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
    .cpicker .palette { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
    .cpicker .palette button {
      padding: 0; aspect-ratio: 1; border-radius: 6px; position: relative; overflow: hidden;
    }
    .cpicker .palette button span { position: absolute; inset: 0; }
    .cpicker .toast {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: var(--text); color: var(--bg); padding: 8px 14px; border-radius: 8px;
      font-size: 13px; opacity: 0; transition: .2s; pointer-events: none;
    }
    .cpicker .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    `
  },
  setting: {
    // I really dont like this naming convention. this means, is this module
    // something that can load as a view. while text scrollers are technically
    // a tool, they cant be 'used' in the sense of this, nabnak, tester, etc
    //tool: true,
    // alirght changing this to an enum that doesnt live in a single place
    // (which is worse than a bool in a sense)
    // nabnak, tester and color picker are tools, text scroller and graph
    // are widgets
    type: 'tool', // tool, widget
  },
}