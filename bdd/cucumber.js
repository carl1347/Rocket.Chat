module.exports = {
	default: {
		requireModule: ['ts-node/register'],
		require: ['features/support/**/*.ts', 'features/steps/**/*.ts'],
		paths: ['features/**/*.feature'],
		format: ['@serenity-js/cucumber', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
		formatOptions: { specDirectory: 'features' },
	},
};
