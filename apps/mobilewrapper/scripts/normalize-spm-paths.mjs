import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url)
writeFileSync(file, readFileSync(file, 'utf8').replaceAll('\\', '/'))
