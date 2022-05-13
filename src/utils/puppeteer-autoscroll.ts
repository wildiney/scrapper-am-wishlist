import { Page } from 'puppeteer'

export default async function autoScroll (page: Page) {
  await page.evaluate(async () => {
    await new Promise((resolve: any, _reject) => {
      let totalHeight = 0
      const distance = 100
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })
}
