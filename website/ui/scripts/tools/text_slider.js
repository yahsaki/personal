_.tool.text_slider = {
  onLoad: () => {
    const tool = {
      name: 'ts',
      displayName: 'text slider',
      code: 'SLD',
    }
    _.module.tool[tool.code] = tool
    _.module.command[tool.name] = () => { _.module.fn.command[tool.name]() }
    _.module.fn.command[tool.name] = _.tool.text_slider.fn.onInput

    _.tool.text_slider.data.intervalId = setInterval(_.tool.text_slider.fn.doMaintenance, 1000)

    // gotta handle my own css it seems
    const style = document.createElement('style')
    style.setAttribute('id', tool.code)
    style.innerText = _.tool.text_slider.css
    document.head.append(style)

    // fetch data
    setTimeout(() => {
      fetch('/data/text_slider.json')
        .then(x => x.json())
        .then(x => {
          console.log('got articles', x)
          _.tool.text_slider.data.sliderContent = x
          // lets autoload articles here
          _.tool.text_slider.fn.loadSomeSliders()
        })
    }, 500)

  },
  data: {
    // this doesnt seem like the best place to put this lol
    canvas: document.createElement('canvas'),
    intervalId: null,
    contentMaxLength: 500,
    config: {
      baseSpeed: 7500,
      m0: 8, // lol dont ask me what these mean
      m1: 11,
    },
    textSliders: [],
    sliderContent: [
      {title:'some text stolen from a book it looks like',content:'The Caterpillar and Alice looked at each other for some time in silence: at last the Caterpillar took the hookah out of its mouth, and addressed her in a languid, sleepy voice.'},
      {title:'RANDOM',content:'This is some random text typed by me on an M4800 keyboard for testing this new stuff im learning and devloping right now weeeeee.'},
    ],
  },
  fn: {
    onInput: args => {
      console.log('commands passed to text slider tool', args)

    },
    loadSomeSliders: () => {
      // TODO: randomize(fn already implemented, we do so with tests)
      /*_.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider4',
        data: _.module.helpers.shuffle(_.tool.text_slider.data.sliderContent.latest['Bleeping Computer'].data),
        config: _.tool.text_slider.data.config,
      })
      // three of the same CVE sliders baby LETS GOOOOOOOO
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider5',
        data: _.module.helpers.shuffle(_.tool.text_slider.data.sliderContent.cve),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider5',
        data: _.module.helpers.shuffle([..._.tool.text_slider.data.sliderContent.cve]),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider5',
        data: _.module.helpers.shuffle([..._.tool.text_slider.data.sliderContent.cve]),
        config: _.tool.text_slider.data.config,
      })
      
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider3',
        data: _.module.helpers.shuffle(
          _.tool.text_slider.data.sliderContent.historic_random['CIA Archive'].data.map(x => {
            return {
              title: `${x.documentNumber} - ${x.title}`,
              text: x.text,
              date: x.date.publish ?? x.date.release
            }
          })
        ),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider3',
        data: _.module.helpers.shuffle(
          [..._.tool.text_slider.data.sliderContent.historic_random['CIA Archive'].data.map(x => {
            return {
              title: `${x.documentNumber} - ${x.title}`,
              text: x.text,
              date: x.date.publish ?? x.date.release
            }
          })]
        ),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider3',
        data: _.module.helpers.shuffle(
          [..._.tool.text_slider.data.sliderContent.historic_random['CIA Archive'].data.map(x => {
            return {
              title: `${x.documentNumber} - ${x.title}`,
              text: x.text,
              date: x.date.publish ?? x.date.release
            }
          })]
        ),
        config: _.tool.text_slider.data.config,
      })

      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider7',
        data: _.module.helpers.shuffle(_.tool.text_slider.data.sliderContent.latest['Torrent Freak'].data),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider0',
        data: _.module.helpers.shuffle(_.tool.text_slider.data.sliderContent.latest['CISA Cybersecurity'].data),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider1',
        data: _.module.helpers.shuffle(_.tool.text_slider.data.sliderContent.latest['Whitehouse Actions'].data),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider1',
        data: _.module.helpers.shuffle(_.tool.text_slider.data.sliderContent.latest['Whitehouse Legislations'].data),
        config: _.tool.text_slider.data.config,
      })
      _.tool.text_slider.fn.createTextSlider({
        parentSelector: '.section-textslider1',
        data: _.module.helpers.shuffle(_.tool.text_slider.data.sliderContent.latest['Whitehouse Statements'].data),
        config: _.tool.text_slider.data.config,
      })*/
    },
    doMaintenance: () => {
      try {
        const textSliderDeleteArr = []
        for (let i = 0; i < _.tool.text_slider.data.textSliders.length; i++) {
          const ts = _.tool.text_slider.data.textSliders[i]

          const el = document.getElementById(ts.id)
          if (el) continue
          
          const displayText = ts.data[ts.index].content.substr(ts.contentIndex, _.tool.text_slider.data.contentMaxLength)
          ts.contentIndex += _.tool.text_slider.data.contentMaxLength

          _.tool.text_slider.fn.animate({
            id: ts.id,
            parentSelector: ts.parentSelector,
            data: ts.data[ts.index],
            config: ts.config,
            cb: () => {
              if (ts.contentIndex >= ts.data[ts.index].content.length) {
                ts.index += 1
                ts.executions += 1
                ts.contentIndex = 0
              }
              
              if (ts.index >= ts.data.length) {
                console.log('reset index')
                ts.index = 0
              }
            },
          })
        }
      } catch (err) {
        console.error(err)
        clearInterval(_.tool.text_slider.data.intervalId)
        console.error('disabled interval')
      }
    },
    createTextSlider: (args) => {
      const parentSelector = args.parentSelector
      const data = args.data
      const config = args.config

      const el = document.querySelector(parentSelector)
      if (!el) {
        const log = `failed to find element '${parentSelector}'`
        _.module.helpers.prepend(log);console.error(log);return
      }
      // hack: its a hack
      const maxWidth = el.clientWidth
      el.setAttribute('style', `width:${maxWidth}px`)

      if (!Array.isArray(data)) {
        const log = `data must be an array, received '${typeof data}'`
        _.module.helpers.prepend(log);console.error(log);return
      }
      for (let i = 0; i < data.length; i++) {
        // ive never gone this far for other implementations. I feel like im going to goof this one
        // a lot though
        if (!data[i].title.length || typeof data[i].title !== 'string') {
          const log = `text slider data requires populated string title`
          _.module.helpers.prepend(log);console.error(log);return
        }
        if (!data[i].text.length || typeof data[i].text !== 'string') {
          const log = `text slider data requires populated string content`
          _.module.helpers.prepend(log);console.error(log);return
        }
      }
      const slider = {
        id: `text-slider_${_.tool.text_slider.data.textSliders.length}_${new Date().toISOString()}`,
        parentSelector,
        index: 0,
        contentIndex: 0,
        executions: 0,
        data,
        config,
      }
      _.tool.text_slider.data.textSliders.push(slider)

      console.log(`slider '${slider.id}' created`)
      return
    },
    animate: (args) => {
      const id = args.id
      const parentSelector = args.parentSelector
      const data = args.data
      const config = args.config
      const cb = args.cb

      const parent = document.querySelector(parentSelector)
      if (!parent) {
        const log = `text slider parent '${parentSelector}' doesnt exists`
        _.module.helpers.prepend(log);console.error(log);return
      }
      let container = document.getElementById(id)
      if (container) {
        const log = `text slider '${id}' already exists`
        _.module.helpers.prepend(log);console.error(log);return
      }

      container = _.module.helpers.createElement('div', [
        {name:'class',val:'text-slider-container'},
        {name:'id',val:id},
      ],null,parent)
      const titleWrapper = _.module.helpers.createElement('div',[
        {name:'class',val:'text-slider-title-wrapper'},
        {name:'title',val:data.title},
      ],null,container)
      const linkWrapper = _.module.helpers.createElement('div',[{name:'class',val:'text-slider-title-link-wrapper'}],null,titleWrapper)
      const link = _.module.helpers.createElement('a',[
        {name:'class',val:'text-slider-blink'},
        {name:'target',val:'_blank'},
      ],'[»]',linkWrapper)
      const title = _.module.helpers.createElement('div',[{name:'class',val:'text-slider-title-text'}],data.title,titleWrapper)

      const maxWidth = parent.clientWidth
      //parent.setAttribute('style', `width:${maxWidth-10}px`)
      const slider = _.module.helpers.createElement('div',[
        {name:'class',val:'text-slider-content'},
        {name:'style',val:`width:${maxWidth-10}px`},
      ],data.text,container)

      const textWidth = _.tool.text_slider.fn.getTextWidth(slider.textContent, _.tool.text_slider.fn.getCanvasFont(slider))
      const ms = config.baseSpeed + (data.text.length * config.m0) * config.m1
      //console.log(`${id} width: ${textWidth}`)
      const aoi = slider.animate(
        [
          {marginLeft: '100%',width: '300%'},
          {marginLeft: `-${Math.floor(textWidth)}px`,width: '100%'}
        ],
        ms
      )
      aoi.onfinish = (event) => {
        //console.log('animation complete')
        document.getElementById(id).remove()
        // dead line here
        if (typeof cb === 'function') cb()
      }
    },
    getTextWidth: (text, font) => {
      const context = _.tool.text_slider.data.canvas.getContext("2d")
      context.font = font
      const metrics = context.measureText(text)
      return metrics.width
    },
    getCssStyle: (el, prop) => {
      return window.getComputedStyle(el, null).getPropertyValue(prop)
    },
    getCanvasFont: (el = document.body) => {
      const fontWeight = _.tool.text_slider.fn.getCssStyle(el, 'font-weight') || 'normal'
      const fontSize = _.tool.text_slider.fn.getCssStyle(el, 'font-size') || '12px'
      const fontFamily = _.tool.text_slider.fn.getCssStyle(el, 'font-family') || 'Times New Roman'

      return `${fontWeight} ${fontSize} ${fontFamily}`
    },
  },
  css: `
    .text-slider-container {
      white-space: nowrap;
      overflow: hidden;
      margin: 2px;
    }
    .text-slider-red {
      border: 1px solid red;
    }
    .text-slider-green {
      border: 1px solid green;
    }
    .text-slider-title-wrapper {
      display: flex;
      font-size: 10px;
      font-weight: bold;
    }
    .text-slider-title-link-wrapper {}
    .text-slider-title-link {}
    .text-slider-title-text {
      cursor: help;
    }
    .text-slider-wrapper {}
    .text-slider-content {}

    .text-slider-blink {
      animation: blinker 1s linear infinite;
      color: yellow;
    }
  `,
}
