const request = require('./request')
const url = require('url')
const cheerio = require('cheerio')
const fs = require('fs')
const util = require('./util')
const path = require('path')
const zlib = require('zlib')

const delayAmount = 10000

function getData(schema) {
  const dataPath = path.join(util.settings.directory.data, schema.id)
  util.fs.mkdir(dataPath)
  const filePath = path.join(dataPath, util.getDataFileName())
}

const api = {
  torrentFreak: async () => {
    // lets see if we can make a generic one
    const schema = {
      id: 'torrentfreak',
      title: 'TorrentFreak',
      indexer: {
        url: 'https://torrentfreak.com',
        selector: {
          items: {
            type: 'selector',
            value: '.preview-article',
          },
          title: {
            type: 'text',
            value: '.preview-article__title',
          },
          link: {
            type: 'attribute',
            typeVal: 'href',
            value: 'article > a',
          },
        },
      },
      page: {
        selector: {
          content: {
            type: 'text',
            value: 'article',
          },
          date: {
            type: 'text',
            value: '.hero__published time',
          },
        }
      }
    }
    const articles = await scrapeGeneric(schema, schema.indexer.url)
    util.saveArticleData(schema, articles)
  },
  cve: async () => {
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
  },
  // 250511: this is honestly dead with latest changes to the site
  /*whitehouseLegislations: async () => {
    const schema = {
      id: 'whitehouse-legislations',
      title: 'Whitehouse Legislations',
      indexer: {
        url: 'https://www.whitehouse.gov/legislation/',
      },
    }
    await fetchWhitehouse(schema)
  },*/
  whitehouseStatements: async () => {
    const schema = {
      id: 'whitehouse-statements',
      title: 'Whitehouse Statements and Releases',
      indexer: {
        url: 'https://www.whitehouse.gov/briefings-statements/',
      },
    }
    await fetchWhitehouse(schema)
  },
  whitehouseActions: async () => {
    const schema = {
      id: 'whitehouse-actions',
      title: 'Whitehouse Presidential Actions',
      indexer: {
        url: 'https://www.whitehouse.gov/presidential-actions/',
      },
    }
    await fetchWhitehouse(schema)
  },
  bleeper: async () => {
    const schema = {
      id: 'bleepingcomputer',
      title: 'Bleepingcomputer',
      indexer: {
        url: 'https://www.bleepingcomputer.com/'
      },
    }
    const articles = await scrapeBleeper(schema.indexer.url)
    util.saveArticleData(schema, articles)
  },
  cisaNews: async () => {
    const schema = {
      id: 'cisa-news',
      title: 'cisa.gov News',
      indexer: {
        url: 'https://www.cisa.gov/news-events/news',
        selector: {
          title: null, // its the text of the link
          link: '.c-teaser__title > a',
        },
      },
      page: {
        selector: {
          content: '.c-field__content',
          date: '.c-field--type-datetime time',
        }
      }
    }
    await fetchCisa(schema)
    return
  },
  cisaCyberSecurity: async () => {
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
          //date: '.c-field--name-field-release-date time',
          date: '.c-field--type-datetime time',
        }
      }
    }
    await fetchCisa(schema)
    return
  }
}

module.exports = api

async function scrapeGeneric(schema, uri) {
  //let data = { articles: [] }
  const html = await util.getHtml(uri)
  console.log('debug: html ln:', html.length)
  let c = cheerio.load(html)
  await util.delay(delayAmount)

  const links = []
  c(schema.indexer.selector.items.value).each((i, el) => {
    const link = {title:null,url:null}
    switch(schema.indexer.selector.title.type) {
      case 'text': {
        link.title = c(el).find(schema.indexer.selector.title.value).text().trim()
      } break
      case 'attribute': {
        link.title = c(el).find(schema.indexer.selector.title.value).attr(schema.indexer.selector.title.typeVal)
      } break
    }
    switch(schema.indexer.selector.link.type) {
      case 'text': {
        link.url = c(el).find(schema.indexer.selector.link.value).text().trim()
      } break
      case 'attribute': {
        link.url = c(el).find(schema.indexer.selector.link.value).attr(schema.indexer.selector.link.typeVal)
      } break
    }
    if (link.title?.length && link.url?.length) {
      links.push(link)
    }
  })
  //console.log('links', links)
  if (!links.length) {
    console.log(`failed to find links in schema ${schema.title}`)
    return
  }

  const articles = []
  for (let i = 0; i < links.length; i++) {
    const article = {title:links[i].title,date:null,text:null}
    c = cheerio.load(await util.getHtml(links[i].url))
    await util.delay(delayAmount)

    // lets get this date out of the way
    let rawDate
    let now = new Date()
    switch(schema.page.selector.date.type) {
      case 'text': {
        rawDate = c(schema.page.selector.date.value).text().trim()
      } break
      case 'attribute': {
        rawDate = c(schema.page.selector.date.value).attr(schema.page.selector.date.typeVal)
      } break
    }
    if (rawDate) {
      if (rawDate === 'today') {
        article.date = new Date(`${now.getUTCFullYear()}-${now.getUTCMonth()+1}-${now.getUTCDate()}`).toISOString()
      } else if (rawDate === 'yesterday') {
        article.date = new Date(`${now.getUTCFullYear()}-${now.getUTCMonth()+1}-${now.getUTCDate()-1}`).toISOString()
      } else {
        const thing = new Date(rawDate)
        if (thing instanceof Date && !isNaN(thing)) {
          article.date = thing.toISOString()
        }
      }
    }
    if (!article.date?.length) {
      //throw Error(`failed to parse date '${date}'`)
      console.log(`failed to parse date '${rawDate}'`)
    }
    let text = ''
    let rawText
    switch(schema.page.selector.content.type) {
      case 'text': {
        rawText = c(schema.page.selector.content.value).text().trim()
      } break
      case 'attribute': {
        rawText = c(schema.page.selector.content.value).attr(schema.page.selector.content.typeVal)
      } break
    }

    if (rawText) {
      const arr = rawText.split('\n')
      for (let j = 0; j < arr.length; j++) {
        const line = arr[j].trim()
        // tfreak is coming up with html in the result. parse out
        if (line.length) {
          if (~line.indexOf('<') && ~line.indexOf('>')) {
            // we're losing some content this way but IDGAF
            continue
          }
          text += `${line} `
        }
      }
      article.text = text
    }
    //console.log('article', article)

    if (article.date?.length && article.text?.length) {
      console.log(`${schema.title} article '${article.title}' added`)
      articles.push(article)
    }
  }
  return articles
}

