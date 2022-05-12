import puppeteer from 'puppeteer'
import autoScroll from './utils/puppeteer-autoscroll'
import fs from 'fs'

class Scrapper {
  browser: puppeteer.Page | null = null

  constructor () {
    console.log('Started')
  }

  async init (): Promise<puppeteer.Page> {
    this.browser = await this.getBrowser()
    return this.browser
  }

  async getBrowser (): Promise<puppeteer.Browser> {
    const browser = await puppeteer.launch({ headless: false, devtools: true })
    return browser
  }

  async getPage (): Promise<puppeteer.Page> {
    const page = await browser.newPage()
    return page
  }

  async goto (url: string): Promise<void> {
    await this.browser!.goto(url)
    const as: any = await autoScroll(this.browser!)
    return as
  }

  async getLinks (): Promise<string[]> {
    this.browser!.waitForSelector('#g-items li.g-item-sortable div.a-col-right div.a-row h2 a')
    const links = await this.browser!.evaluate(() => {
      const alinks = Array.from(document.querySelectorAll('#g-items li.g-item-sortable div.a-col-right div.a-row h2 a'))
      return alinks.map((a) => {
        return `https://www.amazon.com.br${a.getAttribute('href')}`
      })
    })
    const allLinks = links as string[]
    return allLinks
  }

  async cleanField (selector: string) {
    try {
      const field = await this.browser!.$eval(selector, (item) => { return item.textContent })
      return field
    } catch (e) {
      console.log(e)
      return 'not found'
    }
  }

  async getData (): Promise<any> {
    const title = await this.cleanField('#productTitle')
    const subtitle = await this.cleanField('#productSubtitle')
    const author = await this.cleanField('#bylineInfo > span.author.notFaded > a')
    const format = await this.cleanField('##bylineInfo > span:nth-child(5)')
    const stars = await this.cleanField('#acrPopover > span.a-declarative > a > i.a-icon.a-icon-star.a-star-4-5 > span')
    const evaluations = await this.cleanField('#acrCustomerReviewText')
    const type = await this.cleanField('#a-autoid-2-announce > span:nth-child(1)')
    const price = await this.cleanField('#a-autoid-2-announce > span.a-color-base > span')
    const pages = await this.cleanField('#anonCarousel2 > ol > li:nth-child(1) > div > div.a-section.a-spacing-none.a-text-center.rpi-attribute-value > span > a > span')
    const publication = await this.cleanField('#anonCarousel2 > ol > li:nth-child(4) > div > div.a-section.a-spacing-none.a-text-center.rpi-attribute-value > span')

    return `${title};${subtitle};${author};${format};${stars};${evaluations};${type};${price};${pages};${publication}\n`
  }

  async save (content: string) {
    const date = new Date().toISOString().split('T')[0]
    const filename = `${date} - whishlist.csv`
    fs.appendFileSync(filename, content)
  }

  async close () {
    console.log('Done!')
    this.browser?.close()
  }
}

async function main () {
  const scrapper = new Scrapper()
  await scrapper.init()
  await scrapper.goto('https://www.amazon.com.br/hz/wishlist/ls/8RFTJ603L057?ref_=wl_share')
  const links = await scrapper.getLinks()
  console.log(links)
  for (const link of links) {
    await scrapper.goto(link)
    const item = await scrapper.getData()
    await scrapper.save(item)
  }
  scrapper.close()
}

main()
