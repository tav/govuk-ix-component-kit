// Public Domain (-) 2017-present The Component Kit Authors.
// See the Component Kit UNLICENSE file for details.

//! The protokit module implements a component manager for Protokit.

import * as fs from 'fs'
import * as code from 'govuk/componentkit/code'
import * as log from 'govuk/log'
import * as os from 'govuk/os'
import {dict} from 'govuk/types'
import * as web from 'govuk/web'
import * as path from 'path'

export interface VersionFiles {
	components: {
		[key: string]: {
			css?: string
			html?: string
			ts?: string
		}
	}
	info: string
	fields: {
		[key: string]: string
	}
	pages: {
		[key: string]: {
			html?: string
			ts?: string
		}
	}
	protokit: {
		group?: string
		site?: string
	}
	text: {
		[key: string]: string
	}
	variables: {
		css?: string
		components?: string
		group?: string
		pages?: string
		site?: string
		version?: string
	}
}

export interface GroupData {
	[key: string]: {
		infopage: {
			path: string
			mod?: GroupInfoPage
		}
		versions: {
			[key: string]: {
				components: {
					[key: string]: {
						compiled: boolean
						path: string
					}
				}
				fields: {
					mod: any
					paths: dict
				}
				info?: VersionInfo
				merged?: boolean
				pages: {
					[key: string]: Page
				}
				stylesheet?: string
				text: boolean
			}
		}
	}
}

export interface GroupInfoPage {
	Description: string
	ID: string
	Title: string
	render(ctx: web.Context, group: string, versions: VersionInfo[]): string
}

export interface Page {
	render(ctx: web.Context): string
}

export interface SitePage {
	render(ctx: web.Context, groups: GroupInfoPage[]): string
}

export interface VersionInfo {
	Changes: string[]
	Created: number
	ID: string
	StartURL: string
	Title: string
}

const ALPHA_NUMERIC = /^[A-Za-z0-9]*$/
const ALPHA_UPPER = /^[A-Z]/
const FIELD_IDENT = /^[a-z]*\.[A-Za-z0-9]*$/
const MESSAGE_IDENT = /^[A-Z][A-Z_]*(_[a-z][a-z])?$/
const URL_IDENT = /^[\/A-Za-z0-9-]*$/
const VERSION_IDENT = /^[A-Za-z0-9-]*$/

const VALID_METATYPES = new Set([
	'components',
	'fields',
	'pages',
	'protokit',
	'text',
	'variables',
])

function splitFilename(filename: string) {
	const idx = filename.lastIndexOf('.')
	if (idx === -1) {
		return [filename, '']
	}
	return [filename.slice(0, idx), filename.slice(idx + 1)]
}

function merge() {}

export class Manager {
	private filecache: dict = {}
	private groups: GroupData = {}
	private sitepage?: SitePage

	constructor(public root: string) {
		this.load(true)
		os.watch(root, this.load.bind(this))
	}

	getStyleSheet(groupID: string, versionID: string) {
		const group = this.groups[groupID]
		if (!group) {
			return
		}
		const version = group.versions[versionID]
		if (!version) {
			return
		}
		if (version.stylesheet === undefined) {
			version.stylesheet = this.compileStyleSheet(version)
		}
		return version.stylesheet
	}

	render(ctx: web.Context, args: string[]) {
		let resp
		try {
			resp = this.renderPath(ctx, args)
		} catch (err) {
			ctx.error = err
			err.handled = true
			log.error(err)
			const [groupID, versionID] = this.getGroupVersion(args)
			return this.renderPage(ctx, groupID, versionID, '@500')
		}
		if (resp === 404) {
			const [groupID, versionID] = this.getGroupVersion(args)
			return this.renderPage(ctx, groupID, versionID, '@404')
		}
		return resp
	}

	private compile() {
		try {
			const files = this.load()
			// Get rid of groups without a matching group.ts file.
			for (const group of Object.keys(files)) {
				if (group === 'base') {
					continue
				}
				if (data[version].info === undefined) {
					delete data[version]
				}
			}
			// Get rid of versions without a matching info.ts file.
			const sources: dict = {}
			for (const [version, spec] of Object.entries(data)) {
				if (version !== 'base') {
					sources[`@ckit/info/${this.id}/${version}`] = spec.info!
				}
			}
			const mods = code.compile(sources)
			if (!mods) {
				log.error('componentkit: aborting building of components due to error')
				return
			}
			const versions: VersionInfo[] = []
			for (const id of Object.keys(mods)) {
				const split = id.split('/')
				const type = split[1]
				const version = split[3]
				if (type === 'info') {
					const info = mods[id] as VersionInfo
					info.Created = info.Created || 0
					info.ID = version
					info.StartURL = info.StartURL || '/'
					info.Title = info.Title || 'Untitled Prototype'
					versions.push(info)
				}
			}
			this.versions = versions.sort((a, b) => b.Created - a.Created)
		} catch (err) {
			if (!err.handled) {
				log.error(err)
			}
			log.error('componentkit: aborting building of components due to error')
			return
		}
		// let lexer = lex.html()
		// if (lexer.error)  {
		// 	//
		// }
		// compile.html(lexer.tokens)
	}

	private compileGroupPage(groupID: string) {
		return {}
	}

	private compilePage() {
		return {}
	}

	private compileStyleSheet(version: any) {
		const css = []
		css.push('')
		return css.join('')
	}

	private compileVersionInfo(groupID: string, versionID: string) {
		return {}
	}

