_.tool.image_slider = {
  onLoad: () => {
    const tool = {
      name: 'image_slider',
      displayName: 'Image Slider',
      code: 'ISD',
    }
    // add tool
    _.module.tool[tool.code] = tool
    // map command
    _.module.command[tool.name] = () => { _.module.fn.command[tool.name]() }
    // create command
    _.module.fn.command[tool.name] = (args) => {

    }

    setTimeout(() => {
      _.tool.image_slider.fn.createImageSlider({ parentSelector: '.section-imageslider0', images: ['image0.png','image1.png'], })
    }, 1000)
  },
  fn: {
    onInput: (args) => {},
    createImageSlider: (args) => {
      const parentSelector = args.parentSelector
      const images = args.images
      //const config = args.config
      // TODO: validation

      const slider = {
        id: `image_slider_${_.tool.image_slider.data.imageSliders.length}`,
        parentSelector,
        images,
        index: 0,
        speed: 5000,
      }
      _.tool.image_slider.data.imageSliders.push(slider)
      _.tool.image_slider.fn.rotateSlider(slider.id)
    },
    rotateSlider: id => {
      const slider = _.tool.image_slider.data.imageSliders.find(x => x.id === id)
      if (!slider) { console.error(`failed to find slider by id '${id}'`);return }

      const parent = document.querySelector(slider.parentSelector)
      if (!parent) { console.error(`failed to find parent '${silder.parentSelector}'`);return }

      if (slider.index >= slider.images.length-1) { slider.index = 0 }
      else { slider.index += 1 }

      const imageName = slider.images[slider.index]

      // I cant stop fighting with grids and auto widths/heights so make background image
      /*while(parent.firstChild) parent.removeChild(parent.firstChild)
      setTimeout(() => {
        const img = _.module.helpers.createElement('img', [
          {name: 'src', val: `${imageName}` },
          {name: 'style', val: 'width:inherit;height:inherit' }
        ], null, parent)
        setTimeout(() => { _.tool.image_slider.fn.rotateSlider(slider.id) }, slider.speed)
      }, 1000)*/

      // background image crap
      parent.style.backgroundImage = ''
      setTimeout(() => {
        parent.style.backgroundImage = `url(${imageName})`
        setTimeout(() => { _.tool.image_slider.fn.rotateSlider(slider.id) }, slider.speed)
      }, 1000)
    },
  },
  data: {
    imageSliders: [],
  },
  css: ``,
}
