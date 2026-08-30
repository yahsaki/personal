_.tool.tester = {
  // TODO: get this selector elsewhere smartly
  parentSelector: '#s0',
  onLoad: () => {
    // setup whatever is needed to be invoked here
    const tool = {
      name: 'tester',
      displayName: undefined,
      code: 'TSR',
    }
    // add tool
    _.module.tool[tool.code] = tool
    // map command
    _.module.command[tool.name] = () => { _.module.fn.command[tool.name]() }
    // create command
    _.module.fn.command[tool.name] = (args) => {
      _.module.fn.updateCurrentModule(tool.code)
      _.module.helpers.prepend(`switched to ${tool.displayName || tool.name} mode`)
      // here we would need to create tester in its own area. current design is supposed
      // to be tiny unlike cli which consumed its entire area
      _.tool.tester.fn.loadHome()
    }
 
    //console.log(`${tool.displayName || tool.name} loaded(TODO: load test manifest here)`)
  },
  onInput: (input) => {
    // aiming to use fn.onInput
    console.log('tool.onInput called, use tool.fn.onInput instead')
  },
  data: {
    mode: null,
    // works by adding to it. for example, i0 would be the selected test and
    // the rest of the indexes would be the position in said test
    stack: [],
    enum: {
      mode: {
        
      },
    },
    intervalId: null,
    tests: [
      {
        name: 'lern werds',
        description: 'learn words with flashcards V0 lETS GO',
        type: 'flashcard',
        questions: [
          {key:'uchi',val:'house'},
          {key:'butt',val:'dogg'},
          {key:'booshi',val:'hat'},
          {key:'kaisha',val:'company'},
        ],
      },
      {
        name: 'lern werds NPUT',
        description: 'learn words by typing',
        type: 'input',
        questions: [
          {key:'uchi',val:'house'},
          {key:'butt',val:'dogg'},
          {key:'booshi',val:'hat'},
          {key:'kaisha',val:'company'},
        ],
      },
      {
        name: 'lern werds v2',
        description: 'learn words by typing',
        type: 'input',
        questions: [
          {key:'りんご',val:'apple'},
          {key:'かいしゃ',val:'office'},
          {key:'いぬ',val:'dog'},
          {key:'うち',val:'house'},
        ],
      }
    ],
  },
  fn: {
    helpers: {
      update: (html, options = {}) => {
        const bindQuit = options.bindQuit
        const parent = document.querySelector(_.tool.tester.parentSelector)
        if (!parent) {
          throw Error(`failed to find parent to put html in. selctor: '${_.tool.tester.parentSelector}'`)
        }
        parent.innerHTML = html
        if (bindQuit) {
          const quitButton = document.querySelector('#tsr-btn-quit')
          if (quitButton) {
            quitButton.addEventListener('click', () => {
              console.log('quit button pressed')
              _.tool.tester.data.stack.length = 0
              _.tool.tester.fn.loadHome()
            })
          }
        }
      },
      clear: () => {
        // remove html
        const parent = document.querySelector(_.tool.tester.parentSelector)
        while(parent.firstChild) parent.removeChild(parent.firstChild)
      },
      cleanup: () => {
        // .clear + remove CSS(and anything else if needed)
        const parent = document.querySelector(_.tool.tester.parentSelector)
        while(parent.firstChild) parent.removeChild(parent.firstChild)
      },
    },
    loadHome: () => {
      _.tool.tester.fn.helpers.clear()
      console.log('loading initial page or whatever', _.tool.tester.data.tests.length)
      // create select list and submit button
      // TODO: support more than just flashcard and options to customize tests of course
      // TODO: dynamically put tests uinder options of course
      _.tool.tester.fn.helpers.update(`
<div>
  <select id="tsr-select">
    <option>lern werds v2</option>
    <option>lern werds NPUT</option>
    <option>lern werds</option>
  </select>
  <button id="tsr-btn-start">START</button>
</div>
      `)
      document.querySelector('#tsr-btn-start').addEventListener('click', function(e) {
        console.log('clicked tester start button')
        const name = document.querySelector('#tsr-select').value
        if (!name) {
          _.module.helpers.prepend('no test selected')
          console.error('no test selected')
          return
        }
        const test = _.tool.tester.data.tests.find(x => x.name === name)
        if (!test) {
          const error = `failed to load test '${name}' in tool's data`;_.module.helpers.prepend(error);console.error(error);return
        }
        // kinda weird how we're doing this tbqh, but its cleaner ultimately
        const questions = test.questions.map(x => x)
        _.tool.tester.data.stack.push({
          ...test,
          questions: _.module.helpers.shuffle(questions),
        })
        console.log('initialing this test', _.tool.tester.data.stack[0])
        switch (test.type) {
          case 'flashcard': {
            _.tool.tester.fn.processTestFlashcard()
          } break
          case 'input': {
            _.tool.tester.fn.processTestInput()
          } break
          default: {
            const error = `invalid test type '${test.type}'`
            _.module.helpers.prepend(error)
            console.error(error)
          } break
        }

      })
      _.module.helpers.trigger(document.querySelector('#tsr-select'), 'focus')
    },
    processTestInput: (answer = null, submitted = false) => {
      if (!_.tool.tester.data.stack.length) {
        console.log('nothing in stack, loading home page')
        _.tool.tester.fn.loadHome()
        return
      }
      const test = _.tool.tester.data.stack[0]

      if (_.tool.tester.data.stack.length > 1) {
        let question = _.tool.tester.data.stack[_.tool.tester.data.stack.length - 1]
        if (submitted) {
          question.answer = answer
          console.log('submitted answer', answer)
          if (answer === question.val) {
            _.tool.tester.fn.helpers.update(`
<div>
  <p style="color:green;"><b>CORRECT!</b></p>
</div>
            `,{bindQuit:true})
            setTimeout(_.tool.tester.fn.processTestInput, 1000)
          } else {
            _.tool.tester.fn.helpers.update(`
<div>
  <p><b style="color:red;">WRONG!</b> the answer is '${question.val}'</p>
  <button id="tsr-btn-submit" style="display:none;" title="hiding for now">continue</button>
</div>
            `,{bindQuit:true})
            setTimeout(_.tool.tester.fn.processTestInput, 1500)

            // if someone clicked continue before setTimeout, setTimeout would still trigger
            // causing another process invoke
            /*document.querySelector('#tsr-btn-submit').addEventListener('click', () => {
              if (typeof document.onkeypress === 'function') { document.onkeypress = null }
              _.tool.tester.fn.processTestInput()
            })*/

            // not working for some reason
            /*document.onkeypress = function(e) {
              console.log('wring answer press', e.keyCode)
              if (e.keyCode === 13) {
                _.tool.tester.fn.processTestInput()
                document.onkeypress = null
              }
            }*/
          }
          return
        } else {
          if (!question.answer) {
            console.log('question', question)
            const html = `
<div>
  <button id="tsr-btn-quit">QUIT</button>
  <p title="${test.description}">${test.name}: <b>${test.questions.length}</b></p>
  <p>question: ${question.key}</p>
  <input id="tsr-input" />
  <button id="tsr-btn-submit">submit</button>
</div>
            `
            _.tool.tester.fn.helpers.update(html,{bindQuit:true})
            document.querySelector('#tsr-btn-submit').addEventListener('click', () => {
              const answer = document.querySelector('#tsr-input').value
              _.tool.tester.fn.processTestInput(answer, true)
            })
            document.onkeypress = function(e) {
              //console.log('onkeypress', e.keyCode)
              if (e.keyCode === 13) {
                const answer = document.querySelector('#tsr-input').value
                _.tool.tester.fn.processTestInput(answer, true)
                // for now, always kill the global keypress hook inside the
                // hook itself
                document.onkeypress = null
              }
            }
            _.module.helpers.trigger(document.querySelector('#tsr-input'), 'focus')
            return
          }
        }

        /*if (!question.answer) {
          if (!answer) {
            // user submitted nothing, consider it a fail
          }
          const html = `
  <div>
    <button id="tsr-btn-quit">QUIT</button>
    <p title="${test.description}">${test.name}</p>
    <p>question: ${question.key}</p>
    <input id="tsr-input" />
    <button id="tsr-btn-submit">submit</button>
  </div>
        `
        } else {
          // shouldnt happen normally technically. not 100% sure what to do here yet
        }*/
      }

      console.log('test', test)
      if (!test.questions.length) {
        // its over. TODO: show score
        let correctAnswers = 0
        for (let i = 0; i < _.tool.tester.data.stack.length; i++) {
          if (i === 0) { continue }
          const question = _.tool.tester.data.stack[i]
          if (question.answer === question.val) { correctAnswers += 1 }
        }
        const percentage = correctAnswers/(_.tool.tester.data.stack.length-1)*100
        _.module.helpers.prepend(`${percentage}%, ${correctAnswers} out of ${_.tool.tester.data.stack.length-1} correct`)
        _.module.helpers.prepend(`${test.name} - final score:`)
        _.tool.tester.data.stack.length = 0
        _.tool.tester.fn.loadHome()
        return
      }
      question = test.questions.splice(0, 1)[0]
      question.answer = null
      _.tool.tester.data.stack.push(question)
      _.tool.tester.fn.processTestInput()
    },
    processTestFlashcard: () => {
      if (!_.tool.tester.data.stack.length) {
        console.log('nothing in stack, loading home page')
        _.tool.tester.fn.loadHome()
        return
      }
      const test = _.tool.tester.data.stack[0]

      if (_.tool.tester.data.stack.length > 1) {
        let question = _.tool.tester.data.stack[_.tool.tester.data.stack.length - 1]
        console.log('qes',question)
        if (!question.asked) {
          const html = `
<div>
  <button id="tsr-btn-quit">QUIT</button>
  <p title="${test.description}">${test.name}</p>
  <p>question: ${question.key}</p>
</div>
        `
          _.tool.tester.fn.helpers.update(html,{bindQuit:true})
          question.asked = true
          setTimeout(_.tool.tester.fn.processTestFlashcard, 5000)
          return
        }
        if (!question.answered) {
          const html = `
<div>
  <button id="tsr-btn-quit">QUIT</button>
  <p title="${test.description}">${test.name}</p>
  <p>question: ${question.key}</p>
  <p>answer: ${question.val}</p>
</div>
        `
          _.tool.tester.fn.helpers.update(html,{bindQuit:true})
          question.answered = true
          setTimeout(_.tool.tester.fn.processTestFlashcard, 5000)
          return
        }
      }

      // TODO: pluck questions out of test.questions and add to stack
      // add .asked and .answered to last item. check for that and time appropriately
      if (!test.questions.length) {
        // its over
        _.tool.tester.data.stack.length = 0
        _.tool.tester.fn.processTestFlashcard()
        return
      }
      question = test.questions.splice(0, 1)[0]
      question.asked = false
      question.answered = false
      console.log('q before add', question)
      _.tool.tester.data.stack.push(question)
      setTimeout(_.tool.tester.fn.processTestFlashcard, 1000)
    },
    // respond to button presses
    onButtonPress: function(e) {

    },
    // input tests I guess
    onInput: (input) => {

    },
  },
  css: `
tsr {

}
  `
}
