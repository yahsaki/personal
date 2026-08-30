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


fixBleeper()
async function fixBleeper() {
  const html = fs.readFileSync('./bleeper.html')
  console.log(html.length)
  const c = cheerio.load(html)
  const ab = c('.articleBody')
  console.log(ab)
  ab['0'].children.forEach(el => {
    //console.log(el)
    console.log('class', c(el).attr('class'))
    console.log('type', el.type)
    console.log('text', c(el).text().trim())
    //console.log('type', c(el).attr('type'))
    //console.log('tag', c(el).tagName)
    //console.log('text', c(el).text().trim())
  })
}

function splitStringToLength(string, maxStringLength) {
  let strings=[];
  if (string.length < maxStringLength) {
    strings.push(string);
    return strings;
  } else {
    chop(string);
    return strings;
  }
  function chop(piece) {
    strings.push(piece.substr(0, maxStringLength))
    let rest = piece.substr(maxStringLength, piece.length);
    if (rest.length > maxStringLength) {
      chop(rest);
    } else {
      strings.push(rest);
      return;
    }
  }
}

//runMeDaily()
async function runMeDaily() {
  await scraper.cisaCyberSecurity()
  //await scraper.cisaNews()
  //await scraper.whitehouseActions()
  //await scraper.whitehouseStatements()
  //await scraper.whitehouseLegislations()
  //await scraper.bleeper()
  //await scraper.torrentFreak()
  // dont need to run this daily, we dont save CVEs
  // await scraper.cve()
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
    cve: [],
  }
  let tests = await util.aggregate.tests()
  output.cve = await util.aggregate.cve()

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
  const limit = 10
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
        if (source.data.length < limit) {
          throw Error(`'${name}' with only ${source.data.length} items ruined`)
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
  /*if (Object.keys(output.latest).length) {
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
  }*/
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

// bleeper, torrent, and what not goes here
// this is good to go
function aggregateGeneric(pathPart) {
  const dataPath = path.join(util.settings.directory.data, pathPart)
  if (!fs.existsSync(dataPath)) {
    throw Error(`path '${dataPath}' derived from path part '${pathPart}' does not exist`)
  }
  if (!fs.readdirSync(dataPath).length) {
    throw Error(`data path '${dataPath}' has no data`)
  }
  const p = new Promise((resolve, reject) => {
    const data = []
    klaw(dataPath)
      .on('data', item => {
        if (item.path === dataPath) return
        const pathObj = path.parse(item.path)
        console.log(pathObj)
        if (/*pathObj.ext.length && */pathObj.ext !== '.json') {
          // atm its just <year>-<month>.json files in a single folder, but could be nested for
          // some reason(shouldnt be)
          return
        }

        let obj
        try {
          obj = util.fs.readJson(item.path)
        } catch (err) {
          // TODO: idk, log it or something
          throw Error(`json at path '${item.path}' invalid`)
        }
        if (!obj.articles) {
          throw Error(`json at path '${item.path}' does not have an articles property. where are we even`)
        }
        // geh cant concat
        for (let i = 0; i < obj.articles.length; i++) data.push(obj.articles[i])

        console.log('data ln', data.length, item.path)
      })
      .on('end', () => {
        // TODO: sort data
        data.sort(util.comparer.date)
        resolve(data)
      })
  })
  return p
}
//testReq2()
async function testReq2() {
  let res = await request2('https', {
    method: 'GET',
    host: 'httpstat.us',
    path: '/200',
  })
  console.log('res 200', res)
  res = await request2('https', {
    method: 'GET',
    host: 'httpstat.us',
    path: '/503',
  })
  console.log('res 503', res)
}

function saveArticleData(schema, data) {
  // data = articles at the moment, dont pass anything here that isnt an array of articles just yet
  if (!schema.id?.length || typeof schema.id !== 'string') { throw Error(`invalid schema object passed to saveData`) }
  const dataPath = path.join(util.settings.directory.data, schema.id)
  util.fs.mkdir(dataPath)
  //const filePath = path.join(dataPath, `${util.getDataFileName()}.json`)
  const groups = {}
  for (let i = 0; i < data.length; i++) {
    const groupName = util.getDataFileName(data[i].date)
    if (!groups[groupName]) { groups[groupName] = { articles: [] } }
    groups[groupName].articles.push(data[i])
  }
  console.log('groups', groups)
  for (let group in groups) {
    const filePath = path.join(dataPath, `${group}.json`)
    let file = util.fs.readJson(filePath)
    if (!file) { file = { articles: [] } }
    for (let i = 0; i < groups[group].articles.length; i++) { file.articles.push(groups[group].articles[i]) }
    util.fs.writeJson(filePath, file)
    console.log(`${groups[group].articles.length} articles saved, total ${file.articles.length}: ${filePath}`)
  }
}

function testSaveData() {
  const schema = {
    id: 'fake_source',
    title: 'This ifs ofr testing',
    indexer: {
      url: 'https://fakesource.com/'
    },
  }
  const data = [
    { date: '2024-01-23T09:35:19.870Z', title: 'doesnt matter', text: 'also doesnt matter', },
    { date: '2024-01-23T09:35:19.870Z', title: 'doesnt matter', text: 'also doesnt matter', },
    { date: '2023-01-23T09:35:19.870Z', title: 'doesnt matter', text: 'also doesnt matter', },
    { date: '2022-01-23T09:35:19.870Z', title: 'doesnt matter', text: 'also doesnt matter', },
    { date: '2021-02-23T09:35:19.870Z', title: 'doesnt matter', text: 'also doesnt matter', },
    { date: '2020-04-23T09:35:19.870Z', title: 'doesnt matter', text: 'also doesnt matter', },
    { date: '2020-06-23T09:35:19.870Z', title: 'doesnt matter', text: 'also doesnt matter', },
  ]
  util.saveArticleData(schema, data)
}



//buildDataFile0()
async function buildDataFile0() {
  // lets take care of CVEs first, not sure how they work yet
  const result = {
    date: new Date().toISOString(),
    data: [],
  }
  let data = util.fs.readJson(path.join(util.settings.directory.data, `cve_nvd1_1.json`))
  let dataPoint = {
    title: 'CVE',
    data: [],
  }
  for (let i = 0; i < data.CVE_Items.length; i++) {
    let description;
    for (let j = 0; j < data.CVE_Items[i].cve.description.description_data.length; j++) {
      if (data.CVE_Items[i].cve.description.description_data[j].lang === 'en' &&
      !data.CVE_Items[i].cve.description.description_data[j].value.includes('REJECT')) {
        description = data.CVE_Items[i].cve.description.description_data[j].value;
      }
    }
    if (!description) continue;
    dataPoint.data.push({
      title: data.CVE_Items[i].cve.CVE_data_meta.ID,
      date: data.CVE_Items[i].lastModifiedDate,
      text: description,
    })
    if (dataPoint.data.length === 10) { break }
  }
  result.data.push(dataPoint)
  console.log(`${dataPoint.data.length} ${dataPoint.title} fetched`)

  result.data.push(fetchData('bleepingcomputer.json', 'BleepingComputer'))
  result.data.push(fetchData('cisa-cybersec.json', 'CISA CyberSecurity'))
  result.data.push(fetchData('cisa-news.json', 'CISA News'))
  result.data.push(fetchData('torrentfreak.json', 'TorrentFreak'))
  result.data.push(fetchData('whitehouse-actions.json', 'Whitehouse Actions'))
  result.data.push(fetchData('whitehouse-legislations.json', 'Whitehouse Legislations'))
  result.data.push(fetchData('whitehouse-statements.json', 'Whitehouse Statements'))
  util.fs.writeJson('./ui/data.json', result)
}
function fetchData(fname, title) {
  data = util.fs.readJson(path.join(util.settings.directory.data, fname))
  dataPoint = {
    title, // this will come from the schema at some point
    data: []
  }
  for (let i = data.articles.length-1; i >= 0; i--) {
    dataPoint.data.push(data.articles[i])
    if (dataPoint.data.length === 10) { break }
  }
  console.log(`${dataPoint.data.length} ${dataPoint.title} fetched`)
  return dataPoint
}

async function cve() {
  // https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-recent.json.gz
  const res = await request('https', {
    method: 'GET',
    host: 'nvd.nist.gov',
    path: '/feeds/json/cve/1.1/nvdcve-1.1-recent.json.gz',
  })
  const data = JSON.parse(
    Buffer.from(await new Promise(r =>
      zlib.gunzip(res, (error, buffer) => r(buffer)))).toString('utf8'))
  console.log('cves', data.CVE_Items.length)
  const dataPath = path.join(util.settings.directory.data, `cve_nvd1_1.json`)
  util.fs.writeJson(dataPath, data)
}
//whitehouse()
async function whitehouse() {
  await scraper.whitehouseLegislations()
  await scraper.whitehouseStatements()
  return
  const schema = {
    id: 'whitehouse-actions',
    title: 'Whitehouse Presidential Actions',
    indexer: {
      //url: 'http://localhost:8080/whitehouse/index.html',
      url: 'https://www.whitehouse.gov/briefing-room/presidential-actions/',
    },
  }

  let data = {
    articles: []
  }
  const dataPath = path.join(util.settings.directory.data, `${schema.id}.json`)
  const existingData = util.fs.readJson(dataPath)
  if (existingData) { data = existingData }

  let c = cheerio.load(await util.getHtml(schema.indexer.url))
  const links = []
  c('.news-item__title').each((i, el) => {
    links.push({
      title: c(el).text().trim(),
      url: c(el).attr('href'),
    })
  })
  console.log('links', links)
  const articles = []
  for (let i = 0; i < links.length; i++) {
    const article = {title:links[i].title,date:null,text:''}
    if (data.articles.find(x => x.title === article.title)) { continue }
    c = cheerio.load(await util.getHtml(links[i].url))
    await util.delay(5000)
    const content = c('.body-content')
    // I feel like I gotta wash this date
    article.date = new Date(c('.container time').attr('datetime')).toISOString()
    const arr = content.text().split('\n')
    for (let i = 0; i < arr.length; i++) {
      const line = arr[i].trim()
      if (line.length) { article.text += `${line} `}
    }
    articles.push(article)
    console.log(`${schema.title} article '${article.title}' added`)
  }

  if (articles.length) {
    data.articles = data.articles.concat(articles)
    util.fs.writeJson(dataPath, data)
  } else {
    console.log('nothing to add')
  }
}

async function fetchBleeper() {
  await scraper.bleeper()
  return
  const headers = {
    Host: 'www.bleepingcomputer.com',
    'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    DNT: 1,
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': 1,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    TE: 'trailers',
  }
  const schema = {
    id: 'bleepingcomputer',
    title: 'Bleepingcomputer',
    indexer: {
      //url: 'http://localhost:8080/bleepingcomputer/index.html',
      url: 'https://www.bleepingcomputer.com/'
    },
  }

  let data = {
    articles: []
  }
  const dataPath = path.join(util.settings.directory.data, `${schema.id}.json`)
  const existingData = util.fs.readJson(dataPath)
  if (existingData) { data = existingData }

  let c = cheerio.load(await util.getHtml(schema.indexer.url))
  await util.delay(5000)
  const links = []
  c('.bc_latest_news_text > h4 > a').each((i, el) => {
    // TODO(IMMEDIATELY): filter deals. someday filter those lessons maybe
    const link = {
      title: c(el).text().trim(),
      url: c(el).attr('href'),
    }
    console.log('link', link)
    if (!~link.url.indexOf('/deals/')) {
      if (!data.articles.find(x => x.title === link.title)) {
        links.push(link)
      }
    }
  })
  //console.log('links', links)
  const articles = []
  for (let i = 0; i < links.length; i++) {
    const html = await util.getHtml(links[i].url, headers)
    c = cheerio.load(html)
    await util.delay(5000)
    const article = {
      title:links[i].title,
      date: new Date(c('.cz-news-date').text()).toISOString(),
      text: ''
    }
    const ab = c('.articleBody')
    ab['0'].children.forEach(el => {
      if (c(el).attr('class') !== 'bc_quote' &&
        c(el).attr('class') !== 'cz-related-article-wrapp'
      ) {
        const text = c(el).text().trim()
        if (text.length) { article.text += `${text} ` }
      }
    })

    articles.push(article)
  }
  if (articles.length) {
    data.articles = data.articles.concat(articles)
    util.fs.writeJson(dataPath, data)
    console.log(`${articles.length} articles saved`)
  } else {
    console.log('nothing to add')
  }

  // lets brute force the article for now
  /*c = cheerio.load(await util.getHtml('http://localhost:8080/bleepingcomputer/mortgage-firm-loandepot-cyberattack-impacts-it-systems-payment-portal.html'))
  const ab = c('.articleBody')

  const date = new Date(c('.cz-news-date').text()).toISOString()
  console.log(date)
  process.exit()
  let res = ''
  ab['0'].children.forEach(el => {
    if (c(el).attr('class') !== 'bc_quote' &&
      c(el).attr('class') !== 'cz-related-article-wrapp'
    ) {
      const text = c(el).text().trim()
      if (text.length) { res += `${text} ` }
    }
  })*/

}

async function fetchCisa() {
  //await scraper.cisaCybesec()
  //await scraper.cisaNews()
}

/*
;(async () => {
  // /news-events/alerts/2024/01/04/cisa-releases-three-industrial-control-systems-advisories
  let c = cheerio.load(await util.getHtml('https://www.cisa.gov/news-events/alerts/2024/01/04/cisa-releases-three-industrial-control-systems-advisories'))
})

;(async () => {
  const schema = {
    id: 'cisa-cybersec',
    title: 'cisa.gov Cybersecurity',
    indexer: {
      url: 'https://www.cisa.gov/news-events/cybersecurity-advisories',
      selector: {
        title: null, // its the text of the link
        link: '.c-teaser__title > a',
      },
    },
    page: {
      selector: {
        content: '.l-page-section__content',
        date: '.c-field--name-field-release-date time',
      }
    }
  }
  // get all articles on index page
  // get article texts. ignoring html
  let data = {
    articles: []
  }
  const dataPath = path.join(util.settings.directory.data, `${schema.id}.json`)
  const existingData = util.fs.readJson(dataPath)
  if (existingData) { data = existingData }

  let c = cheerio.load(await util.getHtml(schema.indexer.url))
  const links = []
  c(schema.indexer.selector.link).each((i, el) => {
    links.push({
      title: c(el).text().trim(),
      url: c(el).attr('href'),
    })
  })
  console.log('links', links)

  // get article texts. ignoring html
  const articles = []
  for (let i = 0; i < links.length; i++) {
    const article = {title:links[i].title,date:null,text:''}
    if (data.articles.find(x => x.title === article.title)) { continue }
    const uri = `https://www.cisa.gov${links[i].url}`
    console.log('thing', uri)
    c = cheerio.load(await util.getHtml(uri))
    await util.delay(3000)
    const content = c(schema.page.selector.content)
    article.date = c('.c-field--name-field-release-date time').attr('datetime')
    // for CISA, we want ALL text inside all elements
    const arr = content.text().split('\n')
    for (let i = 0; i < arr.length; i++) {
      const line = arr[i].trim()
      if (~arr[i].indexOf('Please share your thoughts') ||
        ~arr[i].indexOf('we’d welcome your feedback')
      ) {
        // not sure how much data im losing by doing this
        continue
      }
      if (line.length) { article.text += `${line} `}
    }
    articles.push(article)
    console.log(`${schema.title} article '${article.title}' added`)
  }

  if (articles.length) {
    data.articles = data.articles.concat(articles)
    util.fs.writeJson(dataPath, data)
  } else {
    console.log('nothing to add')
  }

})
*/