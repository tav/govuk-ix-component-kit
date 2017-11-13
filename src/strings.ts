// Public Domain (-) 2017-present The Component Kit Authors.
// See the Component Kit UNLICENSE file for details.

export function slugify(title: string) {
	const out = []
	let hyphen = false
	for (const char of title.toLowerCase()) {
		const code = char.codePointAt(0) as number
		// a-z || 0-9
		if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
			if (hyphen) {
				out.push('-')
				hyphen = false
			}
			out.push(char)
		} else {
			hyphen = true
		}
	}
	return out.join('')
}