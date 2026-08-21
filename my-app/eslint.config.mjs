// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
    // battlestack:formatting (managed by @battlestack/preset-nuxt)
    // ESLint owns formatting (no Prettier). Self-closing tags are allowed
    // on purpose: `<img />` reads as a thing, not as an unclosed tag.
    {
        rules: {
            'vue/html-self-closing': ['error', {
                html: { void: 'always', normal: 'always', component: 'always' },
            }],
        },
    },
    // battlestack:fetched-skills (managed by @battlestack/preset-nuxt)
    // Third-party skill trees fetched by `skills add`; not this project's
    // code, so linting them reports someone else's style as ours.
    { ignores: ['.agents/**'] },
    // Your custom configs here
)
