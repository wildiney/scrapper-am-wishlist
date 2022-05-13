import puppeteer from 'puppeteer'
import autoScroll from './utils/puppeteer-autoscroll'
import fs from 'fs'

class Scrapper {
  browser: puppeteer.Browser | null = null
  page: puppeteer.Page | null = null

  constructor () {
    console.log('Start')
  }

  async init (): Promise<puppeteer.Page> {
    this.browser = await this.getBrowser()
    this.page = await this.getPage()
    return this.page
  }

  async getBrowser (): Promise<puppeteer.Browser> {
    const browser = await puppeteer.launch({ headless: false, devtools: false })
    return browser
  }

  async getPage (): Promise<puppeteer.Page> {
    const page = await this.browser!.newPage()
    return page
  }

  async goto (url: string): Promise<void> {
    console.log('trying go to', url)
    await this.page!.goto(url, { waitUntil: 'networkidle2' })
    await autoScroll(this.page!)
  }

  async getLinksFrom (): Promise<string[]> {
    await this.page!.waitForSelector('#g-items li.g-item-sortable div.a-col-right div.a-row h2 a')
    const links = await this.page!.evaluate(() => {
      const alinks = Array.from(document.querySelectorAll('#g-items li.g-item-sortable div.a-col-right div.a-row h2 a'))
      return alinks.map((a) => {
        return `https://www.amazon.com.br${a.getAttribute('href')}`
      })
    })
    const allLinks = links as string[]
    return allLinks
  }

  async cleanField (selector: string, exceptionMessage = 'not found') {
    try {
      const field = await this.page!.$eval(selector, (item) => { return item.textContent })
      return field!.replace(/(\r\n|\n|\r)/gm, '').replace(/(\t)/gm, '').replace(/ +(?= )/g, '').trim()
    } catch (e) {
      console.log(e)
      return exceptionMessage
    }
  }

  async getData (link: string): Promise<any> {
    console.log('Getting data...')
    const title = await this.cleanField('#productTitle')
    const subtitle = await this.cleanField('#productSubtitle')
    let author = await this.cleanField('#bylineInfo > span.author.notFaded > span.a-declarative > a.a-link-normal.contributorNameID')
    if (author === 'not found') {
      author = await this.cleanField('#bylineInfo > span.author.notFaded')
    }
    let stars = await this.cleanField('#acrPopover > span.a-declarative > a > i.a-icon.a-icon-star > span')
    stars = stars.replace(' de 5 estrelas', '').replace(',', '.')

    let evaluations = await this.cleanField('#acrCustomerReviewText')
    evaluations = evaluations.replace(' avaliações de clientes', '').replace('.', '')

    let price = await this.cleanField('#kindle-price')
    if (price === 'not found') {
      price = await this.cleanField('#price')
    }
    price = price.replace('R$', '').replace('.', '').replace(',', '.')

    let pages = null
    for (let i = 0; i < 10; i++) {
      const label = await this.cleanField(`#detailBullets_feature_div > ul > li:nth-child(${i}) > span > span.a-text-bold`)
      if (label.indexOf('Número de páginas') >= 0) {
        pages = await this.cleanField(`#detailBullets_feature_div > ul > li:nth-child(${i}) > span > span:nth-child(2)`)
        pages = pages.replace(' páginas', '')
      }
    }

    let publication = null
    let publisher = null
    let lastUpdate = null

    for (let i = 0; i < 10; i++) {
      const label = await this.cleanField(`#detailBullets_feature_div > ul > li:nth-child(${i}) > span > span.a-text-bold`)
      if (label.indexOf('Editora') >= 0) {
        const element = await this.cleanField(`#detailBullets_feature_div > ul > li:nth-child(${i}) > span > span:nth-child(2)`)
        publisher = element.split(';')[0]
        publication = element.split(';')[1]
        try {
          lastUpdate = publication
            .split('(')[1]
            .replace(')', '')
            .replace('janeiro', 'jan')
            .replace('fevereiro', 'feb')
            .replace('março', 'mar')
            .replace('abril', 'apr')
            .replace('maio', 'may')
            .replace('junho', 'jun')
            .replace('julho', 'jul')
            .replace('agosto', 'aug')
            .replace('setembro', 'sep')
            .replace('outubro', 'oct')
            .replace('novembro', 'nov')
            .replace('dezembro', 'dec')
          lastUpdate = new Date(lastUpdate).toISOString().split('T')[0]
        } catch (e) {
          console.log(e)
        }
      }
    }
    return `${title};${subtitle};${author};${stars};${evaluations};${price};${pages};${publication};${publisher};${lastUpdate};${link}\n`
  }

  async save (content: string) {
    const date = new Date().toISOString().split('T')[0]
    const filename = `${date} - whishlist.csv`
    fs.appendFileSync(filename, content)
  }

  async clear () {
    const date = new Date().toISOString().split('T')[0]
    const filename = `${date} - whishlist.csv`
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename)
    }
  }

  async close () {
    this.browser!.close()
  }
}

(async () => {
  const scrapper = new Scrapper()
  await scrapper.init()
  await scrapper.goto('https://www.amazon.com.br/hz/wishlist/ls/8RFTJ603L057?ref_=wl_share')
  await scrapper.clear()
  await scrapper.save('title,subtitle,author,stars,evaluations,price,pages,publication,publisher,lastUpdate,link')
  const links = await scrapper.getLinksFrom()
  for (const link of links) {
    console.log(link)
    const linkScrapper = new Scrapper()
    await linkScrapper.init()
    await linkScrapper.goto(link)
    const items = await linkScrapper.getData(link)
    console.log(items)
    await linkScrapper.save(items)
    await linkScrapper.close()
  }
  await scrapper.close()
})()
