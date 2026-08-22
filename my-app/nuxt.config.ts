// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

    modules: [
        '@nuxt/eslint',
        '@nuxt/fonts',
        '@nuxt/image',
        '@nuxt/ui',
        '@nuxtjs/i18n',
        'nuxt-auth-utils',
        '@pinia/nuxt',
        'nuxt-security',
        '@vite-pwa/nuxt',
        'pinia-plugin-persistedstate/nuxt',
    ],
    devtools: { enabled: true },

    css: ['~/assets/css/main.css'],

    // Het Adjust design system kent één thema. Donkere vlakken zijn er alleen
    // voor navigatie en oriëntatie, niet voor content — een dark mode zou dus
    // kleuren vragen die het merk niet heeft.
    colorMode: {
        preference: 'light',
        fallback: 'light',
    },

    runtimeConfig: {
        health: {
            failOnDegraded: true,
            dbTimeoutMs: 1000,
        },

        public: {
            appName: 'my-app',
            auditLog: true,
            appUrl: '',
            allowRegistration: false,
            dashboard: true,
            authPasskeys: true,
            authRecovery: true,
            userAdmin: true,
            mastraAdmin: true,
            promptMgmt: true,
            chat: true,
            rag: true,
            inkoopbeleid: true,
        },

        databaseUrl: '',
        disableDbMigrateOnBoot: false,
        smtpHost: '',
        smtpPort: '',
        smtpUsername: '',
        smtpPassword: '',
        smtpFrom: '',
        smtpRequireTls: '',
        allowedOrigins: '',
        rateLimitDisabled: false,
        totpEncryptionKey: '',
        totpStrict: false,
        redisUrl: '',
        s3Region: '',
        s3Endpoint: '',
        s3Bucket: '',
        s3AccessKeyId: '',
        s3SecretAccessKey: '',
        s3PublicBaseUrl: '',
        aiGatewayUrl: '',
        aiGatewayKey: '',

        rag: {
            embeddingDimensions: 1536,
            maxChunkSize: 700,
            chunkOverlap: 100,
            topK: 5,
            embeddingModel: 'openai/text-embedding-3-small',
        },
    },

    ignore: [
        '**/*.battlestack.bak',
        '**/*.battlestack.new',
        '**/*.battlestack.patch',
        '**/*.battlestack',
        '**/*.wolf.bak',
        '**/*.wolf.new',
        '**/*.wolf.patch',
        '**/*.wolf',
    ],
    compatibilityDate: '2025-07-15',

    nitro: {
        ignore: [
            '**/*.battlestack.bak',
            '**/*.battlestack.new',
            '**/*.battlestack.patch',
            '**/*.battlestack',
            '**/*.wolf.bak',
            '**/*.wolf.new',
            '**/*.wolf.patch',
            '**/*.wolf',
        ],

        experimental: {
            websocket: true,
        },
    },

    vite: {
        optimizeDeps: {
            include: ['@vue/devtools-core', '@vue/devtools-kit', 'zod', 'qrcode'],
        },

        ssr: {
            noExternal: ['zod'],
        },
    },

    auth: {
        webAuthn: true,
    },

    eslint: {
        config: {
            stylistic: {
                indent: 4,
                quotes: 'single',
                semi: false,
                commaDangle: 'always-multiline',
                arrowParens: true,
                braceStyle: '1tbs',
            },
        },
    },

    // Instrument Sans is het merkfont van Adjust en het enige font in
    // applicaties. @nuxt/fonts host het zelf onder /_fonts, zodat de CSP
    // (font-src 'self') geen uitzondering voor Google nodig heeft.
    fonts: {
        families: [{
            name: 'Instrument Sans',
            provider: 'google',
            weights: [400, 500, 600, 700],
            styles: ['normal', 'italic'],
        }],
    },

    i18n: {
        defaultLocale: 'nl',
        strategy: 'no_prefix',

        detectBrowserLanguage: {
            useCookie: true,
            cookieKey: 'i18n_locale',
            redirectOn: 'root',
            fallbackLocale: 'en',
        },

        locales: [{
            code: 'en',
            language: 'en-US',
        }, {
            code: 'nl',
            language: 'nl-NL',
        }],
    },

    pwa: {
        registerType: 'autoUpdate',

        manifest: {
            name: 'my-app',
            short_name: 'my-app',
            theme_color: '#CF2C28',
            background_color: '#F1F1F1',
            display: 'standalone',

            icons: [{
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            }, {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            }, {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            }],
        },

        workbox: {
            navigateFallback: '/',
            globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        },

        devOptions: {
            enabled: false,
        },
    },

    security: {
        headers: {
            contentSecurityPolicy: {
                'default-src': ['\'self\''],

                'script-src': [
                    '\'self\'',
                    '\'wasm-unsafe-eval\'',
                    '\'unsafe-eval\'',
                    '\'nonce-{{nonce}}\'',
                    '\'strict-dynamic\'',
                ],

                'style-src': ['\'self\'', '\'unsafe-inline\''],

                'img-src': [
                    '\'self\'',
                    'data:',
                    'https:',
                    'http://localhost:*',
                    'blob:',
                ],

                'font-src': ['\'self\'', 'data:'],
                'connect-src': ['\'self\'', 'ws:', 'wss:'],
                'media-src': ['\'self\'', 'https:', 'http://localhost:*', 'blob:'],
                'worker-src': ['\'self\'', 'blob:'],
                'frame-ancestors': ['\'none\''],
            },

            strictTransportSecurity: {
                maxAge: 31536000,
                includeSubdomains: false,
            },

            xFrameOptions: 'DENY',
            xContentTypeOptions: 'nosniff',
            referrerPolicy: 'strict-origin-when-cross-origin',

            permissionsPolicy: {
                camera: [],
                microphone: [],
                geolocation: [],
            },
        },

        rateLimiter: process.env.NUXT_RATE_LIMIT_DISABLED === 'true' ? false : { tokensPerInterval: 100, interval: 60_000 },
        xssValidator: false,
    },
})
