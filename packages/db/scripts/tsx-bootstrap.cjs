process.geteuid ??= () => 0
const filename = __filename.replaceAll('\\', '/')
if (!process.env.NODE_OPTIONS?.includes(filename)) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --require="${filename}"`.trim()
}
