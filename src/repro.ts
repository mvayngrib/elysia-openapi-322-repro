import { fromTypes } from '@elysia/openapi/gen'

const reference: Record<string, any> = fromTypes('src/index.ts')() ?? {}

const expected = [
	['/api/v1/project/test', 'issue #322'],
	['/encode/base64', 'issue #345'],
	['/encode/hex', 'control  '],
	['/test3', 'issue #339'],
	['/test', 'control  ']
] as const

let failed = 0

for (const [path, label] of expected) {
	const method = reference[path] && Object.keys(reference[path])[0]
	const response = method ? reference[path][method]?.response : undefined
	const ok = response && Object.keys(response).length > 0

	if (!ok) failed++

	console.log(
		`${ok ? 'ok      ' : 'DROPPED '} ${label}  ${path.padEnd(22)} ` +
			(ok ? JSON.stringify(response).slice(0, 60) : '<no response schema>')
	)
}

console.log(
	`\n${failed} of ${expected.length} routes have no inferred response schema.`
)
