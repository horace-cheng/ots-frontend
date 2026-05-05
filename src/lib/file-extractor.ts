import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af\u3040-\u30ff]/g) || []).length
  const latin = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af\u3040-\u30ff]/g, ' ')
    .split(/\s+/).filter(w => w.length > 1).length
  return cjk + latin
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const texts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
    if (pageText.trim()) {
      texts.push(pageText.trim())
    }
  }
  return texts.join('\n\n')
}

export async function extractTextAndCountWords(file: File): Promise<number> {
  let text = ''
  const name = file.name.toLowerCase()

  if (name.endsWith('.docx')) {
    text = await extractTextFromDocx(file)
  } else if (name.endsWith('.pdf')) {
    text = await extractTextFromPdf(file)
  } else if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.html')) {
    text = await file.text()
  } else {
    return Math.round(file.size / 2.5)
  }

  const words = countWords(text)
  return words > 0 ? words : Math.round(file.size / 2.5)
}
