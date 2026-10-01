/*
  260930: so it looks like it doesnt exist, but I thought I implemented the ability to switch out
  sections but I do not... there is no way any of these modules are remove at the moment, and the
  dom structure of the page is static
  since I dont have any tools to replace nabnak in view for now im not going to refactor this yet
  but there is a high chance im going to add a fn or two in the direction of supporting this. 
*/
_.tool.nabnak = {
  parentSelector: '.section-nabnak',
  onLoad: () => {
    console.log('todo: fetch projects json')
    _.tool.nabnak.fn.render()
  },
  onInput: (input) => {},
  data: {
    date_updated: '',
    projects: [],
  },
  fn: {
    // past me put this in .helpers.clear but everything here is a helper. will change if feel like it
    clear: () => {
      // remove html
      const parent = document.querySelector(_.tool.tester.parentSelector)
      while(parent.firstChild) parent.removeChild(parent.firstChild)
    },
    render: () => {

    },
    save: () => {
      console.log('todo: save project data')
    }
  },
  css: `
  
  `,
}