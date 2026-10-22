_.module.nabnak_render = {
  load: () => {
    _.logger.log('nabnak renderer loaded')
    if (_.module.nabnak) {
      // render something I guess
    } else {
      _.logger.log('nabnak not loaded')
    }
  }
}