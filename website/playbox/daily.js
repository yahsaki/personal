 
const request = require('./toys/request')
//const request2 = require('./toys/request2')
const url = require('url')
const cheerio = require('cheerio')
const fs = require('fs')
const util = require('./toys/util')
const path = require('path')
const scraper = require('./toys/scraper')
const zlib = require('zlib')
const klaw = require('klaw')

runMeDaily()
async function runMeDaily() {
  //await scraper.cisaCyberSecurity()
  //await scraper.cisaNews()
  //await scraper.whitehouseActions()
  //await scraper.whitehouseStatements()
  // dead
  //await scraper.whitehouseLegislations()
  //await scraper.cve()
  await scraper.bleeper()
  await scraper.torrentFreak()
  await util.delay(1000)
  
  await aggregate()
}

//aggregate()
async function aggregate() {
  // man just going with the flow, dont know how tf this should be
  const schema = {
    sources: {
      "Bleeping Computer": {
        dataDirName: 'bleepingcomputer',
        dataType: 'generic', // need a way to separate articles from other, so this
        type: 'article',
        weight: 10, // 10 highest, 0 lowest? forget this for now
        data: [], // we'll gen diff batches from this directly
      },
      "Torrent Freak": {
        dataDirName: 'torrentfreak',
        dataType: 'generic',
        type: 'article',
        data: [],
      },
      "CISA Cybersecurity": {
        dataDirName: 'cisa-cybersec',
        dataType: 'generic',
        //type: 'gov', // eh.... dont like this type(no pun intended)
        type: 'cisa', // eh.... better I guess. just something to differenciate from articles and whitehouse statements(YUCK)
        data: [],
      },
      "CISA News": {
        dataDirName: 'cisa-news',
        dataType: 'generic',
        type: 'cisa',
        data: [],
      },
      "Whitehouse Actions": {
        dataDirName: 'whitehouse-actions',
        dataType: 'generic',
        type: 'whitehouse',
        data: [],
      },
      /*"Whitehouse Legislations": {
        dataDirName: 'whitehouse-legislations',
        dataType: 'generic',
        type: 'whitehouse',
        data: [],
      },*/
      "Whitehouse Statements": {
        dataDirName: 'whitehouse-statements',
        dataType: 'generic',
        type: 'whitehouse',
        data: [],
      },
      "CIA Archive": {
        dataDirName: 'CIA',
        // this format will probably not apply to the next historic aggregation
        dataType: 'historic-cia',
        // unlike generic, historic will never have a 'latest' category so it will never be
        // aggregated that way. best way I can think of is to gen <n> random releases whenever
        data: [],
      },
    }
  }


  //const res = await aggregateGeneric('bleepingcomputer')
  //util.fs.writeJson('./test.json', res)
  //const cia = await util.aggregate.cia_historic()
  //const cve = await util.aggregate.cve() // need to find old code for this

  // alright, as for data points, we dont want named files in the output; everything in output
  // should be assumed upon, so no <source name>.json, just latest.json, all.json, tests.json, etc
  // all.json is just generic, not specific historic data
  // latest.json the last... idk... week of data across all non historic points
  // article-latest.json dont like the idea of mixing whitehouse briefings with articles in the first place
  // cve.json is... all? yeah I would like a latest on cves
  // cve-latest.json explains itself
  // historic-random.json pluck <n> historic points at random, no dupes dammit
  // generic-random.json yeah I want random from all generic sources

  // fetch data for all sources(just generic atm)
  // TODO: support 'recent', not just latest
  const output = {
    //all: {}, // I actually want to skip this for now.
    latest: {}, // latest and recent isnt the same. the latest could be months old
    article_latest: {},
    //cve: {},
    historic_random: {},
    //generic_random: {},
    cve: await util.aggregate.cve(),
  }
  let tests = await util.aggregate.tests()

  for (const name in schema.sources) {
    console.log('name', name)
    const source = schema.sources[name]
    switch (source.dataType) {
      case 'generic': {
        source.data = await util.aggregate.generic(source.dataDirName)
        console.log(`${name} items: ${source.data.length}`)
      } break
      case 'historic-cia': {
        source.data = await util.aggregate.cia_historic()
        console.log(`${name} items: ${source.data.length}`)
      } break
      default: {
        console.log(`looks like we're not aggregating '${name}' yet`)
      } break
    }
  }

  // now that all data is fetched, build thingies
  const limit = 20
  for (const name in schema.sources) {
    // everything generic is sorted ascending so start from bottom for latest
    const source = schema.sources[name]
    switch(source.dataType) {
      case 'generic': {
        for (let i = source.data.length-1; i >= 0; i--) {
          if (i+limit < source.data.length) break
          if (!output.latest[name]) {
            output.latest[name] = {type: source.type,dataType: source.dataType,data:[]}
          }
          if (source.type === 'article') {
            if (!output.article_latest[name]) {
              output.article_latest[name] = {type: source.type,dataType: source.dataType,data:[]}
            }
          }
          output.latest[name].data.push(source.data[i])
          if (source.type === 'article') {
            output.article_latest[name].data.push(source.data[i])
          }
        }
      } break
      case 'historic-cia': {
        if (source.data.length < 200) {
          throw Error(`'${name}' with only ${source.data.length} items too short`)
        }
        if (!output.historic_random[name]) {
          output.historic_random[name] = {
            dataType: source.dataType,
            data: [],
          }
        }
        const selectedIndexes = []
        while (selectedIndexes.length < limit) {
          const si = util.random.number(source.data.length)
          if (!~selectedIndexes.indexOf(si)) {
            output.historic_random[name].data.push(source.data[si])
            selectedIndexes.push(si)
          }
        }
      } break
      default: {
        console.log(`'${name}' is not being aggregated`)
      } break
    }
  }

  // now that data is agg'ed, dump em
  //const targetPath = util.settings.directory.output
  const targetPath = '../homepage/latest/data'
  if (Object.keys(output.latest).length) {
    output.latest.metadata = {date: new Date().toISOString()}
    util.fs.writeJson(path.join(targetPath, 'latest.json'), output.latest)
    console.log('latest written')
  }
  if (Object.keys(output.article_latest).length) {
    output.article_latest.metadata = {date: new Date().toISOString()}
    util.fs.writeJson(path.join(targetPath, 'article_latest.json'), output.article_latest)
    console.log('article latest written')
  }
  if (Object.keys(output.historic_random).length) {
    output.historic_random.metadata = {date: new Date().toISOString()}
    util.fs.writeJson(path.join(targetPath, 'historic_random.json'), output.historic_random)
    console.log('historic random written')
  }
  util.fs.writeJson(path.join(targetPath, 'text_slider.json'), output)
  console.log('text slider output written')
  if (tests.length) {
    util.fs.writeJson(path.join(targetPath, 'tests.json'), tests)
    console.log('tests written')
  }

  /*
  // for non hosted website development(lazy)
  delete output.historic_random
  let script = `
function getData() {
  return ${JSON.stringify(output,' ',2)}
}
  `
  //fs.writeFileSync(path.join(util.settings.directory.output, 'data.js'), script)
  fs.writeFileSync('../homepage/latest/data/data.js', script)
  console.log('temporary data.js test file written to homepage/latest folder')
  */
  process.exit()
}

