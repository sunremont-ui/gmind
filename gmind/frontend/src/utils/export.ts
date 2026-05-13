export async function exportSVG(svgEl: SVGSVGElement, filename: string) {
  const svgString = serializeSVG(svgEl)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  downloadBlob(blob, `${filename}.svg`)
}

export async function exportPNG(svgEl: SVGSVGElement, filename: string): Promise<void> {
  const canvas = await svgToCanvas(svgEl, 2)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        downloadBlob(blob, `${filename}.png`)
        resolve()
      } else {
        reject(new Error('Failed to create PNG blob'))
      }
    }, 'image/png')
  })
}

export async function exportPDF(svgEl: SVGSVGElement, filename: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const canvas = await svgToCanvas(svgEl, 2)
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width / 2, canvas.height / 2],
  })
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
  pdf.save(`${filename}.pdf`)
}

function serializeSVG(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const style = document.createElement('style')
  style.textContent = '* { font-family: system-ui, -apple-system, sans-serif; }'
  clone.insertBefore(style, clone.firstChild)
  return new XMLSerializer().serializeToString(clone)
}

function svgToCanvas(svgEl: SVGSVGElement, scale: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const svgString = serializeSVG(svgEl)
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG for rendering'))
    }
    img.src = url
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
