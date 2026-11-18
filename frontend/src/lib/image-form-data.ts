/** Multipart body of an image upload: the file plus its crop. */
export function imageFormData(file: File, x: number, y: number, scale: number) {
  const data = new FormData()
  data.append('file', file)
  data.append('x', String(x))
  data.append('y', String(y))
  data.append('scale', String(scale))
  return data
}
