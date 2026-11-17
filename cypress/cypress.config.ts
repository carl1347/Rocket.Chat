import { defineConfig } from 'cypress';

export default defineConfig({
	e2e: {
		baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:3000',
		specPattern: 'e2e/**/*.cy.ts',
		supportFile: 'support/e2e.ts',
		video: false,
		viewportWidth: 1440,
		viewportHeight: 900,
		defaultCommandTimeout: 10000,
		requestTimeout: 15000,
		env: {
			ADMIN_USER: process.env.ADMIN_USERNAME ?? 'admin',
			ADMIN_PASS: process.env.ADMIN_PASS ?? 'admin',
		},
	},
});
