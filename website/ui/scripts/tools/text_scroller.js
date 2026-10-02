_.tool.textScroller = {
  // since this tool isnt a 'load once and done' like terminal, changing .load to something like .create makes more
  // sense, but for consistency's sake im leaving it as load/unload for now
  load: () => {
    console.log(`textScroller.load: on load, WIP`)
    
    // pointless. we only ever load one instance of this module but we create multiple instances of scrollers. still
    // keeping the id pattern though, for now
    const id = _.tool.textScroller.data.id = crypto.randomUUID()

    // NOTE: this css is not unique to this instance, it is applicable to all instances! this means load executes
    // one time code while
    const style = document.createElement('style')
    style.setAttribute('id', `text-scroller-style-${id}`)
    style.innerText = `
.text-scroller-container {}
.text-scroller-row-0 {
  display: grid;
  grid-template-columns: 1fr 4fr;
}
.text-scroller-date {
  border: 1px solid yellow;
}
.text-scroller-title {
  border: 1px solid yellow;
  font-weight: bold;
  font-size: 8px;
  overflow: hidden;

}
.text-scroller-content {
  word-break: break-all;
  margin: 0;
  height: 22px;
  overflow: hidden;
}
    `
    document.head.append(style)
    console.log(`textScroller.load: load complete`)
  },
  unload: () => {
    // hmmmmm not liking the confusion here. we can remove a text scroller and we can unload the module/tool. unloading
    // removes all instances of scrollers, removeTextScroller only removes an instance of one
    const style = document.getElementById(`text-scroller-style-${id}`)
    if (style) { style.remove() }
    // again, unlike terminal, we need to go through each instance and attempt to remove html
    for (let i = 0; i < _.tool.textScroller.data.instances.length; i++) {
      // we dont have any event listeners yet but if we gain them, we should remove them properly. browsers garbage
      // collect unreferenced ghost event listeners but its not wise to count on that(because we couldve goofed a ref)
    }
    // just blow away the instances object here
    _.tool.textScroller.data.instances.length = 0


    _.tool.textScroller.data.id = null
  },
  fn: {
    valdateData: (data) => {
      const errors = []
      if (!Array.isArray(data)) {
        errors.push(`data argument must be an array with properties title, date and content(required), received '${typeof data}'`)
        return errors
      }
      if (!data.length) {
        errors.push(`data is empty`)
      }
      for (let i = 0; i < data.length; i++) {
        if (!data[i].content?.length) {
          errors.push(`data point at index ${i} has no content(the only required field at the moment)`)
          break
        }
      }
      return errors
    },
    removeTextScroller: (selector) => {},
    createTextScroller: (selector, data) => {
      const parentEl = document.querySelector(selector)
      if (!parentEl) {
        console.error(`textScroller.fn.createTextScroller: failed to find the parent element via selector '${selector}'`);return
      }
      const errors = _.tool.textScroller.fn.valdateData(data)
      if (errors.length) {
        console.error(`textScroller.fn.createTextScroller: error loading data: ${errors.join(', ')}`)
        return
      }
      const instance = {
        selector,
        id: crypto.randomUUID(),
        data,
        intervalId: null,
        index: 0,
      }
      _.tool.textScroller.data.instances.push(instance)

      const html = document.createElement('div')
      html.setAttribute('id', `text-scroller-${instance.id}`)
      html.setAttribute('class', 'text-scroller-container')
      html.innerHTML = `
<div class="text-scroller-row-0">
  <div class="text-scroller-date"></div>
  <div class="text-scroller-title"></div>
</div>
<div class="text-scroller-content"></div>
      `
      parentEl.append(html)
      console.log(`textScroller.fn.createTextScroller: skeleton instantiated. animating...`)
      _.tool.textScroller.fn.animate(instance)
    },
    animate: (instance) => {
      // we have no way to stop/pause scroller at the moment, besides purging everything
      const titleEl = document.querySelector(`#text-scroller-${instance.id} .text-scroller-title`)
      const contentEl = document.querySelector(`#text-scroller-${instance.id} .text-scroller-content`)
      const dateEl = document.querySelector(`#text-scroller-${instance.id} .text-scroller-date`)
      if (!titleEl || !contentEl || !dateEl) {
        console.error(`textScroller.fn.animate: failed to find title(${!!titleEl}), content(${!!contentEl}) or date(${!!dateEl}) element`)
        // TODO: we should remove this scroller entirely, or something
        return
      }

      const blob = instance.data[instance.index]
      if (blob.title?.length) { titleEl.innerText = blob.title }
      if (blob.date?.length) {
        const dateObj = new Date(blob.date)
        if (dateObj instanceof Date && !isNaN(dateObj)) {
          dateEl.innerText = dateObj.toISOString().substring(0, 10)
        } else {
          dateEl.innerText = blob.date
        }
      }
      contentEl.innerText = blob.content

      let position = 0
      const scrollMax = contentEl.scrollTopMax
      const intervalSpan = contentEl.clientWidth / _.tool.textScroller.data.scrollSpeed

      console.log('document.querySelector(`#text-scroller-' + instance.id + ' .text-scroller-content`)' + `.scrollTo({top: 0, left: 0, behavior: 'smooth'})`)
      console.log('textScroller.animate: interval span', intervalSpan)
      instance.intervalId = setInterval(() => {
        position += _.tool.textScroller.data.scrollPixelAmount

        contentEl.scrollTo({
          top: position,
          left: 0,
          behavior: 'smooth'
        })
        //console.log(`scrollMax: ${scrollMax}, position: ${position}, intervalSpan: ${intervalSpan}`)
        if (position >= scrollMax) {
          clearInterval(instance.intervalId)
          setTimeout(() => { _.tool.textScroller.fn.onAnimationCompleted(instance) }, 1000)
        }
      }, intervalSpan)
    },
    onAnimationCompleted: (instance) => {
      instance.index += 1
      if (!instance.data[instance.index]) {
        console.log(`textScroller.fn.onAnimationCompleted: text scroller '${instance.id}' has completed rendering data ${instance.data.length} blobs. starting over`)
        instance.index = 0
        _.tool.textScroller.fn.animate(instance)
      } else {
        _.tool.textScroller.fn.animate(instance)
      }
    },
  },
  data: {
    id: null,
    // how many pixels to scroll each iteration. I never seen a reason to go higher than one; just adjust loop timing
    // instead
    scrollPixelAmount: 1,
    // lower = slower. naming+value doesnt make much sense but it works, dont know what else to name it
    scrollSpeed: 5.3, 
    // shiza, just realized we cant instantiate more than one terminal tool due to data.parentSelector, need something
    // like this for that to work
    instances: [],
  }
}