async function fetchWhitehouse(schema) {
  const html = await util.getHtml(schema.indexer.url)
  console.log('html ln', html.length)
  let c = cheerio.load(html)
  await util.delay(2000)
  const links = []
  c('.wp-block-post-title a').each((i, el) => {
    links.push({
      title: c(el).text().trim(),
      url: c(el).attr('href'),
    })
  })
  console.log('links', links)
  const articles = []
  for (let i = 0; i < links.length; i++) {
    const article = {title:links[i].title,date:null,text:''}
    c = cheerio.load(await util.getHtml(links[i].url))
    await util.delay(5000)
    // I feel like I gotta wash this date
    article.date = new Date(c('.wp-block-post-date time').attr('datetime')).toISOString()
    article.text = ''
    c('.wp-block-post-content p').each((i, el) => {
      article.text += `${c(el).text().trim()} `
    })
    /*const arr = content.text().split('\n')
    for (let i = 0; i < arr.length; i++) {
      const line = arr[i].trim()
      if (line.length) { article.text += `${line} `}
    }*/
    if (article.text.length) {
      articles.push(article)
      console.log(`${schema.title} article '${article.title}' added`)
    } else {
      // TODO: notify
      console.log(`failed to find text for article '${article.title}'`)
    }
  }

  if (articles.length) {
    util.saveArticleData(schema, articles)
  } else {
    console.log('nothing to add')
  }
}

async function scrapeBleeper(uri) {
  // adding these headers to article fetch calls returns gzip or something
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

  let data = {
    articles: []
  }

  let c = cheerio.load(await util.getHtml(uri))
  await util.delay(delayAmount)
  const links = []
  c('.bc_latest_news_text > h4 > a').each((i, el) => {
    // TODO(IMMEDIATELY): filter deals. someday filter those lessons maybe
    const link = {
      title: c(el).text().trim(),
      url: c(el).attr('href'),
    }
    //console.log('link', link)
    if (!~link.url.indexOf('/deals/')) {
      if (!data.articles.find(x => x.title === link.title)) {
        links.push(link)
      }
    }
  })
  //console.log('links', links)
  const articles = []
  for (let i = 0; i < links.length; i++) {
    const html = await util.getHtml(links[i].url)
    await util.delay(delayAmount)
    c = cheerio.load(html)
    const articleDate = c('.cz-news-date').text()
    console.log(`DEBUG- article date: '${articleDate}'`)
    if (!articleDate.length) {
      // 260828: no dates mean its sponsored content. cheap way of filtering that out
      continue
    }
    const article = {
      title:links[i].title,
      date: new Date(articleDate).toISOString(),
      text: ''
    }
    const ab = c('.articleBody')
    ab['0'].children.forEach(el => {
      if ((el.type === 'tag' || el.type === 'text') && !c(el).attr('class')) {
        const text = c(el).text().trim()
        if (text.length) { article.text += `${text} ` }
      }
    })
    // remove newline chars
    if (article.text.length) {
      article.text = article.text.replaceAll('\n', ' ')
      articles.push(article)
      console.log(`article '${article.title}' added`)
    } else {
      console.log(`failed to find text for article '${article.title}'`)
    }
  }
  return articles
}

async function fetchCisa(schema) {
  // get all articles on index page
  // get article texts. ignoring html
  let c = cheerio.load(await util.getHtml(schema.indexer.url))
  const links = []
  c(schema.indexer.selector.link).each((i, el) => {
    links.push({
      title: c(el).text().trim(),
      url: c(el).attr('href'),
    })
  })
  //console.log('links', links)

  // get article texts. ignoring html
  const articles = []
  for (let i = 0; i < links.length; i++) {
    const article = {title:links[i].title,date:null,text:''}
    const uri = `https://www.cisa.gov${links[i].url}`
    //console.log('thing', uri)
    c = cheerio.load(await util.getHtml(uri))
    await util.delay(delayAmount)
    const content = c(schema.page.selector.content)
    article.date = c(schema.page.selector.date).attr('datetime')
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
    if (article.text?.length && article.date?.length) {
      articles.push(article)
      console.log(`${schema.title} article '${article.title}' added`)
    } else {
      console.error(`failed to get date for aricle '${links[i].title}'`)
    }
  }

  if (articles.length) {
    util.saveArticleData(schema, articles)
  } else {
    console.log('nothing to add')
  }
}
