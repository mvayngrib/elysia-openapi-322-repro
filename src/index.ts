import { Elysia } from 'elysia'

// Reported in https://github.com/elysiajs/elysia-openapi/issues/322
// A plugin mounted under a prefix whose segment ends in a digit: `v1`
const project = new Elysia({ prefix: '/api/v1/project' }).get(
	'/test',
	async () => ({
		success: true,
		message: 'Project route is working!'
	})
)

export const app = new Elysia()
	.use(project)
	// https://github.com/elysiajs/elysia-openapi/issues/345
	.get('/encode/base64', () => ({ enc: 'ok' })) // segment ends in a digit
	.get('/encode/hex', () => ({ enc: 'ok' })) //    control: no digit
	// https://github.com/elysiajs/elysia-openapi/issues/339
	.get('/test3', (): string => 'hello') //         segment ends in a digit
	.get('/test', (): string => 'hello') //          control: no digit
