const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const request = require('./request')
const url = require('url')
const klaw = require('klaw')

const api = {
  settings: {
    directory: {
      data: path.join(path.dirname(__dirname), 'data'),
      output: path.join(path.dirname(__dirname), 'data', 'ouput'),
    },
  },
  getDataFileName: (dateString) => {
    const date = dateString ? new Date(dateString) : new Date()
    if (!date instanceof Date || isNaN(date)) {
      throw Error(`dateString '${dateString}' not valid`)
    }
    const monthNumber = date.getMonth()+1
    let month
    if (monthNumber < 10) { month = `0${monthNumber}`}
    else { month = `${monthNumber}` }
    return `${date.getFullYear()}-${month}`
  },
  delay: ms =>
    new Promise(resolve =>
      setTimeout(() => resolve(), ms)),
  getHtml: async (uri, headers = null) => {
    let uriObj = url.parse(uri)
    const options = {
      method: 'GET',
      host: uriObj.hostname,
      port: uriObj.port,
      path: uriObj.path,
    }
    if (headers) options.headers = headers
    //console.log('getHtml options', options)
    return Buffer.from(await request(uriObj.protocol.substring(0, uriObj.protocol.length-1), options)).toString('utf8')
  },
  fs: {
    mkdir: (dir) => {
      try {
        fs.mkdirSync(dir, {recursive: true})
      } catch (err) {
        if (err.code !== 'EEXIST') { throw err }
      }
      return
    },
    readJson: (filePath) => {
      if (!filePath?.length) { throw new Error('readJson: invalid args') }
      let binary
      try {
        // I dont think this is binary... whatever
        binary = fs.readFileSync(filePath)
      } catch(err) {
        return
      }

      if (!binary) { return }
      try {
        return JSON.parse(Buffer.from(binary).toString())
      } catch(err) { throw err }
    },
    writeJson: (filePath, data) => {
      if (!filePath?.length || typeof data !== 'object') {
        throw new Error(`writeJson: invalid args`)
      }
      const parsed = path.parse(filePath)
      api.fs.mkdir(parsed.dir)
      // other tools seem to add a newline char at the end
      fs.writeFileSync(filePath, JSON.stringify(data,' ',2))
      return
    },
  },
  saveArticleData: (schema, data) => {
    // data = articles at the moment, dont pass anything here that isnt an array of articles just yet
    if (!schema.id?.length || typeof schema.id !== 'string') { throw Error(`invalid schema object passed to saveData`) }
    const dataPath = path.join(api.settings.directory.data, schema.id)
    api.fs.mkdir(dataPath)
    const groups = {}
    for (let i = 0; i < data.length; i++) {
      const groupName = api.getDataFileName(data[i].date)
      if (!groups[groupName]) { groups[groupName] = { articles: [] } }
      groups[groupName].articles.push(data[i])
    }
    for (let group in groups) {
      const filePath = path.join(dataPath, `${group}.json`)
      let file = api.fs.readJson(filePath)
      if (!file) { file = { articles: [] } }
      for (let i = 0; i < groups[group].articles.length; i++) {
        if (file.articles.find(x => x.title === groups[group].articles[i].title)) {
          console.log(`article '${groups[group].articles[i].title}' in group '${group}' duplicate`)
          continue
        }
        file.articles.push(groups[group].articles[i])
      }
      api.fs.writeJson(filePath, file)
      console.log(`${groups[group].articles.length} articles saved, total ${file.articles.length}: ${filePath}`)
    }
  },
  comparer: {
    date: (a, b) => {
      const ad = new Date(a.date)
      const bd = new Date(b.date)
      if (!(ad instanceof Date) || isNaN(ad)) {
        throw Error(`date string '${a.date}' not valid`)
      }
      if (!(bd instanceof Date) || isNaN(bd)) {
        throw Error(`date string '${b.date}' not valid`)
      }
      if (ad < bd) {
        return -1
      } else if (ad > bd) {
          return 1
      } else {
        return 0
      }
    },
  },
  aggregate: {
    tests: () => {
      const dataPath = path.join(api.settings.directory.data, 'tester_tests')
      if (!fs.existsSync(dataPath)) {
        console.error(`tests at path '${dataPath}' does not exist`)
        return []
      }
      if (!fs.readdirSync(dataPath).length) {
        console.error(`data path '${dataPath}' has no data`)
        return []
      }
      const p = new Promise((resolve, reject) => {
        const data = []
        klaw(dataPath)
          .on('data', item => {
            const pathObj = path.parse(item.path)
            if (pathObj.ext !== '.json') return
            
            let obj
            try {
              obj = api.fs.readJson(item.path)
            } catch(err) {
              console.log(`json at path '${item.path}' invalid`)
              throw Error(err)
            }

            // there really is no reason to parse the json into an object other than
            // to check if its valid, might as well
            data.push(obj)
          })
          .on('end', () => {
            resolve(data)
          })
      })
      return p
    },
    generic: (pathPart) => {
      const dataPath = path.join(api.settings.directory.data, pathPart)
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
            //console.log(pathObj)
            if (/*pathObj.ext.length && */pathObj.ext !== '.json') {
              // atm its just <year>-<month>.json files in a single folder, but could be nested for
              // some reason(shouldnt be)
              return
            }

            let obj
            try {
              obj = api.fs.readJson(item.path)
            } catch (err) {
              // TODO: idk, log it or something
              console.log(`json at path '${item.path}' invalid`)
              throw Error(err)
            }
            if (!obj.articles) {
              throw Error(`json at path '${item.path}' does not have an articles property. where are we even`)
            }
            // geh cant concat
            for (let i = 0; i < obj.articles.length; i++) data.push(obj.articles[i])

            //console.log('data ln', data.length, item.path)
          })
          .on('end', () => {
            // TODO: sort data
            data.sort(api.comparer.date)
            resolve(data)
          })
      })
      return p
    },
    cia_historic: () => {
      const dataPath = path.join(api.settings.directory.data, 'historic', 'CIA')
      // this can happen if we didnt place the data in the correct folder, its not committed
      if (!fs.existsSync(dataPath)) {
        throw Error(`path '${dataPath}' does not exist`)
      }
      if (!fs.readdirSync(dataPath).length) {
        throw Error(`data path '${dataPath}' has no data`)
      }
      // cia data is /<year>/data.json, ignore /<year>/files, just readdir
      // then pluck the known files
      const result = []
      const folderNames = fs.readdirSync(dataPath)
      for (const fi in folderNames) {
        const obj = api.fs.readJson(path.join(dataPath, folderNames[fi], 'data.json'))
        for (const pi in obj.pages) {
          const page = obj.pages[pi]
          for (const ei in page.entries) {
            const entry = page.entries[ei]
            const item = {
              title: entry.title, // worthless
              documentNumber: entry.info.documentNumber, // not sure if this always exists
              caseNumber: entry.info.caseNumber,
              text: entry.text,
              date: {create:null,release:null,publish:null}, // we dont care when it was scraped
            }
            if (entry.info.documentCreationDate?.length) {
              const date = new Date(entry.info.documentCreationDate)
              if (date instanceof Date && !isNaN(date)) {
                item.date.create = new Date(entry.info.documentCreationDate).toISOString()
              }
            }
             if (entry.info.documentReleaseDate?.length) {
              const date = new Date(entry.info.documentReleaseDate)
              if (date instanceof Date && !isNaN(date)) {
                item.date.release = new Date(entry.info.documentReleaseDate).toISOString()
              }
            }
            if (entry.info.publicationDate?.length) {
              const date = new Date(entry.info.publicationDate)
              if (date instanceof Date && !isNaN(date)) {
                item.date.publish = new Date(entry.info.publicationDate).toISOString()
              }
            }
            result.push(item)
          }
        }
      }
      console.log(`${result.length} entries in cia historic`)
      return result
    },
    cve: () => {
      // there is more than just the '1_1' cves but... whatever. shouldnt be much work, just a 
      // touch and go job regarding fetching data. ah I guess when we have more than the one
      // source we can add that here

      const filePath = path.join(api.settings.directory.data, 'cve_nvd1_1.json')
      if (!fs.existsSync(filePath)) {
        throw Error(`cve file '${filePath}' does not exist`)
      }
      
      let data
      try {
        data = api.fs.readJson(filePath)
      } catch(err) {
        // if mitre messes up json the sky is falling
        throw Error(err)
      }
      
      let result = []
      for (let i in data.CVE_Items) {
        const cve = data.CVE_Items[i]
        const descriptionData = cve.cve.description.description_data.find(x => x.lang === 'en')
        if (!descriptionData) {
          console.log(`failed to find english description for CVE ${cve.cve.CVE_data_meta.ID}`)
          continue
        }
        if (!descriptionData.value.length) {
          // potentially log this but I dont really care
          continue
        }
        result.push({
          title: `[${cve.cve.CVE_data_meta.ID}]:${cve.publishedDate.substring(0,10)}`,
          text: descriptionData.value,
          date: cve.publishedDate,
        })
      }
      
      return result
    },
  },
  random: {
    bool: !!Math.floor(Math.random() * 2),
    number: max => Math.floor(Math.random() * max),
  },
}

module.exports = api
