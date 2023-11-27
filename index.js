import "dotenv/config"
import { parseArgs } from "node:util"
import { convert } from "html-to-text"
import OpenAI from "openai"
import { encodingForModel } from "js-tiktoken"
import puppeteer from "puppeteer"

const OPENAI_MODEL = "gpt-3.5-turbo-1106"
const MAX_TOKENS = 16385

export async function getBoardMembers(name, orgDomainOnly=false) {
  const urls = await getLikelyBoardUrls(name, orgDomainOnly)
  console.log("Found possible urls:\n")
  console.log(urls)
  let board = null
  let url = null

  for (let i = 0; i < urls.length; i++) {
    url = urls[i]
    console.log(`Looking for board members at ${url}`)
    const html = await getUrlContent(url)

    if (html === null) {
      continue
    }

    let text = convert(html, { wordwrap: null })
    board = await getBoardMembersFromText({ text, name })

    if (Array.isArray(board) && board.length > 2) {
      break
    }

    // for first url, try again with puppeteer
    if (i === 0) {
      console.log(`Trying again with puppeteer at ${url}`)

      text = await getUrlTextWithPuppeteer(url)
      board = await getBoardMembersFromText({ text, name })

      if (Array.isArray(board) && board.length > 2) {
        break
      }
    }
  }

  return { url, board }
}

export async function getLikelyBoardUrls(name, orgDomainOnly) {
  let boardSearchQuery

  if (orgDomainOnly) {
    const domain = await getCompanyDomain(name)
    boardSearchQuery = `site:${domain} ${args.name} board`

  } else {
    boardSearchQuery = `${args.name} board`
  }

  console.log(boardSearchQuery)
  const boardSearchResults = await googleSearch(boardSearchQuery)
  return boardSearchResults.items.map(item => item.link)
}

export async function getBoardMembersFromText({ text, name }) {
  const openai = new OpenAI()

  text = truncateText(text)

  const chatCompletion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { "type": "json_object" },
    messages: [
      { role: "system", content: `You will be provided with text from ${name}'s website that might list ${name}'s board of directors (also known as the "board" or "board of trustees" or "directors" or "trustees"), and your task is to extract a list of people who are on ${name}'s board using only the provided text. Return the list in a JSON array under the key 'boardMembers'. Each board member should have the following fields: name, bio, link. The bio field is a block of text that describes the board member, and can be null if it's not present. The link field is a url for more info about the board member, and can be null if it's not present. If the board of directors cannot be found in the provided text then set 'boardMembers' equal to null. Do not return people mentioned the text if there's no evidence that they're on ${name}'s board.` },
      { role: "user", content: text }
    ],
  })

  const data = JSON.parse(chatCompletion.choices[0].message.content)
  return data.boardMembers
}

async function getCompanyDomain(name) {
  const searchResults = await googleSearch(`${args.name} official website`)
  const link = searchResults.items.map(item => item.link)[0]
  const url = new URL(link)
  return url.hostname.replace('www.', '')
}

async function getUrlContent(url, type='text') {
  try {
    const response = await fetch(url)

    if (response.ok) {
      const data = await response[type]()
      return data
    } else {
      console.log(`Error: ${url}`)
      console.error(`Error: ${response.status} - ${response.statusText}`)
      return null
    }
  } catch (error) {
    console.log(`Error: ${url}`)
    console.error(`Error: ${error.message}`)
    return null
  }
}

async function getUrlTextWithPuppeteer(url) {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.goto(url)
  await page.waitForSelector('body')
  const pageContent = await page.evaluate(() => {
    return document.body.innerText
  })
  await browser.close()
  return pageContent
}

async function googleSearch(query) {
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID
  const key = process.env.GOOGLE_SEARCH_API_KEY
  const url = `https://www.googleapis.com/customsearch/v1?cx=${cx}&key=${key}&q=${query}`
  return await getUrlContent(url, 'json')
}

function truncateText(text) {
  const encoding = encodingForModel(OPENAI_MODEL)
  const tokens = encoding.encode(text)
  const truncatedTokens = tokens.slice(0, MAX_TOKENS - 1000)
  const truncatedText = encoding.decode(truncatedTokens)
  return truncatedText
}

const { values: args } = parseArgs({
  options: {
    name: {
      type: "string",
      short: "n",
    },
    "orgdomain": {
      type: "boolean",
      short: "o"
    }
  },
})

if (!args.name) {
  console.log("Org name required")
  process.exit(1)
}

const board = await getBoardMembers(args.name, args.orgdomain)
console.log(`${args.name} board:`)
console.log(board)
