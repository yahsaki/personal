const util = require('../toys/util')
const url = require('url')
const path = require('path')
const request = require('../toys/request')
const cheerio = require('cheerio')
const fs = require('fs')
const zlib = require('zlib')

;(async () => {
  const urlBase = 'https://www.bleepingcomputer.com/page/'
  let page = 1
  let completed = false

  const state = util.fs.readJson('./bleeping.json')
  if (state) {
    page = state.page
    completed = state.completed
  }
  const schema = {
    id: 'bleepingcomputer',
    title: 'Bleepingcomputer',
  }

  while (!completed) {
    const articles = await scrapeBleeper(`${urlBase}${page}/`)
    // hack: if null, error, im empty array, complete
    if (!articles) {
      console.log('error scraping')
    } else if (!articles.length) {
      completed = true
    } else {
      util.saveArticleData(schema, articles)
    }

    page += 1
    util.fs.writeJson('./bleeping.json', {page,completed})
  }
})()

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
  await util.delay(60000)
  const links = []
  c('.bc_latest_news_text > h4 > a').each((i, el) => {
    // TODO(IMMEDIATELY): filter deals. someday filter those lessons maybe
    const link = {
      title: c(el).text().trim(),
      url: c(el).attr('href'),
    }
    //console.log('link', link)
    if (!~link.url.indexOf('/deals/') && ~link.url.indexOf('bleepingcomputer.com')) {
      if (!data.articles.find(x => x.title === link.title)) {
        links.push(link)
      }
    }
  })
  //console.log('links', links)
  const articles = []
  for (let i = 0; i < links.length; i++) {
    const html = await util.getHtml(links[i].url)
    await util.delay(30000)
    c = cheerio.load(html)
    const articleDate = c('.cz-news-date').text()
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
      const text = c(el).text().trim()
      if ((el.type === 'tag' || el.type === 'text') && !c(el).attr('class')) {
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
