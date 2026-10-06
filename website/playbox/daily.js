 
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

;(async () => {
  await runMeDaily()
  await util.delay(1000)
  buildDataFiles()
})//()

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
  //await util.delay(1000)
  
  //await aggregate()
}

// TODO: write to /ui directory directly
async function buildDataFiles() {
  // cves
  if (false) {
    const cves = aggregateCVEs()
    fs.writeFileSync('./data/cve.json', JSON.stringify(cves))
  }

  const date = new Date()
  const latest = {
    date: date.toISOString(),
    data: []
  }
  let arr = []
  arr.push(await util.aggregate.generic('bleepingcomputer'))
  arr.push(await util.aggregate.generic('torrentfreak'))
  arr.push(util.fs.readJson('./data/cve.json').data)
  // build latest
  for (let i in arr) {
    const articles = arr[i]
    console.log(`article count: ${articles.length}`)
    let limit = 10 // top ten of whatever is latest por favaor onegai
    for (let j = articles.length-1; j >= 0; j--) {
      if (limit === 0) { continue }
      const article = articles[j]
      if (article.title.startsWith('Top 10')) {
        // I dont want it. need to filter it out on the scrape step
        continue
      }
      console.log('article', article)
      latest.data.push(article)
      console.log(`article [${article.date}]'${article.title}' added to latest`)
      limit = limit - 1
    }
  }
  console.log('latest data count', latest.data.length)
  fs.writeFileSync('../ui/data/latest.json', JSON.stringify(latest))
  // build rest
  const all = {
    date: date.toISOString(),
    data: []
  }
  for (let i in arr) {
    const articles = arr[i]
    for (let j in articles) {
      all.data.push(articles[j])
    }
  }
  console.log(all.data.length)
  fs.writeFileSync('../ui/data/all.json', JSON.stringify(all))
  // I want latest bleeping :(
}

/*
  261005: the previous method of fetching a zip of latest CVEs from nvd.nist.gov is beyond gone. they migrated CVEs to
  github, here(I cant find the link atm lol)
  so instead of building a full automation tool, im just plucking whatever the latest release is at the time manually and
  dumping it here for this fn to access and aggregate. obviously automate this at some point
*/
function aggregateCVEs() {
  console.log('20261005: only fetching 2026 cves in this fn at the moment. we\'ll want everything at some point')
  const response = {
    name: 'CVEs',
    data: [],
  }
  const cveDir = path.join(__dirname, 'data/cves/2026')
  const readdirRes = fs.readdirSync(cveDir,{recursive:true})
  console.log('readdir', readdirRes[readdirRes.length - 2])
  if (!readdirRes.length) {
    console.log(`failed to find cves in dir ${cveDir}`);return response
  }

  let rejected = 0
  let noDescription = 0
  let invalidJson = 0
  for (let i in readdirRes) {
    const filePath = path.join(cveDir, readdirRes[i])
    const pathObj = path.parse(filePath)
    if (pathObj.ext.toLowerCase() !== '.json') {
      continue
    }

    console.log(filePath)
    let cve
    try {
      cve = JSON.parse(fs.readFileSync(filePath))
    } catch (err) {
      invalidJson += 1
      continue
    }
    
    if (cve.cveMetadata.state === 'REJECTED') { rejected += 1;continue }
    if (!cve.containers.cna.descriptions) { noDescription += 1;continue }
    response.data.push({
      title: `${cve.cveMetadata.cveId}: ${cve.containers.cna.title}`,
      date: new Date(cve.cveMetadata.datePublished).toISOString(),
      // i dont care if they have other languages until I do
      text: cve.containers.cna.descriptions[0].value,
    })
  }
  response.data = response.data.sort(util.comparer.date)
  console.log(`${response.data.length} cves aggregated, ${rejected} rejected, ${noDescription} no descriptions, ${invalidJson} invalid json`)
  return response
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

