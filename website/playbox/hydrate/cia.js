const util = require('../toys/util')
const url = require('url')
const path = require('path')
const request = require('../toys/request')
const fs = require('fs')
const cheerio = require('cheerio')
/*
broked
  - https://www.cia.gov/readingroom/document/06182040 (doc missing)
*/
const pageTemplate = {
  link: null,
  scrapeDate: null,
  entries: [],
}
const entryTemplate = {
  title: null,
  info: {
    documentType: null,
    collection: null,
    documentNumber: null,
    releaseDecision: null,
    originalClassification: null,
    documentPageCount: null,
    documentCreationDate: null,
    documentReleaseDate: null,
    sequenceNumber: null,
    caseNumber: null,
    publicationDate: null,
    fileName: null,
  },
  link: null,
  fileDownloaded: false,
  text: null,
  scrapeDate: null,
}
const dataTemplate = {
  page: 0,
  completed: false,
  urlPart0: null,
  urlPart1: null,
  pages: []
}
const delayAmount = 60000
let dataPath

const headers = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
  Cookie: 'jsessionid=EB8E344C0711F391DDFD2E45BD9B72FDjUPMGak2ychGW2Zi4cNGdvMw3LFKGuQsgAwDLGh1/4sf+tpQuzU0QmwtpVH80towpr31pc+wQ0zYfjXcSnmZIIttiNIa2tBK1IyZt0o2lLG11Lc2HqBxsAQ9bHeAKSicDX7IxZN3g5np5/ZHA9orUw==; _session_=5771E3CF9F880F469EF3ED5FDDCE61BC; ak_bmsc=55A22BB97919F6CA4217DE7F612AA6CC~000000000000000000000000000000~YAAQBqXcFxjiATWgAQAA0Q2LSgB7dHjiyJgDmpC3XUHZZpIG/dgfVdVIbvy6pDX2PoxDuhF8e7HPhcDdKesJBTHRu7d264xMX+vR0Sw5Gn9SA8ad5N9lN46vJAnfEijiLfEjWrqIZ4AFnX+sgL/jVQOP0pB3Bsp8ZJuQfogbHQuUa2Isl4F8TVa3VrFbFzac9feMWY44Ik6+iE9HrZV1Wfzcg0jWrhMiNEvC6ima3dnAaNu7r2WghRH4jQSqHxYiS2b8idL16TqnI6hZqGydk924PRhU8MVQ6LtJSAQpmcOE++2QWP9RypOd+VGokUHGCpU48rDD1T4VL8nFVod20W564WymkTsc6P05eRzZq5hnSOWWcgg5olKVcvDyNMyzQEyqCUMOHT+5xl2xwQRm7LQcCeUyc9Lia2cJPYyVdYGfAFTHeFrchrKS+sKeQYXYtPo5vtIxN6iokCEX8VOsGiTtTXm50jGz/0QDxLr8a+Mp92g7wZv8rA==',
  Host: 'www.cia.gov',
  Priority: 'u=0, i',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Sec-GPC': 1,
  'Upgrade-Insecure-Requests': 1,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
}

