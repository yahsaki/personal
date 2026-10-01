_.tool.tester = {
  // TODO: get this selector elsewhere smartly
  parentSelector: '.section-tester',
  onLoad: () => {
    // setup whatever is needed to be invoked here
    const tool = {
      name: 'tester',
      displayName: undefined,
      code: 'TSR',
    }
    /*
     240220: We disablin loading tester and will autoload it for now

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
   */
    //console.log(`${tool.displayName || tool.name} loaded(TODO: load test manifest here)`)

    // 240220: autoload tester
    //setTimeout(() => { _.tool.tester.fn.loadHome() }, 200)

    // TODO: put CSS set logic in known location. both text_slider and this tool does same thing
    const style = document.createElement('style')
    style.setAttribute('id', tool.code)
    style.innerText = _.tool.tester.css
    document.head.append(style)

    // fetch tests
    fetch('/data/tests.json')
      .then(x => x.json())
      .then(x => {
        console.log('got tests', x)
        _.tool.tester.data.tests = x
        _.tool.tester.fn.loadHome()
      })
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
      const options = []
      for (let i = 0; i < _.tool.tester.data.tests.length; i++) {
        const test = _.tool.tester.data.tests[i]
        if (~test.testTypes.indexOf('flashcard')) {
          options.push(`<option value="flashcard~~${test.label}">flcd:${test.label}</option>`)
        }
        if (~test.testTypes.indexOf('input')) {
          options.push(`<option value="input~~${test.label}">nput:${test.label}</option>`)
        }
      }
      _.tool.tester.fn.helpers.update(`
<div>
  <div>
    <input type="checkbox" id="tsr-cb-flashcard-repeat" name="tsr-cb-flashcard-repeat" checked />
    <label for="tsr-cb-flashcard-repeat">repeat flashcard</label>
  </div>
  <select id="tsr-select" style="width:42px;">
    ${options.join('')}
  </select>
  <button id="tsr-btn-start">START</button>
</div>
      `)
      document.querySelector('#tsr-btn-start').addEventListener('click', function(e) {
        console.log('clicked tester start button')
        const val = document.querySelector('#tsr-select').value
        if (!val) {
          _.module.helpers.prepend('no test selected')
          console.error('no test selected')
          return
        }
        // HACK if ive ever seen one
        const arr = val.split('~~')
        const name = arr[1]
        const type = arr[0]

        const test = _.tool.tester.data.tests.find(x => x.label === name)
        if (!test) {
          const error = `failed to load test '${name}' type '${type}' in tool's data`;_.module.helpers.prepend(error);console.error(error);return
        }
        // kinda weird how we're doing this tbqh, but its cleaner ultimately
        const questions = test.data.map(x => x)
        _.tool.tester.data.stack.push({
          ...test,
          questions: _.module.helpers.shuffle(questions),
        })
        console.log('initialing this test', _.tool.tester.data.stack[0])
        switch (type) {
          case 'flashcard': {
            const repeat = document.getElementById('tsr-cb-flashcard-repeat').checked
            console.log('repeat?', repeat)
            _.tool.tester.data.stack[0].repeat = repeat
            _.tool.tester.fn.processTestFlashcard()
          } break
          case 'input': {
            _.tool.tester.fn.processTestInput()
          } break
          default: {
            const error = `invalid test type '${type}'`
            _.module.helpers.prepend(error)
            console.error(error)
          } break
        }

      })
      _.module.helpers.trigger(document.querySelector('#tsr-select'), 'focus')
    },
    processTestInput: (submittedAnswer = null, submitted = false) => {
      if (!_.tool.tester.data.stack.length) {
        console.log('nothing in stack, loading home page')
        _.tool.tester.fn.loadHome()
        return
      }
      const test = _.tool.tester.data.stack[0]

      if (_.tool.tester.data.stack.length > 1) {
        let question = _.tool.tester.data.stack[_.tool.tester.data.stack.length - 1]
        if (submitted) {
          question.submittedAnswer = submittedAnswer
          console.log('submitted answer', submittedAnswer, typeof submittedAnswer)
          let correct = false
          if (Array.isArray(question.answer.val)) {
            correct = ~question.answer.val.indexOf(submittedAnswer)
          } else {
            correct = submittedAnswer === question.answer.val
          }
          if (correct) {
            _.tool.tester.fn.helpers.update(`
<div>
  <p style="color:green;"><b>ATARI!</b></p>
</div>
            `,{bindQuit:true})
            setTimeout(_.tool.tester.fn.processTestInput, 1000)
          } else {
            _.tool.tester.fn.helpers.update(`
<div>
  <p><b style="color:red;">WRONG!</b> the answer is <span class="tsr-answer-val">'${Array.isArray(question.answer.val) ? question.answer.val.join(', ') : question.answer.val}'</span></p>
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
          if (question.submittedAnswer == null) {
            console.log('question', question)
            const html = `
<div>
  <button id="tsr-btn-quit">QUIT</button>
  <p title="${test.description}">${test.label}: <b>${test.questions.length}</b></p>
  <p>question: <span class="tsr-question-val">${question.question.val}</span></p>
  <input id="tsr-input" style="width:42px;" />
  <button id="tsr-btn-submit">submit</button>
</div>
            `
            _.tool.tester.fn.helpers.update(html,{bindQuit:true})
            document.querySelector('#tsr-btn-submit').addEventListener('click', () => {
              const submittedAnswer = document.querySelector('#tsr-input').value
              _.tool.tester.fn.processTestInput(submittedAnswer, true)
            })
            document.onkeypress = function(e) {
              //console.log('onkeypress', e.keyCode)
              if (e.keyCode === 13) {
                const submittedAnswer = document.querySelector('#tsr-input').value
                _.tool.tester.fn.processTestInput(submittedAnswer, true)
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
          let correct = false
          if (Array.isArray(question.answer.val)) {
            correct = ~question.answer.val.indexOf(question.submittedAnswer)
          } else {
            correct = question.submittedAnswer === question.answer.val
          }
          if (correct) { correctAnswers += 1 }
        }
        const percentage = correctAnswers/(_.tool.tester.data.stack.length-1)*100
        _.module.helpers.prepend(`${percentage}%, ${correctAnswers} out of ${_.tool.tester.data.stack.length-1} correct`)
        _.module.helpers.prepend(`${test.label} - final score:`)
        _.tool.tester.data.stack.length = 0
        _.tool.tester.fn.loadHome()
        return
      }
      question = test.questions.splice(0, 1)[0]
      question.submittedAnswer = null
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
  <p title="${test.description}">${test.label}</p>
  <p>question: <span class="tsr-question-val">${question.question.val}</span></p>
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
  <p title="${test.description}">${test.label}</p>
  <p>question: <span class="tsr-question-val">${question.question.val}</span></p>
  <p>answer: ${Array.isArray(question.answer.val) ? question.answer.val.join(', ') : question.answer.val}</p>
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
        if (!_.tool.tester.data.stack[0].repeat) {
          _.tool.tester.data.stack.length = 0
          _.tool.tester.fn.processTestFlashcard()
          return
        }

        const test = {..._.tool.tester.data.stack[0]}
        const questions = test.data.map(x => x)
        console.log('test is repeating', test, questions)
        // this is weird so blow away the stack and recreate
        _.tool.tester.data.stack.length = 0
        _.tool.tester.data.stack.push({
          ...test,
          questions: _.module.helpers.shuffle(questions),
        })
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
.tsr {}
.tsr-question-val {
  font-size: 16px;
}
.tsr-answer-val {
  font-size: 16px;
}
  `
}
