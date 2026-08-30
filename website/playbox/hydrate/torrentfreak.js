const util = require('../toys/util')
const url = require('url')
const path = require('path')
const request = require('../toys/request')
const cheerio = require('cheerio')
const fs = require('fs')
const zlib = require('zlib')

const delayAmount = 30000

;(async () => {
  const urlBase = 'https://torrentfreak.com/page/'
  let page = 1
  let completed = false

  const state = util.fs.readJson('./torrentfreak.json')
  if (state) {
    page = state.page
    completed = state.completed
  }
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

  while (!completed) {
    const articles = await scrapeGeneric(schema, `${urlBase}${page}/`)
    if (!articles.length) {
      completed = true
    } else {
      util.saveArticleData(schema, articles)
    }

    page += 1
    util.fs.writeJson('./torrentfreak.json', {page,completed})
  }
})()

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
    //if (data.articles.find(x => x.title === article.title)) { continue }
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