getYear(2023)
async function getYear(year) {
  let c
  dataPath = path.join(util.settings.directory.data, 'historic', 'CIA', `${year}`)
  const filePath = path.join(dataPath, 'files')
  util.fs.mkdir(filePath)

  const dataFilePath = path.join(dataPath, 'data.json')
  let data = util.fs.readJson(dataFilePath)
  if (!data) {
    data = {
      ...dataTemplate,
      urlPart0: 'https://www.cia.gov/readingroom/search/site?page=',
      urlPart1: `&f[0]=ds_created%3A[${year}-01-01T00%3A00%3A00Z TO ${year+1}-01-01T00%3A00%3A00Z]`,
    }
  }

  // first thing we do is scrape the current page for entries
  // once scraped, create empty entries with links to the entry
  // scrape all entries
  // once all entries have the pdf downloaded and text populated, increment page, redo
  // once the index page returns nothing, set data.completed to true
  if (data.completed) { console.log(`CIA ${year} completed`);return }
  console.log(`${year} in progress, currently on page ${data.page}`)
  //await downloadFile('https://www.cia.gov/readingroom/docs/NATIONAL%20INTELLIGENCE%20DAI%5B15264939%5D.pdf', filePath)
  while (!data.completed) {
    let page
    if (!data.pages[data.page]) {
      // page not created, index page
      console.log(`indexing page ${data.page}`)
      const link = `${data.urlPart0}${data.page}${data.urlPart1}`
      page = {...pageTemplate,link}
      let html = await util.getHtml(link)
      console.log(`cia link: '${link}'`)
      console.log('debug: html ln:', html.length)
      fs.writeFileSync('debug.html', html)
      process.exit()
      c = cheerio.load(html)
      //c = cheerio.load(await util.getHtml(`http://localhost:8080/cia/page0.html`))
      await util.delay(delayAmount) // TODO: make variable variable
      const entries = []
      c('.title a').each((i, el) => {
        const entry = {
          ...entryTemplate,
          title: c(el).text(),
          link: c(el).attr('href'),
        }
        entries.push(entry)
      })
      if (entries.length) {
        page.entries = page.entries.concat(entries)
        page.scrapeDate = new Date().toISOString()
        console.log(`found ${entries.length} on page ${data.page}`)
        data.pages.push(page)
      } else {
        console.log(`found no entries on page ${data.page}, process complete`)
        data.completed = true
        continue
      }
    } else {
      // page created, download mustve been in progress
      console.log(`page ${data.page} already created, resuming scrape`)
      page = data.pages[data.page]
    }

    for (let i = 0; i < page.entries.length; i++) {
      const entry = page.entries[i]
      // TODO: check if entry is already filled out. if so then skip
      if (entry.text?.length && entry.fileDownloaded) {
        console.log(`${i+1}/${page.entries.length}  page ${data.page} entry '${entry.title}'(${entry.link}) already completed, skipping`)
        continue
        // there could be a case where we want to rescrape the pages(but not dl files or something)
      }

      //c = cheerio.load(await util.getHtml(`http://localhost:8080/cia/15264939.html`))
      c = cheerio.load(await util.getHtml(entry.link))
      await util.delay(delayAmount)

      const documentType = c('.field-name-field-taxonomy-doc-type .field-items').text()
      if (!documentType?.length) { console.log(`${i+1}/${page.entries.length} failed to get document type on page '${entry.link}'`);process.exit() }
      entry.info.documentType = documentType

      const collection = c('.field-name-field-collection .field-items').text()
      if (!collection?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get collection on page '${entry.link}'`)
      } else {
        entry.info.collection = collection
      }

      const documentNumber = c('.field-name-field-document-number .field-items').text()
      if (!documentNumber?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get documentNumber on page '${entry.link}'`)
      } else {
        entry.info.documentNumber = documentNumber
      }

      const releaseDecision = c('.field-name-field-release-decision .field-items').text()
      if (!releaseDecision?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get releaseDecision on page '${entry.link}'`)
      } else {
        entry.info.releaseDecision = releaseDecision
      }

      const originalClassification = c('.field-name-field-original-classification .field-items').text()
      if (!originalClassification?.length) { console.log(`${i+1}/${page.entries.length} failed to get originalClassification on page '${entry.link}'`);process.exit() }
      entry.info.originalClassification = originalClassification

      const documentPageCount = c('.field-name-field-page-count .field-items').text()
      if (!documentPageCount?.length) { console.log(`${i+1}/${page.entries.length} failed to get documentPageCount on page '${entry.link}'`);process.exit() }
      entry.info.documentPageCount = documentPageCount

      const documentCreationDate = c('.field-name-field-creation-date .date-display-single').attr('content')
      if (!documentCreationDate?.length) { console.log(`${i+1}/${page.entries.length} failed to get documentCreationDate on page '${entry.link}'`);process.exit() }
      entry.info.documentCreationDate = documentCreationDate

      const documentReleaseDate = c('.field-name-field-release-date .date-display-single').attr('content')
      if (!documentReleaseDate?.length) { console.log(`${i+1}/${page.entries.length} failed to get documentReleaseDate on page '${entry.link}'`);process.exit() }
      entry.info.documentReleaseDate = documentReleaseDate

      const sequenceNumber = c('.field-name-field-sequence-number .field-items').text()
      if (!sequenceNumber?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get sequenceNumber on page '${entry.link}'`)
      } else {
        entry.info.sequenceNumber = sequenceNumber
      }

      const caseNumber = c('.field-name-field-case-number .field-items').text()
      if (!caseNumber?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get caseNumber on page '${entry.link}'`)
      } else {
        entry.info.caseNumber = caseNumber
      }

      const publicationDate = c('.field-name-field-pub-date .date-display-single').attr('content')
      if (!publicationDate) {
        console.log(`failed to get publicationDate on page '${entry.link}'`)
      }
      entry.info.publicationDate = publicationDate

      const fileName = c('.field-name-field-file .file > a').text()
      if (!fileName?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get fileName on page '${entry.link}'`)
        process.exit()
      }
      entry.info.fileName = fileName

      const body = c('.field-name-body .field-items').text()
      if (!body?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get body on page '${entry.link}'`)
        //process.exit()
      }
      entry.text = body.replaceAll('\n', '')

      const link = c('.field-name-field-file .file > a').attr('href')
      if (!link?.length) {
        console.log(`${i+1}/${page.entries.length} failed to get file download link on page '${entry.link}'`)
        process.exit()
      }

      //console.log(entry)
      //process.exit()
      let downloaded = false
      try {
        await downloadFile(link, filePath)
        downloaded = true
        await util.delay(delayAmount)
      } catch (err) {
        // TODO: this is the perfect case of shooting off a log that gets shown on website. if the
        // doc is missing, fire off a thing that gets seen on thing
        writeLog(`${new Date().toISOString()}: ${i+1}/${page.entries.length} page ${data.page} entry '${entry.title}'(${entry.link}) failed to download file at '${link}'`)
      }

      if (downloaded) {
        entry.fileDownloaded = true
        entry.scrapeDate = new Date().toISOString()
        util.fs.writeJson(dataFilePath, data)
        console.log(`${i+1}/${page.entries.length} page ${data.page} entry '${entry.title}'(${entry.link}) completed`)
      }
    }

    util.fs.writeJson(dataFilePath, data)
    console.log(`page ${data.page} completed`)
    data.page += 1
  }
}

function writeLog(log) {
  const logPath = path.join(dataPath, 'log.txt')
  let logFile = ''
  try {
    const buf = fs.readFileSync(logPath)
    logFile = Buffer.from(buf).toString('utf8')
  } catch (err) {}
  logFile += `\n${log}`
  fs.writeFileSync(logPath, logFile)
  console.log('wrote log', log)
  return
}

async function downloadFile(uri, filePath) {
  const uriObj = url.parse(uri)
  const pathObj = path.parse(uri)
  //console.log(pathObj)
  //console.log(decodeURI(pathObj.base))
  //console.log(path.join(filePath, decodeURI(pathObj.base)))
  const data = await request(uriObj.protocol.substring(0, uriObj.protocol.length-1), uriObj)
  fs.writeFileSync(path.join(filePath, decodeURI(pathObj.base)), data)
  console.log(`file saved`, path.join(filePath, decodeURI(pathObj.base)))
  return
}