	private getGroupInfos() {
		const infos = []
		for (const [groupID, group] of Object.entries(this.groups)) {
			let info = group.infopage
			if (!info) {
				info = this.compileGroupPage(groupID) as GroupInfoPage
				group.infopage = info
			}
			infos.push(info)
		}
		infos.sort((a, b) => a.Title.localeCompare(b.Title))
		return infos
	}

	private getGroupVersion(args: string[]) {
		if (args.length < 3) {
			return ['base', 'site']
		}
		return args.slice(0, 2)
	}

	private getVersionInfos(groupID: string) {
		const infos = []
		const group = this.groups[groupID]
		for (const [versionID, version] of Object.entries(group.versions)) {
			let info = version.info
			if (!info) {
				info = this.compileVersionInfo(groupID, versionID) as VersionInfo
				version.info = info
			}
			infos.push(info)
		}
		infos.sort((a, b) => b.Created - a.Created)
		return infos
	}

	// `load` walks the protokit directory and gathers the available files into
	// a meta datastructure.
	private load(firstTime?: boolean) {
		if (!firstTime) {
			log.info('Changed detected. Clearing component cache ...')
		}
		this.filecache = {}
		this.filepaths = {}
		this.groups = {}
		this.sitepage = undefined
		return
		const files: GroupFiles = {}
		for (const filepath of os.walk(this.root)) {
			const segments = filepath.split(path.sep)
			if (segments.length < 3) {
				const ver = segments[0]
				if (segments[1] === 'version.ts' && ver !== 'base') {
					if (!versions[ver]) {
						versions[ver] = {components: {}, fields: {}, pages: {}}
					}
					versions[ver].info = contents
				}
				continue
			}
			const version = segments[0]
			if (!VERSION_IDENT.test(version)) {
				continue
			}
			if (!versions[version]) {
				versions[version] = {components: {}, fields: {}, pages: {}}
			}
			const meta = versions[version]
			const metatype = segments[1]
			if (!VALID_METATYPES.has(metatype)) {
				continue
			}
			switch (metatype) {
				case 'components':
					if (segments.length !== 3) {
						continue
					}
					const [name, type] = splitFilename(segments[2])
					if (!(ALPHA_UPPER.test(name) && ALPHA_NUMERIC.test(name))) {
						continue
					}
					if (!meta.components[name]) {
						meta.components[name] = {css: '', html: '', ts: ''}
					}
					switch (type) {
						case 'css':
							meta.components[name].css = contents
							break
						case 'html':
							meta.components[name].html = contents
							break
						case 'ts':
							meta.components[name].ts = contents
							break
					}
					break
				case 'fields':
					if (segments.length !== 3) {
						continue
					}
					const [field, fieldExt] = splitFilename(segments[2])
					if (fieldExt !== 'ts') {
						continue
					}
					if (!FIELD_IDENT.test(field)) {
						continue
					}
					meta.fields[field] = contents
					break
				// case 'messages':
				// 	if (segments.length !== 3) {
				// 		continue
				// 	}
				// 	const [msg, msgExt] = splitFilename(segments[2])
				// 	if (!MESSAGE_IDENT.test(msg)) {
				// 		continue
				// 	}
				// 	if (!meta.messages[msg]) break
				case 'pages':
					let [url, ext] = splitFilename('/' + segments.slice(2).join('/'))
					if (url === '/index') {
						url = '/'
					}
					if (!URL_IDENT.test(url)) {
						continue
					}
					if (!meta.pages[url]) {
						meta.pages[url] = {html: '', ts: ''}
					}
					switch (ext) {
						case 'html':
							meta.pages[url].html = contents
							break
						case 'ts':
							meta.pages[url].ts = contents
							break
					}
					break
			}
		}
		return versions
	}

	private buildPage(source: string, variables: string) {
		return `
import * as ckit from 'govuk/componentkit/ckit'
import * as html from 'govuk/componentkit/html'
import * as web from 'govuk/web'
${variables}

export function render(ctx: web.Context): string {
	return ${source}
}`
	}

	private readFile(path: string) {
		const contents = this.filecache[path]
		if (contents !== undefined) {
			return contents
		}
		return fs.readFileSync(path, {encoding: 'utf8'})
	}

	private renderGroupPage(ctx: web.Context, groupID: string) {
		const group = this.groups[groupID]
		if (!group) {
			return 404
		}
		let page = group.infopage
		if (!page) {
			page = this.compileGroupPage(groupID) as GroupInfoPage
		}
		return page.render(ctx, groupID, this.getVersionInfos(groupID))
	}

	private renderPage(
		ctx: web.Context,
		groupID: string,
		versionID: string,
		path: string
	) {
		return 404
	}

	private renderPath(ctx: web.Context, args: string[]) {
		if (!args.length) {
			return this.renderSitePage(ctx)
		}
		const [groupID, versionID, ...urlsegments] = args
		if (groupID === 'base' && versionID !== 'site') {
			return ctx.redirect('/base/site')
		}
		if (args.length === 1) {
			return this.renderGroupPage(ctx, groupID)
		}
		return this.renderPage(ctx, groupID, versionID, urlsegments.join('/'))
	}

	private renderSitePage(ctx: web.Context) {
		let sitepage = this.sitepage
		if (!sitepage) {
			sitepage = this.compilePage() as SitePage
			this.sitepage = sitepage
		}
		return sitepage.render(ctx, this.getGroupInfos())
	}
}
